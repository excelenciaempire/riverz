import { supabase } from '../lib/supabase.js';
import { getPromptWithVariables } from '../lib/prompts.js';
import { callGemini, imageBlockFromStorage, parseJsonFromGemini } from '../lib/gemini.js';
import { StealerJob } from '../lib/types.js';
import { enqueueJob } from '../lib/jobs.js';

/**
 * generate_prompts — for ONE scene.
 *
 * Reads the keyframe + the scene's audio_text and asks Gemini 3 Pro (vision) for
 * a structured JSON: { visual_prompt_for_ai, emotion_context, fallback_prompt, ... }.
 * Persists the result onto the scene row.
 *
 * After this completes, if the scene also already has audio_segment_path set,
 * we enqueue the per-scene generation (`generate_actor` / `generate_broll`).
 */
export async function handleGeneratePrompts(job: StealerJob) {
  if (!job.scene_id || !job.project_id) throw new Error('generate_prompts requires scene_id + project_id');
  const sb = supabase();

  const { data: scene, error: sErr } = await sb
    .from('stealer_scenes')
    .select('*')
    .eq('id', job.scene_id)
    .single();
  if (sErr || !scene) throw new Error('Scene not found');

  if (!scene.keyframe_path) throw new Error('Scene is missing keyframe_path — extract_keyframes must run first');

  const { data: project, error: pErr } = await sb
    .from('stealer_projects')
    .select('name, transcript')
    .eq('id', job.project_id)
    .single();
  if (pErr || !project) throw new Error('Project not found');

  // Pull the slice of the transcript covering this scene.
  const audioText = sliceTranscriptText(project.transcript, scene.start_sec, scene.end_sec) || scene.audio_text || '';

  const systemPrompt = await getPromptWithVariables('stealer_scene_prompt_generation', {
    SCENE_INDEX: scene.scene_index,
    SCENE_TYPE: scene.type,
    SCENE_DURATION_SEC: Number((scene.end_sec - scene.start_sec).toFixed(2)),
    SCENE_AUDIO_TEXT: audioText.replace(/[\n\r]+/g, ' ').slice(0, 1000),
    PRODUCT_NAME: project.name || 'Brand product',
  });

  const imageBlock = await imageBlockFromStorage(scene.keyframe_path, job.project_id);

  await sb.from('stealer_scenes').update({ status: 'prompting', audio_text: audioText }).eq('id', scene.id);

  let parsed: any;
  try {
    const text = await callGemini(
      [{ role: 'user', content: [{ type: 'text', text: 'Analyze this keyframe and return the JSON.' }, imageBlock] }],
      { system: systemPrompt, temperature: 0.5, maxTokens: 2500 }
    );
    parsed = parseJsonFromGemini(text);
  } catch (err: any) {
    // Fall back: build a minimal prompt from the audio text only.
    parsed = {
      visual_prompt_for_ai: '',
      emotion_context: 'unknown',
      fallback_prompt: `${scene.type === 'actor' ? 'Person speaking on camera' : 'Brand product shot'}, 9:16 vertical, professional commercial cinematography. Context: ${audioText.slice(0, 200)}`,
    };
    console.warn(`[prompts] Gemini failed for scene ${scene.id}: ${err.message}. Using fallback.`);
  }

  const visualPrompt =
    typeof parsed.visual_prompt_for_ai === 'string' && parsed.visual_prompt_for_ai.length > 50
      ? parsed.visual_prompt_for_ai
      : (parsed.fallback_prompt || `${scene.type} scene, professional commercial cinematography, 9:16 vertical, 1080p`);

  await sb
    .from('stealer_scenes')
    .update({
      visual_prompt: visualPrompt,
      emotion_context: parsed.emotion_context || null,
      fallback_prompt: parsed.fallback_prompt || null,
      status: 'pending',
    })
    .eq('id', scene.id);

  await maybeQueueGeneration(scene.id);

  return { sceneId: scene.id, promptLen: visualPrompt.length };
}

/**
 * If a scene has BOTH visual_prompt and audio_segment_path, fan-out to
 * generate_actor / generate_broll. This is called from prompts.ts (after the
 * prompt is ready) and from audio-split.ts (after audio is sliced).
 */
export async function maybeQueueGeneration(sceneId: string) {
  const sb = supabase();
  const { data: scene } = await sb.from('stealer_scenes').select('*').eq('id', sceneId).single();
  if (!scene) return;
  if (scene.status === 'generating' || scene.status === 'completed' || scene.status === 'failed') return;
  if (!scene.visual_prompt || !scene.audio_segment_path) return;

  const kind = scene.type === 'actor' ? 'generate_actor' : 'generate_broll';

  // Don't double-enqueue: if a generate_* job already exists for this scene, skip.
  const { data: existing } = await sb
    .from('stealer_jobs')
    .select('id, status')
    .eq('scene_id', scene.id)
    .in('kind', ['generate_actor', 'generate_broll'])
    .limit(1);

  if (existing && existing.length > 0) return;

  await enqueueJob({
    projectId: scene.project_id,
    sceneId: scene.id,
    kind: kind as any,
  });
}

function sliceTranscriptText(transcript: any, start: number, end: number): string {
  if (!transcript) return '';
  // Whisper verbose_json gives `segments[]` and `words[]`.
  if (Array.isArray(transcript.words)) {
    const within = transcript.words.filter((w: any) => w.end > start && w.start < end);
    if (within.length > 0) return within.map((w: any) => w.word).join(' ').trim();
  }
  if (Array.isArray(transcript.segments)) {
    const within = transcript.segments.filter((s: any) => s.end > start && s.start < end);
    if (within.length > 0) return within.map((s: any) => s.text).join(' ').trim();
  }
  return typeof transcript.text === 'string' ? '' : '';
}
