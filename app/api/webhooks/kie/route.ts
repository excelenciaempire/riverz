import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const STEALER_BUCKET = 'stealer';
const GENERATIONS_BUCKET = 'generations';

/**
 * POST /api/webhooks/kie?secret=<STEALER_WEBHOOK_SECRET>
 *
 * kie.ai's Veo 3.1 generation calls this URL when a task completes (success or
 * failure). Body shape per https://docs.kie.ai/veo3-api/generate-veo-3-video-callbacks:
 *   { code: 200|400|422|500|501,
 *     msg: '...',
 *     data: { taskId, info: { resultUrls: [...], originUrls: [...], resolution },
 *             fallbackFlag } }
 *
 * Auth: kie.ai doesn't sign callbacks, so we use a shared `secret` query param.
 *
 * Routing: a single taskId belongs to either the Stealer pipeline (`stealer_jobs`)
 * or the UGC chat pipeline (`generations` with input_data.veoTaskId). We try
 * stealer first, then UGC.
 */
export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const expected = process.env.STEALER_WEBHOOK_SECRET || process.env.KIE_WEBHOOK_SECRET;
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

    const { data: stealerJob } = await supabaseAdmin
      .from('stealer_jobs')
      .select('*')
      .eq('external_task_id', taskId)
      .in('kind', ['generate_actor', 'generate_broll'])
      .maybeSingle();

    if (stealerJob) {
      return await handleStealerCallback(stealerJob, body, taskId);
    }

    const { data: generation } = await supabaseAdmin
      .from('generations')
      .select('*')
      .eq('type', 'ugc_video')
      .filter('input_data->>veoTaskId', 'eq', taskId)
      .maybeSingle();

    if (generation) {
      return await handleUgcCallback(generation, body, taskId);
    }

    console.warn('[webhooks/kie] no row found for taskId', taskId);
    // Always 200 so kie.ai stops retrying.
    return NextResponse.json({ ok: true, ignored: true });
  } catch (error: any) {
    console.error('[webhooks/kie] error:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}

function extractVideoUrl(body: any): string | null {
  const ru = body?.data?.info?.resultUrls ?? body?.data?.resultUrls;
  if (Array.isArray(ru) && ru.length > 0) return String(ru[0]);
  if (typeof ru === 'string') {
    try {
      const parsed = JSON.parse(ru);
      if (Array.isArray(parsed) && parsed.length > 0) return String(parsed[0]);
      if (typeof parsed === 'string') return parsed;
    } catch {
      return ru;
    }
  }
  return null;
}

async function handleStealerCallback(job: any, body: any, taskId: string) {
  if (job.status === 'succeeded' || job.status === 'failed') {
    return NextResponse.json({ ok: true, alreadyTerminal: true });
  }

  const videoUrl = body?.code === 200 ? extractVideoUrl(body) : null;
  if (!videoUrl) {
    const reason = body?.msg || 'kie.ai callback reported failure';
    console.warn(`[webhooks/kie] stealer task ${taskId} failed: ${reason}`);
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

  await supabaseAdmin.from('stealer_jobs').insert({
    project_id: job.project_id,
    scene_id: job.scene_id,
    kind: 'trim_to_duration',
    payload: { sceneId: job.scene_id, assetId: asset.id, sourcePath: storagePath },
  });

  return NextResponse.json({ ok: true, sceneId: job.scene_id });
}

async function handleUgcCallback(generation: any, body: any, taskId: string) {
  if (generation.status === 'completed' || generation.status === 'failed') {
    return NextResponse.json({ ok: true, alreadyTerminal: true });
  }

  const videoUrl = body?.code === 200 ? extractVideoUrl(body) : null;
  if (!videoUrl) {
    const reason = body?.msg || `kie.ai callback reported failure (code=${body?.code})`;
    console.warn(`[webhooks/kie] ugc task ${taskId} failed: ${reason}`);
    await supabaseAdmin
      .from('generations')
      .update({
        status: 'failed',
        error_message: reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', generation.id);
    return NextResponse.json({ ok: true });
  }

  let resultUrl = videoUrl;
  try {
    const dl = await fetch(videoUrl);
    if (dl.ok) {
      const buf = Buffer.from(await dl.arrayBuffer());
      const fileName = `${generation.project_id}/${generation.id}_${Date.now()}.mp4`;
      const { error: upErr } = await supabaseAdmin.storage
        .from(GENERATIONS_BUCKET)
        .upload(fileName, buf, { contentType: 'video/mp4', upsert: true });
      if (!upErr) {
        const { data } = supabaseAdmin.storage.from(GENERATIONS_BUCKET).getPublicUrl(fileName);
        if (data?.publicUrl) resultUrl = data.publicUrl;
      }
    }
  } catch (err: any) {
    console.warn(`[webhooks/kie] ugc storage copy failed for ${generation.id}, falling back to kie url:`, err?.message || err);
  }

  await supabaseAdmin
    .from('generations')
    .update({
      status: 'completed',
      result_url: resultUrl,
      error_message: null,
      input_data: {
        ...(generation.input_data || {}),
        veoFallback: !!body?.data?.fallbackFlag,
        veoResolution: body?.data?.info?.resolution || null,
        arrivedVia: 'webhook',
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', generation.id);

  return NextResponse.json({ ok: true, generationId: generation.id });
}
