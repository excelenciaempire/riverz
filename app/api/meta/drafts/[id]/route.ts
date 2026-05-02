import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/meta-route-helpers';
import type { AdDraft, AdDraftRow, AdDraftStatus, LaunchResponse } from '@/types/meta';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function loadDraft(id: string, userId: string) {
  return await supabaseAdmin
    .from('ad_drafts')
    .select('*')
    .eq('id', id)
    .eq('clerk_user_id', userId)
    .maybeSingle();
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  const { data, error } = await loadDraft(id, userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  return NextResponse.json({ draft: data as AdDraft });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  let body: {
    name?: string;
    rows?: AdDraftRow[];
    status?: AdDraftStatus;
    result?: LaunchResponse | null;
    launched_at?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.name === 'string') update.name = body.name;
  if (Array.isArray(body.rows)) update.rows = body.rows;
  if (typeof body.status === 'string') update.status = body.status;
  if (body.result !== undefined) update.result = body.result;
  if (body.launched_at !== undefined) update.launched_at = body.launched_at;

  const { data, error } = await supabaseAdmin
    .from('ad_drafts')
    .update(update)
    .eq('id', id)
    .eq('clerk_user_id', userId)
    .select('*')
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  return NextResponse.json({ draft: data as AdDraft });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  const { error } = await supabaseAdmin
    .from('ad_drafts')
    .delete()
    .eq('id', id)
    .eq('clerk_user_id', userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
