import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const MAX_DATA_BYTES = 5 * 1024 * 1024;

type ProjectRow = {
  id: string;
  clerk_user_id: string;
  name: string;
  angle: string | null;
  cta_url: string | null;
  template_id: string | null;
  project_data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

// GET /api/landing-lab/projects/[id]
// Reads a single project owned by the authed user. Returns 404 (not 403)
// for projects owned by someone else so we don't leak existence — the
// surface is identical to "no such project".
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('landing_lab_projects')
    .select('id, clerk_user_id, name, angle, cta_url, template_id, project_data, created_at, updated_at')
    .eq('id', id)
    .eq('clerk_user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('[landing-lab/projects/:id][GET] supabase error:', error);
    return NextResponse.json({ error: 'No se pudo leer el proyecto: ' + error.message }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });

  return NextResponse.json({ project: rowToClient(data as ProjectRow) });
}

// PUT /api/landing-lab/projects/[id]
// Replaces the project's editable fields. Called by the editor on every
// debounced save (every ~700ms during active typing) so it must be fast.
// The .eq('clerk_user_id', userId) clause prevents one user from
// overwriting another user's project even if they guess the id.
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 });

  let body: any;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Body inválido (JSON requerido)' }, { status: 400 }); }

  const update: Record<string, unknown> = {};
  if (typeof body?.name === 'string') update.name = body.name.slice(0, 200) || 'Sin nombre';
  if (typeof body?.angle === 'string') update.angle = body.angle.slice(0, 500);
  if (typeof body?.cta_url === 'string' || typeof body?.ctaUrl === 'string') {
    update.cta_url = (body.cta_url ?? body.ctaUrl)?.toString().slice(0, 1000) ?? null;
  }
  if (typeof body?.template_id === 'string' || typeof body?.templateId === 'string') {
    update.template_id = (body.template_id ?? body.templateId)?.toString().slice(0, 100) ?? null;
  }
  if (isPlainObject(body?.project_data) || isPlainObject(body?.projectData)) {
    const projectData = (body.project_data ?? body.projectData) as Record<string, unknown>;
    const sizeCheck = checkProjectDataSize(projectData);
    if (!sizeCheck.ok) return NextResponse.json({ error: sizeCheck.error }, { status: 413 });
    update.project_data = projectData;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('landing_lab_projects')
    .update(update)
    .eq('id', id)
    .eq('clerk_user_id', userId)
    .select('id, clerk_user_id, name, angle, cta_url, template_id, project_data, created_at, updated_at')
    .maybeSingle();

  if (error) {
    console.error('[landing-lab/projects/:id][PUT] supabase error:', error);
    return NextResponse.json({ error: 'No se pudo guardar: ' + error.message }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });

  return NextResponse.json({ project: rowToClient(data as ProjectRow) });
}

// DELETE /api/landing-lab/projects/[id]
// Removes a project. "Mis páginas" calls this for the bulk-delete UI.
// Server-only — the editor never deletes its own project (we don't want
// a stray bug to drop the only copy).
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 });

  const supabase = createAdminClient();
  const { error, count } = await supabase
    .from('landing_lab_projects')
    .delete({ count: 'exact' })
    .eq('id', id)
    .eq('clerk_user_id', userId);

  if (error) {
    console.error('[landing-lab/projects/:id][DELETE] supabase error:', error);
    return NextResponse.json({ error: 'No se pudo eliminar: ' + error.message }, { status: 500 });
  }
  if ((count ?? 0) === 0) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });

  return NextResponse.json({ ok: true });
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function checkProjectDataSize(data: Record<string, unknown>): { ok: true } | { ok: false; error: string } {
  let size = 0;
  try { size = JSON.stringify(data).length; } catch { return { ok: false, error: 'project_data no es JSON serializable' }; }
  if (size > MAX_DATA_BYTES) {
    return { ok: false, error: `project_data demasiado grande (${Math.round(size/1024)}KB > ${Math.round(MAX_DATA_BYTES/1024)}KB)` };
  }
  return { ok: true };
}

function rowToClient(r: ProjectRow) {
  const data = (r.project_data || {}) as Record<string, unknown>;
  return {
    id: r.id,
    name: r.name,
    angle: r.angle || '',
    ctaUrl: r.cta_url || '',
    templateId: r.template_id || undefined,
    texts: (data.texts as Record<string, string>) || {},
    images: (data.images as Record<string, unknown>) || {},
    videos: (data.videos as Record<string, unknown>) || {},
    imageSizes: (data.imageSizes as Record<string, unknown>) || {},
    imageShapes: (data.imageShapes as Record<string, unknown>) || {},
    imageStyles: (data.imageStyles as Record<string, unknown>) || {},
    videoSizes: (data.videoSizes as Record<string, unknown>) || {},
    layoutOrder: (data.layoutOrder as Record<string, unknown>) || null,
    globalFont: typeof data.globalFont === 'string' ? (data.globalFont as string) : '',
    html: typeof data.html === 'string' ? (data.html as string) : null,
    updatedAt: r.updated_at,
    createdAt: r.created_at,
  };
}
