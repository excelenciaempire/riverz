import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Editor PUTs come in fast (debounced 700ms). The list endpoint is a
// simple SELECT — keep the default short maxDuration; the heavy lift
// is project_data serialization on PUT.
export const maxDuration = 30;

// project_data is the full editor state (texts, images map, videos,
// imageSizes/Shapes/Styles, videoSizes, layoutOrder). Cap to ~5MB so a
// runaway client can't fill up the table — the data is just JSON refs to
// Supabase Storage URLs in practice, so 5MB is *very* generous.
const MAX_DATA_BYTES = 5 * 1024 * 1024;

type ProjectRow = {
  id: string;
  name: string;
  angle: string | null;
  cta_url: string | null;
  template_id: string | null;
  project_data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

// GET /api/landing-lab/projects
// Lists every project owned by the authed user, newest first by
// updated_at so "continuá donde lo dejaste" actually shows the most
// recent edits at the top of "Mis páginas".
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('landing_lab_projects')
    .select('id, name, angle, cta_url, template_id, project_data, created_at, updated_at')
    .eq('clerk_user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('[landing-lab/projects][GET] supabase error:', error);
    return NextResponse.json({ error: 'No se pudo leer la lista de proyectos: ' + error.message }, { status: 500 });
  }

  return NextResponse.json({ projects: (data || []).map(rowToClient) });
}

// POST /api/landing-lab/projects
// Creates a new project owned by the authed user. The editor calls this
// once on "Usar plantilla" / "Generar" / explicit clone. We accept an
// optional client-supplied id (so the editor can use its own 'p'+base36
// scheme and keep history dictionaries keyed off it) but always overwrite
// clerk_user_id with the authed value — never trust the client there.
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: any;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Body inválido (JSON requerido)' }, { status: 400 }); }

  const id = typeof body?.id === 'string' && body.id.trim()
    ? body.id.trim().slice(0, 64)
    : 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const name = typeof body?.name === 'string' && body.name.trim()
    ? body.name.trim().slice(0, 200)
    : 'Nueva Landing';
  const angle = typeof body?.angle === 'string' ? body.angle.slice(0, 500) : null;
  const ctaUrl = typeof body?.cta_url === 'string' ? body.cta_url.slice(0, 1000)
    : typeof body?.ctaUrl === 'string' ? body.ctaUrl.slice(0, 1000)
    : null;
  const templateId = typeof body?.template_id === 'string' ? body.template_id.slice(0, 100)
    : typeof body?.templateId === 'string' ? body.templateId.slice(0, 100)
    : null;
  const projectData = isPlainObject(body?.project_data) ? body.project_data
    : isPlainObject(body?.projectData) ? body.projectData
    : {};

  const sizeCheck = checkProjectDataSize(projectData);
  if (!sizeCheck.ok) return NextResponse.json({ error: sizeCheck.error }, { status: 413 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('landing_lab_projects')
    .insert({
      id,
      clerk_user_id: userId,
      name,
      angle,
      cta_url: ctaUrl,
      template_id: templateId,
      project_data: projectData,
    })
    .select('id, name, angle, cta_url, template_id, project_data, created_at, updated_at')
    .single();

  if (error) {
    // Most likely failure: a primary-key collision because the editor
    // optimistically reused an id. Surface that distinctly so the client
    // can retry with a fresh id instead of treating it as a generic 500.
    const msg = error.message || String(error);
    const isDup = /duplicate key|already exists/i.test(msg);
    console.error('[landing-lab/projects][POST] supabase error:', msg);
    return NextResponse.json(
      { error: isDup ? 'Ya existe un proyecto con ese id' : 'No se pudo crear el proyecto: ' + msg },
      { status: isDup ? 409 : 500 },
    );
  }

  return NextResponse.json({ project: rowToClient(data as ProjectRow) }, { status: 201 });
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
  // Shape returned to the editor: same field names the editor already
  // expects on the in-memory project object (id / name / angle /
  // ctaUrl / templateId / texts / images / videos / ...). project_data
  // gets spread back as the top-level state slots so the editor doesn't
  // need a translation layer.
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
    // Captured #page-wrap HTML so palette-dropped blocks survive reload.
    html: typeof data.html === 'string' ? (data.html as string) : null,
    updatedAt: r.updated_at,
    createdAt: r.created_at,
  };
}
