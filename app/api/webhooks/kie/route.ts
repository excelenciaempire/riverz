import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const STEALER_BUCKET = 'stealer';

/**
 * POST /api/webhooks/kie?secret=<STEALER_WEBHOOK_SECRET>
 *
 * kie.ai's Veo 3.1 generation calls this URL when a task completes (success or
 * failure). The body shape (per https://docs.kie.ai/runway-api/generate-ai-video-callbacks
 * and the Veo 3.1 docs) is loosely:
 *   { code: 200, msg: 'success', data: { taskId, info: { resultUrls, ... }, fallbackFlag } }
 *
 * Auth model: kie.ai doesn't sign the callback, so we use a shared `secret`
 * query param the worker put on the callBackUrl when creating the task.
 *
 * Behavior: find the matching `stealer_jobs` row by external_task_id, mark it
 * succeeded or failed, copy the MP4 into Supabase Storage, and queue a
 * `trim_to_duration` follow-up. This is essentially the inline version of
 * `worker/dispatchers/poll-veo.ts` — the worker's poll loop still runs as a
 * fallback for cases where the webhook never arrives.
 */
export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const expected = process.env.STEALER_WEBHOOK_SECRET;
    if (expected) {
      if (url.searchParams.get('secret') !== expected) {
        return new NextResponse('Forbidden', { status: 403 });
      }
    }

    const body: any = await req.json().catch(() => ({}));
    const taskId: string | undefined = body?.data?.taskId || body?.taskId;
    if (!taskId) {
      return NextResponse.json({ error: 'Missing taskId in body' }, { status: 400 });
    }

    const isSuccess = body?.code === 200 && (
      Array.isArray(body?.data?.info?.resultUrls) ||
      typeof body?.data?.info?.resultUrls === 'string' ||
      Array.isArray(body?.data?.resultUrls)
    );

    const { data: job, error: jobErr } = await supabaseAdmin
      .from('stealer_jobs')
      .select('*')
      .eq('external_task_id', taskId)
      .in('kind', ['generate_actor', 'generate_broll'])
      .maybeSingle();

    if (jobErr || !job) {
      console.warn('[webhooks/kie] no stealer_jobs row for taskId', taskId);
      // Still 200 so kie.ai doesn't keep retrying — log and move on.
      return NextResponse.json({ ok: true, ignored: true });
    }

    // Already terminal — nothing to do.
    if (job.status === 'succeeded' || job.status === 'failed') {
      return NextResponse.json({ ok: true, alreadyTerminal: true });
    }

    if (!isSuccess) {
      const reason = body?.msg || 'kie.ai callback reported failure';
      console.warn(`[webhooks/kie] task ${taskId} failed: ${reason}`);
      await supabaseAdmin
        .from('stealer_jobs')
        .update({ status: 'failed', error_message: reason })
        .eq('id', job.id);
      if (job.scene_id) {
        await supabaseAdmin
          .from('stealer_scenes')
          .update({ status: 'failed', error_message: 'Veo 3.1 generation failed' })
          .eq('id', job.scene_id);
      }
      return NextResponse.json({ ok: true });
    }

    // SUCCESS: pull the videoUrl out of the payload (handle both shapes).
    let videoUrl: string | null = null;
    const ru = body?.data?.info?.resultUrls ?? body?.data?.resultUrls;
    if (Array.isArray(ru) && ru.length > 0) videoUrl = String(ru[0]);
    else if (typeof ru === 'string') {
      try {
        const parsed = JSON.parse(ru);
        if (Array.isArray(parsed) && parsed.length > 0) videoUrl = String(parsed[0]);
        else if (typeof parsed === 'string') videoUrl = parsed;
      } catch {
        videoUrl = ru;
      }
    }

    if (!videoUrl) {
      return NextResponse.json({ error: 'No videoUrl in callback' }, { status: 400 });
    }

    // Download MP4 → upload to our bucket so the URL doesn't expire.
    const dl = await fetch(videoUrl);
    if (!dl.ok) {
      return NextResponse.json({ error: `Failed to download ${dl.status}` }, { status: 500 });
    }
    const buf = Buffer.from(await dl.arrayBuffer());
    const storagePath = `${job.project_id}/clips/raw_scene_${job.scene_id}.mp4`;

    const { error: upErr } = await supabaseAdmin.storage
      .from(STEALER_BUCKET)
      .upload(storagePath, buf, { contentType: 'video/mp4', upsert: true });
    if (upErr) {
      return NextResponse.json({ error: `Storage upload failed: ${upErr.message}` }, { status: 500 });
    }

    const assetKind = job.kind === 'generate_actor' ? 'actor_clip' : 'broll_clip';

    const { data: asset, error: assetErr } = await supabaseAdmin
      .from('stealer_assets')
      .insert({
        project_id: job.project_id,
        scene_id: job.scene_id,
        kind: assetKind,
        storage_path: storagePath,
        metadata: {
          sourceTaskId: taskId,
          veoFallback: !!body?.data?.fallbackFlag,
          veoResolution: body?.data?.info?.resolution || null,
          arrivedVia: 'webhook',
        },
      })
      .select('id')
      .single();
    if (assetErr) {
      return NextResponse.json({ error: `Asset insert failed: ${assetErr.message}` }, { status: 500 });
    }

    await supabaseAdmin
      .from('stealer_jobs')
      .update({ status: 'succeeded', result: { storagePath, taskId } })
      .eq('id', job.id);

    if (job.scene_id) {
      await supabaseAdmin
        .from('stealer_scenes')
        .update({ status: 'trimming' })
        .eq('id', job.scene_id);
    }

    // Queue trim follow-up so the worker brings duration to scene target.
    await supabaseAdmin.from('stealer_jobs').insert({
      project_id: job.project_id,
      scene_id: job.scene_id,
      kind: 'trim_to_duration',
      payload: { sceneId: job.scene_id, assetId: asset.id, sourcePath: storagePath },
    });

    return NextResponse.json({ ok: true, sceneId: job.scene_id });
  } catch (error: any) {
    console.error('[webhooks/kie] error:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
