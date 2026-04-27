import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const STEALER_BUCKET = 'stealer';
const SIGNED_URL_TTL_SEC = 60 * 60; // 1 hour

interface Params {
  params: { id: string };
}

/**
 * GET /api/stealer/projects/[id]
 * Returns the project + scenes + assets, with signed URLs ready for the UI.
 */
export async function GET(_req: Request, { params }: Params) {
  try {
    const { userId } = await auth();
    if (!userId) return new NextResponse('Unauthorized', { status: 401 });

    const projectId = params.id;

    const { data: project, error: pErr } = await supabaseAdmin
      .from('stealer_projects')
      .select('*')
      .eq('id', projectId)
      .eq('clerk_user_id', userId)
      .single();

    if (pErr || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const [{ data: scenes }, { data: assets }, { data: jobs }] = await Promise.all([
      supabaseAdmin
        .from('stealer_scenes')
        .select('*')
        .eq('project_id', projectId)
        .order('scene_index'),
      supabaseAdmin
        .from('stealer_assets')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at'),
      supabaseAdmin
        .from('stealer_jobs')
        .select('id, kind, status, attempts, error_message, updated_at')
        .eq('project_id', projectId)
        .order('created_at'),
    ]);

    // Sign storage paths so the browser can render them.
    const signed = await signAll(
      [
        ...(scenes || []).flatMap((s) => [s.keyframe_path, s.audio_segment_path]),
        ...(assets || []).map((a) => a.storage_path),
        project.source_video_path,
        project.master_audio_path,
      ].filter((p): p is string => !!p)
    );

    const decorate = <T extends Record<string, any>>(row: T, paths: (keyof T)[]): T => {
      const out: any = { ...row };
      for (const p of paths) {
        const v = row[p];
        if (typeof v === 'string' && signed[v]) out[`${String(p)}_signed_url`] = signed[v];
      }
      return out as T;
    };

    return NextResponse.json({
      project: decorate(project, ['source_video_path', 'master_audio_path']),
      scenes: (scenes || []).map((s) => decorate(s, ['keyframe_path', 'audio_segment_path'])),
      assets: (assets || []).map((a) => decorate(a, ['storage_path'])),
      jobs: jobs || [],
    });
  } catch (error: any) {
    console.error('[stealer/projects] error:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}

async function signAll(paths: string[]): Promise<Record<string, string>> {
  const unique = Array.from(new Set(paths));
  if (unique.length === 0) return {};

  const { data, error } = await supabaseAdmin.storage
    .from(STEALER_BUCKET)
    .createSignedUrls(unique, SIGNED_URL_TTL_SEC);

  if (error || !data) {
    console.warn('[stealer/projects] signed URL batch failed:', error?.message);
    return {};
  }

  const out: Record<string, string> = {};
  data.forEach((entry) => {
    if (entry.signedUrl && entry.path) out[entry.path] = entry.signedUrl;
  });
  return out;
}
