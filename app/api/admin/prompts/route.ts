import { NextResponse } from 'next/server';
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/admin-auth';

// Service-role client. requireAdmin() already gates access by Clerk + admin
// allowlist, so we bypass RLS here — the prior anon-key client was failing
// every UPDATE/INSERT/DELETE against ai_prompts because RLS blocks writes
// from non-service-role sessions, even for the page owner.
const supabaseAdmin = createSupabaseAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Surface the DB error message in the response so the admin UI can show
// something useful instead of a generic 500. Only safe because every handler
// is gated by requireAdmin() — a leaked stack trace here is not a public risk.
function dbError(stage: string, error: any) {
  console.error(`[PROMPTS_${stage}]`, error);
  return NextResponse.json(
    { error: error?.message || `Internal error in ${stage}`, code: error?.code, details: error?.details },
    { status: 500 },
  );
}

// GET - Fetch all prompts
export async function GET() {
  try {
    const guard = await requireAdmin();
    if (!guard.ok) {
      const status = guard.reason === 'unauthenticated' ? 401 : 403;
      return new NextResponse(guard.reason || 'Forbidden', { status });
    }

    const { data: prompts, error } = await supabaseAdmin
      .from('ai_prompts')
      .select('*')
      .order('category', { ascending: true })
      .order('name', { ascending: true });

    if (error) return dbError('GET', error);
    return NextResponse.json(prompts);
  } catch (error: any) {
    return dbError('GET', error);
  }
}

// POST - Create new prompt
export async function POST(req: Request) {
  try {
    const guard = await requireAdmin();
    if (!guard.ok) {
      const status = guard.reason === 'unauthenticated' ? 401 : 403;
      return new NextResponse(guard.reason || 'Forbidden', { status });
    }

    const body = await req.json();
    const { key, name, category, prompt_text, description, variables, is_active } = body;

    if (!key || !name || !category || !prompt_text) {
      return NextResponse.json({ error: 'Missing required fields (key, name, category, prompt_text)' }, { status: 400 });
    }

    const { data: prompt, error } = await supabaseAdmin
      .from('ai_prompts')
      .insert({
        key,
        name,
        category,
        prompt_text,
        description,
        variables: variables || [],
        is_active: is_active ?? true,
      })
      .select()
      .single();

    if (error) return dbError('POST', error);
    return NextResponse.json(prompt);
  } catch (error: any) {
    return dbError('POST', error);
  }
}

// PATCH - Update prompt
export async function PATCH(req: Request) {
  try {
    const guard = await requireAdmin();
    if (!guard.ok) {
      const status = guard.reason === 'unauthenticated' ? 401 : 403;
      return new NextResponse(guard.reason || 'Forbidden', { status });
    }

    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing prompt ID' }, { status: 400 });
    }

    // updated_at column may or may not have a trigger; bump it explicitly so
    // the UI's "última edición" reflects the change.
    const patch = { ...updates, updated_at: new Date().toISOString() };

    const { data: prompt, error } = await supabaseAdmin
      .from('ai_prompts')
      .update(patch)
      .eq('id', id)
      .select()
      .single();

    if (error) return dbError('PATCH', error);
    return NextResponse.json(prompt);
  } catch (error: any) {
    return dbError('PATCH', error);
  }
}

// DELETE - Delete prompt
export async function DELETE(req: Request) {
  try {
    const guard = await requireAdmin();
    if (!guard.ok) {
      const status = guard.reason === 'unauthenticated' ? 401 : 403;
      return new NextResponse(guard.reason || 'Forbidden', { status });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing prompt ID' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('ai_prompts')
      .delete()
      .eq('id', id);

    if (error) return dbError('DELETE', error);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return dbError('DELETE', error);
  }
}
