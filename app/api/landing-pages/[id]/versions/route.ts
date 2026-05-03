/**
 * Version history para una página.
 * - GET  /api/landing-pages/{id}/versions       → lista (newest first)
 * - POST /api/landing-pages/{id}/versions       → snapshot manual ("Save Version")
 *   Body: { document, label? }
 *
 * Restore se hace desde el editor: leyendo una version y mandando PATCH a
 * la fila padre con `document = <esa version>`.
 */

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/server';
import type { PageDocument } from '@/types/landing-pages';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureOwner(id: string, userId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('landing_pages')
    .select('clerk_user_id')
    .eq('id', id)
    .maybeSingle();
  if (error) return { ok: false as const, status: 500, msg: error.message };
  if (!data || data.clerk_user_id !== userId)
    return { ok: false as const, status: 404, msg: 'Not found' };
  return { ok: true as const };
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const own = await ensureOwner(id, userId);
  if (!own.ok) return NextResponse.json({ error: own.msg }, { status: own.status });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('landing_page_versions')
    .select('id, source, label, created_at')
    .eq('page_id', id)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ versions: data ?? [] });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const own = await ensureOwner(id, userId);
  if (!own.ok) return NextResponse.json({ error: own.msg }, { status: own.status });

  let body: { document?: PageDocument; label?: string } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 });
  }
  if (!body.document) return NextResponse.json({ error: 'Falta document' }, { status: 400 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('landing_page_versions')
    .insert({ page_id: id, document: body.document, source: 'manual', label: body.label ?? null })
    .select('id, created_at')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ version: data });
}
