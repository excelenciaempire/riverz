import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit, RATE_LIMITS } from '@/lib/security';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const STEALER_BUCKET = 'stealer';
const MAX_VIDEO_BYTES = 500 * 1024 * 1024; // 500 MB
const ALLOWED_VIDEO_MIMES = new Set([
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/x-m4v',
]);

/**
 * POST /api/stealer/ingest
 *
 * Two ways to start a project:
 *   1. multipart/form-data with `file` (the source MP4) and optional `name`.
 *   2. application/json with `{ "source_url": "...", "name": "..." }`.
 *
 * In both cases we:
 *   - create a `stealer_projects` row
 *   - upload the file (if provided) to bucket "stealer/{projectId}/source.mp4"
 *   - enqueue an `extract_audio` job in `stealer_jobs`
 *
 * The worker takes it from there. URL-based ingestion is queued but the
 * actual download happens in the worker (Phase 0 ships file uploads only;
 * url-fetching lands in a follow-up commit).
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return new NextResponse('Unauthorized', { status: 401 });

    const rl = await rateLimit(`stealer-ingest:${userId}`, RATE_LIMITS.generation.limit, RATE_LIMITS.generation.windowMs);
    if (!rl.success) {
      return NextResponse.json({ error: 'Demasiadas solicitudes. Intenta en un momento.' }, { status: 429 });
    }

    const contentType = req.headers.get('content-type') || '';

    let projectName: string | null = null;
    let sourceUrl: string | null = null;
    let fileBuffer: ArrayBuffer | null = null;
    let fileMime = 'video/mp4';
    let selectedAvatarId: string | null = null;
    let selectedVoiceId: string | null = null;

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      const file = form.get('file');
      projectName = (form.get('name') as string) || null;
      selectedAvatarId = (form.get('avatar_id') as string) || null;
      selectedVoiceId = (form.get('voice_id') as string) || null;
      if (!(file instanceof File)) {
        return NextResponse.json({ error: 'Missing file' }, { status: 400 });
      }
      if (file.size > MAX_VIDEO_BYTES) {
        return NextResponse.json({ error: 'File too large (max 500 MB)' }, { status: 413 });
      }
      const declaredMime = (file.type || '').toLowerCase();
      if (!ALLOWED_VIDEO_MIMES.has(declaredMime)) {
        return NextResponse.json(
          { error: `Unsupported file type "${declaredMime || 'unknown'}". Allowed: ${[...ALLOWED_VIDEO_MIMES].join(', ')}` },
          { status: 415 }
        );
      }
      fileBuffer = await file.arrayBuffer();
      fileMime = declaredMime;
    } else {
      const body = await req.json().catch(() => ({}));
      projectName = body?.name || null;
      sourceUrl = body?.source_url || null;
      selectedAvatarId = body?.avatar_id || null;
      selectedVoiceId = body?.voice_id || null;
      if (!sourceUrl) {
        return NextResponse.json(
          { error: 'Missing file or source_url' },
          { status: 400 }
        );
      }
    }

    // Create the project row first so we have an id for the storage path.
    const { data: project, error: projErr } = await supabaseAdmin
      .from('stealer_projects')
      .insert({
        clerk_user_id: userId,
        name: projectName,
        source_url: sourceUrl,
        selected_avatar_id: selectedAvatarId || null,
        selected_voice_id: selectedVoiceId || null,
        status: 'ingesting',
      })
      .select('id')
      .single();

    if (projErr || !project) {
      console.error('[stealer/ingest] project insert failed:', projErr);
      return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
    }

    let sourceVideoPath: string | null = null;

    if (fileBuffer) {
      sourceVideoPath = `${project.id}/source.mp4`;
      const { error: upErr } = await supabaseAdmin.storage
        .from(STEALER_BUCKET)
        .upload(sourceVideoPath, fileBuffer, { contentType: fileMime, upsert: true });
      if (upErr) {
        console.error('[stealer/ingest] upload failed:', upErr);
        await supabaseAdmin.from('stealer_projects').delete().eq('id', project.id);
        return NextResponse.json({ error: 'Failed to upload source video' }, { status: 500 });
      }

      await supabaseAdmin
        .from('stealer_projects')
        .update({ source_video_path: sourceVideoPath })
        .eq('id', project.id);
    }

    // Enqueue the first job. If the user gave a URL only, the worker will need
    // a yt-dlp/fetch_url kind first — for Phase 0 we require an uploaded file.
    if (sourceVideoPath) {
      const { error: jobErr } = await supabaseAdmin.from('stealer_jobs').insert({
        project_id: project.id,
        kind: 'extract_audio',
      });
      if (jobErr) {
        console.error('[stealer/ingest] enqueue failed:', jobErr);
        return NextResponse.json({ error: 'Failed to enqueue first job' }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      projectId: project.id,
      sourceVideoPath,
      sourceUrl,
      status: sourceVideoPath ? 'ingesting' : 'awaiting_url_fetch',
    });
  } catch (error: any) {
    console.error('[stealer/ingest] error:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
