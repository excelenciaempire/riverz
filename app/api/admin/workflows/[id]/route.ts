import { NextResponse } from 'next/server';
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/admin-auth';

const supabaseAdmin = createSupabaseAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

function dbError(stage: string, error: any) {
  console.error(`[WORKFLOWS_${stage}]`, error);
  return NextResponse.json(
    { error: error?.message || `Internal error in ${stage}`, code: error?.code },
    { status: 500 },
  );
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (!guard.ok) {
    const status = guard.reason === 'unauthenticated' ? 401 : 403;
    return new NextResponse(guard.reason || 'Forbidden', { status });
  }
  const { id } = await ctx.params;

  const { data, error } = await supabaseAdmin
    .from('workflow_designs')
    .select('*')
    .eq('id', id)
    .eq('clerk_user_id', guard.userId!)
    .maybeSingle();

  if (error) return dbError('GET_ONE', error);
  if (!data) return new NextResponse('Not found', { status: 404 });
  return NextResponse.json(data);
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (!guard.ok) {
    const status = guard.reason === 'unauthenticated' ? 401 : 403;
    return new NextResponse(guard.reason || 'Forbidden', { status });
  }
  const { id } = await ctx.params;
  const body = await req.json();

  const patch: Record<string, any> = { updated_at: new Date().toISOString() };
  if (typeof body.name === 'string') patch.name = body.name;
  if ('description' in body) patch.description = body.description;
  if (body.definition) patch.definition = body.definition;

  const { data, error } = await supabaseAdmin
    .from('workflow_designs')
    .update(patch)
    .eq('id', id)
    .eq('clerk_user_id', guard.userId!)
    .select()
    .single();

  if (error) return dbError('PUT', error);
  return NextResponse.json(data);
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (!guard.ok) {
    const status = guard.reason === 'unauthenticated' ? 401 : 403;
    return new NextResponse(guard.reason || 'Forbidden', { status });
  }
  const { id } = await ctx.params;

  const { error } = await supabaseAdmin
    .from('workflow_designs')
    .delete()
    .eq('id', id)
    .eq('clerk_user_id', guard.userId!);

  if (error) return dbError('DELETE', error);
  return NextResponse.json({ success: true });
}
