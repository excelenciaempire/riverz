import { auth, currentUser } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAdminEmail } from '@/lib/admin-emails';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);


export async function GET(req: Request) {
  try {
    const { userId } = await auth();
    const user = await currentUser();

    if (!userId || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userEmail = user.emailAddresses[0]?.emailAddress;
    if (!isAdminEmail(userEmail)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // ?folders=1 — returns the distinct folder names with counts so the
    // admin UI can populate its filter dropdown without paying for a full
    // template fetch.
    const { searchParams } = new URL(req.url);
    if (searchParams.get('folders') === '1') {
      const { data, error } = await supabaseAdmin
        .from('templates')
        .select('folder');
      if (error) throw error;
      const counts = new Map<string, number>();
      for (const row of data || []) {
        const f = (row as any).folder || '__none__';
        counts.set(f, (counts.get(f) || 0) + 1);
      }
      const folders = Array.from(counts.entries()).map(([name, count]) => ({
        name: name === '__none__' ? null : name,
        count,
      }));
      // Stable order: real folders alphabetical, then "Sin carpeta" last.
      folders.sort((a, b) => {
        if (a.name === null) return 1;
        if (b.name === null) return -1;
        return (a.name || '').localeCompare(b.name || '');
      });
      return NextResponse.json({ folders });
    }

    const { data, error } = await supabaseAdmin
      .from('templates')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching templates:', error);
      throw error;
    }

    return NextResponse.json({ templates: data || [] });
  } catch (error: any) {
    console.error('Error in admin templates route:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch templates' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    const user = await currentUser();

    if (!userId || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userEmail = user.emailAddresses[0]?.emailAddress;
    if (!isAdminEmail(userEmail)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { name, thumbnail_url, category, awareness_level, niche, width, height, folder } = body;

    if (!name || !thumbnail_url) {
      return NextResponse.json(
        { error: 'Name and thumbnail_url are required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('templates')
      .insert({
        name,
        thumbnail_url,
        category: category || null,
        awareness_level: awareness_level || null,
        niche: niche || null,
        width: typeof width === 'number' && width > 0 ? width : null,
        height: typeof height === 'number' && height > 0 ? height : null,
        folder: typeof folder === 'string' && folder.trim() ? folder.trim() : null,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating template:', error);
      throw error;
    }

    return NextResponse.json({ success: true, template: data });
  } catch (error: any) {
    console.error('Error creating template:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create template' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const { userId } = await auth();
    const user = await currentUser();

    if (!userId || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userEmail = user.emailAddresses[0]?.emailAddress;
    if (!isAdminEmail(userEmail)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const templateId = searchParams.get('id');
    const folder = searchParams.get('folder');

    // Bulk-delete-by-ids mode: JSON body { ids: string[] }. Used by the
    // multi-select toolbar so the admin can wipe a hand-picked set in one
    // round trip instead of N parallel single-id calls.
    const ctype = req.headers.get('content-type') || '';
    if (!templateId && folder === null && ctype.includes('application/json')) {
      const body = await req.json().catch(() => ({} as any));
      const ids: string[] = Array.isArray(body?.ids)
        ? body.ids.filter((x: any) => typeof x === 'string' && x.length > 0)
        : [];
      if (ids.length > 0) {
        const { error, count } = await supabaseAdmin
          .from('templates')
          .delete()
          .in('id', ids)
          .select('*', { count: 'exact', head: true });
        if (error) {
          console.error('Error bulk deleting templates:', error);
          throw error;
        }
        return NextResponse.json({ success: true, deleted: count ?? ids.length });
      }
    }

    // Bulk-delete-by-folder mode: ?folder=<name>. Removes every template
    // tagged with that folder. Use folder=__none__ to nuke all rows that
    // have folder=NULL (the un-categorised bucket).
    if (folder !== null) {
      const folderName = folder === '__none__' ? null : folder;
      const builder = supabaseAdmin.from('templates').delete();
      const { error, count } = folderName === null
        ? await builder.is('folder', null).select('*', { count: 'exact', head: true })
        : await builder.eq('folder', folderName).select('*', { count: 'exact', head: true });
      if (error) {
        console.error('Error deleting folder:', error);
        throw error;
      }
      return NextResponse.json({ success: true, deleted: count ?? 0, folder: folderName });
    }

    if (!templateId) {
      return NextResponse.json(
        { error: 'Template ID or folder query is required' },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from('templates')
      .delete()
      .eq('id', templateId);

    if (error) {
      console.error('Error deleting template:', error);
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting template:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete template' },
      { status: 500 }
    );
  }
}


