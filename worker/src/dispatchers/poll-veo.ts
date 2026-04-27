import path from 'node:path';
import fs from 'node:fs/promises';
import { supabase } from '../lib/supabase.js';
import { getVeoTask, fetchToBuffer } from '../lib/kie-video.js';
import {
  ensureProjectTmp,
  uploadToStorage,
  recordAsset,
} from '../lib/storage.js';
import { config } from '../config.js';
import { StealerJob } from '../lib/types.js';
import { enqueueJob, markJobSucceeded } from '../lib/jobs.js';

/**
 * For ONE waiting_callback job that originated from generate_actor / generate_broll:
 * ask kie.ai whether the Veo 3.1 task is done. If yes, copy the video into our
 * Storage and queue a trim_to_duration follow-up. If failed, mark the scene failed.
 */
export async function pollVeoJob(job: StealerJob): Promise<{ done: boolean; reason?: string }> {
  if (!job.external_task_id) return { done: false, reason: 'no external_task_id' };
  if (!job.scene_id || !job.project_id) return { done: false, reason: 'missing ids' };
  if (job.kind !== 'generate_actor' && job.kind !== 'generate_broll') return { done: false, reason: 'unsupported kind' };

  const sb = supabase();
  const status = await getVeoTask(job.external_task_id);

  if (status.status === 'generating') return { done: false, reason: 'still generating' };

  if (status.status === 'failed') {
    console.warn(`[poll-veo] Task ${job.external_task_id} failed (kie code=${status.rawCode})`);
    await sb
      .from('stealer_jobs')
      .update({ status: 'failed', error_message: `Veo failed (code=${status.rawCode})` })
      .eq('id', job.id);
    await sb
      .from('stealer_scenes')
      .update({ status: 'failed', error_message: 'Veo 3.1 generation failed' })
      .eq('id', job.scene_id);
    return { done: true, reason: 'failed' };
  }

  // SUCCESS
  if (!status.videoUrl) {
    console.warn(`[poll-veo] Task ${job.external_task_id} reported success but no videoUrl`);
    return { done: false, reason: 'success without url' };
  }

  // Pull the MP4 into our Storage so the URL doesn't expire and signed URLs work.
  const tmp = await ensureProjectTmp(job.project_id);
  const localPath = path.join(tmp, `clip_${job.scene_id}.mp4`);
  const buf = await fetchToBuffer(status.videoUrl);
  await fs.writeFile(localPath, buf);

  const storagePath = `${job.project_id}/clips/raw_scene_${job.scene_id}.mp4`;
  await uploadToStorage(localPath, storagePath, 'video/mp4');

  // Determine asset kind from job kind.
  const assetKind = job.kind === 'generate_actor' ? 'actor_clip' : 'broll_clip';

  const assetId = await recordAsset({
    projectId: job.project_id,
    sceneId: job.scene_id,
    kind: assetKind,
    storagePath,
    metadata: {
      sourceTaskId: job.external_task_id,
      veoFallback: status.fallback,
      veoResolution: status.resolution,
    },
  });

  // Mark this job done; the trim job will re-flip scene.status to 'completed'.
  await markJobSucceeded(job.id, { storagePath, assetId, taskId: job.external_task_id });
  await sb.from('stealer_scenes').update({ status: 'trimming' }).eq('id', job.scene_id);

  await enqueueJob({
    projectId: job.project_id,
    sceneId: job.scene_id,
    kind: 'trim_to_duration',
    payload: { sceneId: job.scene_id, assetId, sourcePath: storagePath },
  });

  // Cleanup tmp file.
  try { await fs.unlink(localPath); } catch {}

  return { done: true };
}
