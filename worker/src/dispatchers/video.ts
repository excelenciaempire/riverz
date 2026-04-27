import { supabase } from '../lib/supabase.js';
import { config } from '../config.js';
import { createVeoTask } from '../lib/kie-video.js';
import { StealerJob } from '../lib/types.js';

const STEALER_BUCKET = config.supabase.bucket;
const SIGNED_URL_TTL_SEC = 24 * 60 * 60;

// Default credits per Veo 3.1 invocation. Adjustable via admin_config.stealer_credits_per_clip.
const DEFAULT_CREDITS_PER_CLIP = 30;
// Default cap per project. Adjustable via admin_config.stealer_max_credits_per_project.
const DEFAULT_MAX_CREDITS = 500;

async function readNumericConfig(key: string, fallback: number): Promise<number> {
  const sb = supabase();
  const { data } = await sb.from('admin_config').select('value').eq('key', key).maybeSingle();
  const raw = data?.value;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

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

function buildCallbackUrl(): string | undefined {
  const base = config.webhooks.publicUrl.replace(/\/+$/, '');
  if (!base) return undefined;
  const url = new URL('/api/webhooks/kie', base);
  if (config.webhooks.secret) url.searchParams.set('secret', config.webhooks.secret);
  return url.toString();
}

async function dispatchVeo(job: StealerJob, opts: { withAvatar: boolean }) {
  if (!job.scene_id || !job.project_id) throw new Error('Need scene_id + project_id');
  const sb = supabase();

  // Cost cap check (per project).
  const [creditsPerClip, maxCredits] = await Promise.all([
    readNumericConfig('stealer_credits_per_clip', DEFAULT_CREDITS_PER_CLIP),
    readNumericConfig('stealer_max_credits_per_project', DEFAULT_MAX_CREDITS),
  ]);

  const { data: project, error: pErr } = await sb
    .from('stealer_projects')
    .select('selected_avatar_id, total_credits')
    .eq('id', job.project_id)
    .single();
  if (pErr || !project) throw new Error('Project not found');

  const used = Number(project.total_credits || 0);
  if (used + creditsPerClip > maxCredits) {
    const msg = `Cost cap reached: ${used} + ${creditsPerClip} > ${maxCredits} credits for project ${job.project_id}`;
    console.warn(`[video] ${msg}`);
    await sb
      .from('stealer_jobs')
      .update({ status: 'failed', error_message: msg })
      .eq('id', job.id);
    if (job.scene_id) {
      await sb
        .from('stealer_scenes')
        .update({ status: 'failed', error_message: 'Cost cap reached' })
        .eq('id', job.scene_id);
    }
    throw new Error(msg);
  }

  const { data: scene, error: sErr } = await sb
    .from('stealer_scenes')
    .select('*')
    .eq('id', job.scene_id)
    .single();
  if (sErr || !scene) throw new Error('Scene not found');
  if (!scene.visual_prompt) throw new Error('Scene has no visual_prompt — generate_prompts must run first');
  if (!scene.keyframe_path) throw new Error('Scene has no keyframe_path');

  // Reference image: avatar (if set) for actor scenes; signed keyframe URL otherwise.
  let referenceImageUrl: string | null = null;
  if (opts.withAvatar && project.selected_avatar_id) {
    const { data: avatar } = await sb
      .from('avatars')
      .select('image_url')
      .eq('id', project.selected_avatar_id)
      .single();
    referenceImageUrl = (avatar as any)?.image_url || null;
  }
  if (!referenceImageUrl) {
    referenceImageUrl = await signedUrl(scene.keyframe_path);
  }

  await sb.from('stealer_scenes').update({ status: 'generating' }).eq('id', scene.id);

  const callBackUrl = buildCallbackUrl();
  const taskId = await createVeoTask({
    prompt: scene.visual_prompt,
    imageUrls: [referenceImageUrl],
    model: 'veo3_fast',
    aspect_ratio: '9:16',
    resolution: '1080p',
    callBackUrl,
  });

  await sb
    .from('stealer_jobs')
    .update({ status: 'waiting_callback', external_task_id: taskId })
    .eq('id', job.id);

  // Bump the project's running cost so subsequent clips can hit the cap.
  await sb
    .from('stealer_projects')
    .update({ total_credits: used + creditsPerClip })
    .eq('id', job.project_id);

  return { taskId, sceneId: scene.id, callBackUrl: callBackUrl || null };
}

export async function handleGenerateBroll(job: StealerJob) {
  return dispatchVeo(job, { withAvatar: false });
}

export async function handleGenerateActor(job: StealerJob) {
  return dispatchVeo(job, { withAvatar: true });
}
