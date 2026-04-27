import fs from 'node:fs';
import path from 'node:path';
import OpenAI from 'openai';
import { config } from '../config.js';
import { supabase } from '../lib/supabase.js';
import { ensureProjectTmp, downloadFromStorage } from '../lib/storage.js';
import { StealerJob } from '../lib/types.js';

let _openai: OpenAI | null = null;
function openai(): OpenAI {
  if (!config.openai.apiKey) throw new Error('OPENAI_API_KEY not set');
  if (!_openai) _openai = new OpenAI({ apiKey: config.openai.apiKey });
  return _openai;
}

/**
 * Sends the project's source audio to Whisper and saves the verbose JSON
 * (with word-level timestamps) into stealer_projects.transcript.
 */
export async function handleTranscribe(job: StealerJob) {
  if (!job.project_id) throw new Error('transcribe requires project_id');
  const sb = supabase();

  const { data: project, error } = await sb
    .from('stealer_projects')
    .select('source_audio_path')
    .eq('id', job.project_id)
    .single();
  if (error || !project?.source_audio_path) {
    throw new Error('Project audio missing — run extract_audio first');
  }

  const tmp = await ensureProjectTmp(job.project_id);
  const localAudio = path.join(tmp, 'audio.wav');
  await downloadFromStorage(project.source_audio_path, localAudio);

  const transcription = await openai().audio.transcriptions.create({
    file: fs.createReadStream(localAudio) as any,
    model: 'whisper-1',
    response_format: 'verbose_json',
    timestamp_granularities: ['word', 'segment'],
  });

  // The SDK returns an object whose shape is the verbose_json response.
  // We persist the entire payload — the UI / downstream LLM step uses
  // `text`, `segments`, and `words` independently.
  await sb
    .from('stealer_projects')
    .update({ transcript: transcription })
    .eq('id', job.project_id);

  // If detect_scenes + extract_keyframes already finished while we were transcribing,
  // the project status may already be 'scenes_ready' — bump it to awaiting review now.
  // This is a no-op if scenes/keyframes are still in flight.
  await maybeMarkAwaitingReview(job.project_id);

  return { wordCount: (transcription as any)?.words?.length ?? 0 };
}

async function maybeMarkAwaitingReview(projectId: string) {
  const sb = supabase();
  const { data: project } = await sb
    .from('stealer_projects')
    .select('status')
    .eq('id', projectId)
    .single();
  if (!project) return;
  if (!['ingesting', 'scenes_ready'].includes(project.status)) return;

  const { count: sceneCount } = await sb
    .from('stealer_scenes')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', projectId);

  const { count: keyframeCount } = await sb
    .from('stealer_assets')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', projectId)
    .eq('kind', 'keyframe');

  if ((sceneCount || 0) > 0 && (keyframeCount || 0) === sceneCount) {
    await sb
      .from('stealer_projects')
      .update({ status: 'awaiting_user_review' })
      .eq('id', projectId);
  }
}
