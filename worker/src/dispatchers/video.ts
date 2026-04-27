import { supabase } from '../lib/supabase.js';
import { config } from '../config.js';
import { createVeoTask } from '../lib/kie-video.js';
import { StealerJob } from '../lib/types.js';

const STEALER_BUCKET = config.supabase.bucket;
const SIGNED_URL_TTL_SEC = 24 * 60 * 60; // 24h — Veo needs to fetch the keyframe

/**
 * Build a public-ish URL for a Storage path so kie.ai's Veo service can fetch it.
 * Phase 2: signed URLs (24h). Phase 5+ will likely flip the bucket to public-read
 * for the keyframes/ subfolder so we don't have to sign every time.
 */
async function signedUrl(storagePath: string): Promise<string> {
  const sb = supabase();
  const { data, error } = await sb.storage
    .from(STEALER_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SEC);
  if (error || !data?.signedUrl) {
    throw new Error(`Failed to sign ${storagePath}: ${error?.message || 'no url'}`);
  }
  return data.signedUrl;
}

/**
 * Shared core: send a Veo task and flip the job to waiting_callback.
 * The actual result is picked up by the polling subroutine in server.ts which
 * calls dispatchers/poll-veo.ts (we kept that inline in server for now).
 */
async function dispatchVeo(job: StealerJob, opts: { withAvatar?: boolean }) {
  if (!job.scene_id || !job.project_id) throw new Error('Need scene_id + project_id');
  const sb = supabase();

  const { data: scene, error: sErr } = await sb
    .from('stealer_scenes')
    .select('*')
    .eq('id', job.scene_id)
    .single();
  if (sErr || !scene) throw new Error('Scene not found');
  if (!scene.visual_prompt) throw new Error('Scene has no visual_prompt — generate_prompts must run first');
  if (!scene.keyframe_path) throw new Error('Scene has no keyframe_path');

  const { data: project } = await sb
    .from('stealer_projects')
    .select('selected_avatar_id')
    .eq('id', job.project_id)
    .single();

  // Reference image: avatar (if set) for actor scenes; keyframe otherwise.
  let referenceImageUrl: string | null = null;

  if (opts.withAvatar && project?.selected_avatar_id) {
    const { data: avatar } = await sb
      .from('avatars')
      .select('image_url, thumbnail_url, photo_url')
      .eq('id', project.selected_avatar_id)
      .single();
    referenceImageUrl =
      (avatar as any)?.image_url ||
      (avatar as any)?.photo_url ||
      (avatar as any)?.thumbnail_url ||
      null;
  }

  if (!referenceImageUrl) {
    referenceImageUrl = await signedUrl(scene.keyframe_path);
  }

  await sb.from('stealer_scenes').update({ status: 'generating' }).eq('id', scene.id);

  const taskId = await createVeoTask({
    prompt: scene.visual_prompt,
    imageUrls: [referenceImageUrl],
    model: 'veo3_fast',
    aspect_ratio: '9:16',
    resolution: '1080p',
  });

  // Stash taskId on the job and on the scene's input metadata.
  await sb
    .from('stealer_jobs')
    .update({ status: 'waiting_callback', external_task_id: taskId })
    .eq('id', job.id);

  return { taskId, sceneId: scene.id };
}

export async function handleGenerateBroll(job: StealerJob) {
  return dispatchVeo(job, { withAvatar: false });
}

export async function handleGenerateActor(job: StealerJob) {
  return dispatchVeo(job, { withAvatar: true });
}
