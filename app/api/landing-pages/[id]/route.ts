/**
 * Landing Pages V2 — single page CRUD.
 *
 * - GET    /api/landing-pages/{id}        → carga la página + producto opcional
 * - PATCH  /api/landing-pages/{id}        → autosave; acepta { document?, name?, status?, product_id? }
 * - DELETE /api/landing-pages/{id}        → borra (cascade borra versions)
 *
 * Autosave del editor manda PATCH con `{ document }` cada ~1.5s.
 */

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/server';
import type { PageDocument } from '@/types/landing-pages';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface PatchBody {
  document?: PageDocument;
  name?: string;
  status?: 'draft' | 'published';
  product_id?: string | null;
  /**
   * Si true, además de actualizar la fila se persiste un snapshot en
   * landing_page_versions con source='auto'. El editor lo manda cada N
   * minutos para no inflar la tabla con cada keystroke.
   */
  snapshot?: boolean;
}

async function ensureOwner(id: string, userId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('landing_pages')
    .select('clerk_user_id')
    .eq('id', id)
    .maybeSingle();
  if (error) return { ok: false as const, status: 500, msg: error.message };
  if (!data) return { ok: false as const, status: 404, msg: 'Not found' };
  if (data.clerk_user_id !== userId) return { ok: false as const, status: 403, msg: 'Forbidden' };
  return { ok: true as const };
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('landing_pages')
    .select('id, name, kind, status, document, product_id, thumbnail_url, created_at, updated_at, clerk_user_id')
    .eq('id', id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (data.clerk_user_id !== userId)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  return NextResponse.json({ page: data });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const own = await ensureOwner(id, userId);
  if (!own.ok) return NextResponse.json({ error: own.msg }, { status: own.status });

  let body: PatchBody = {};
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (body.document) update.document = body.document;
  if (typeof body.name === 'string') update.name = body.name.trim();
  if (body.status) update.status = body.status;
  if (body.product_id !== undefined) update.product_id = body.product_id;

  if (Object.keys(update).length === 0)
    return NextResponse.json({ ok: true, noop: true });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('landing_pages')
    .update(update)
    .eq('id', id)
    .select('id, updated_at, status')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Optional: snapshot the document into versions. Best-effort; failure
  // here doesn't fail the autosave.
  if (body.snapshot && body.document) {
    await supabase
      .from('landing_page_versions')
      .insert({ page_id: id, document: body.document, source: 'auto' })
      .then(({ error: vErr }) => {
        if (vErr) console.warn('[landing-pages] snapshot failed', vErr);
      });
  }

  return NextResponse.json({ ok: true, page: data });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const own = await ensureOwner(id, userId);
  if (!own.ok) return NextResponse.json({ error: own.msg }, { status: own.status });

  const supabase = createAdminClient();
  const { error } = await supabase.from('landing_pages').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
