import { auth, currentUser } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAdminEmail } from '@/lib/admin-emails';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

/**
 * PATCH /api/admin/templates/bulk-folder
 *
 * Body: { ids: string[], folder: string | null }
 *
 * Moves every template in `ids` to the given folder. `folder = null`
 * removes the folder tag (sends them back to "Sin carpeta").
 */
export async function PATCH(req: Request) {
  try {
    const { userId } = await auth();
    const user = await currentUser();
    if (!userId || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userEmail = user.emailAddresses[0]?.emailAddress;
    if (!isAdminEmail(userEmail)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const ids: string[] = Array.isArray(body?.ids) ? body.ids.filter((x: any) => typeof x === 'string') : [];
    const rawFolder = body?.folder;
    const folder: string | null = rawFolder === null
      ? null
      : typeof rawFolder === 'string' && rawFolder.trim()
        ? rawFolder.trim()
        : null;

    if (ids.length === 0) {
      return NextResponse.json({ error: 'ids array required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('templates')
      .update({ folder, updated_at: new Date().toISOString() })
      .in('id', ids)
      .select('id');

    if (error) {
      console.error('[bulk-folder] update error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, moved: data?.length || 0, folder });
  } catch (error: any) {
    console.error('[bulk-folder] error:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
