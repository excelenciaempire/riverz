import { NextResponse } from 'next/server';
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/admin-auth';
import { EMPTY_WORKFLOW } from '@/lib/workflows/types';

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

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) {
    const status = guard.reason === 'unauthenticated' ? 401 : 403;
    return new NextResponse(guard.reason || 'Forbidden', { status });
  }

  const { data, error } = await supabaseAdmin
    .from('workflow_designs')
    .select('id, name, description, definition, created_at, updated_at')
    .eq('clerk_user_id', guard.userId!)
    .order('updated_at', { ascending: false });

  if (error) return dbError('GET', error);
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) {
    const status = guard.reason === 'unauthenticated' ? 401 : 403;
    return new NextResponse(guard.reason || 'Forbidden', { status });
  }

  const body = await req.json().catch(() => ({}));
  const name = (body.name as string) || 'Workflow sin nombre';
  const description = (body.description as string) || null;
  const definition = body.definition || EMPTY_WORKFLOW;

  const { data, error } = await supabaseAdmin
    .from('workflow_designs')
    .insert({
      clerk_user_id: guard.userId!,
      name,
      description,
      definition,
    })
    .select()
    .single();

  if (error) return dbError('POST', error);
  return NextResponse.json(data);
}
