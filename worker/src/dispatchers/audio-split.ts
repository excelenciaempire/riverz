import path from 'node:path';
import { spawn } from 'node:child_process';
import ffmpegStatic from 'ffmpeg-static';
import { supabase } from '../lib/supabase.js';
import {
  ensureProjectTmp,
  downloadFromStorage,
  uploadToStorage,
  recordAsset,
} from '../lib/storage.js';
import { StealerJob } from '../lib/types.js';
import { maybeQueueGeneration } from './prompts.js';

const FFMPEG_BIN = (ffmpegStatic as unknown as string) || 'ffmpeg';

function run(bin: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    proc.stderr.on('data', (d) => (stderr += d.toString()));
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited ${code}\n${stderr.slice(-500)}`));
    });
  });
}

/**
 * split_audio — slice the project's audio into one segment per scene.
 *
 * Phase 2 uses the SOURCE audio (the original ad's voice) so the pipeline
 * works end-to-end without ElevenLabs being wired up yet. Phase 4 will
 * generate a master_audio via TTS first and slice THAT instead.
 */
export async function handleSplitAudio(job: StealerJob) {
  if (!job.project_id) throw new Error('split_audio requires project_id');
  const sb = supabase();

  const { data: project, error: pErr } = await sb
    .from('stealer_projects')
    .select('source_audio_path, master_audio_path')
    .eq('id', job.project_id)
    .single();
  if (pErr || !project) throw new Error('Project not found');

  const audioPath = project.master_audio_path || project.source_audio_path;
  if (!audioPath) {
    throw new Error('No audio to split — extract_audio must finish first');
  }

  const tmp = await ensureProjectTmp(job.project_id);
  const localFullAudio = path.join(tmp, 'full_audio.wav');
  await downloadFromStorage(audioPath, localFullAudio);

  const { data: scenes, error: sErr } = await sb
    .from('stealer_scenes')
    .select('id, scene_index, start_sec, end_sec')
    .eq('project_id', job.project_id)
    .order('scene_index');
  if (sErr || !scenes || scenes.length === 0) throw new Error('No scenes for project');

  for (const scene of scenes) {
    const duration = Number(scene.end_sec) - Number(scene.start_sec);
    if (duration <= 0.05) continue;

    const outFile = path.join(tmp, `audio_seg_${scene.scene_index}.mp3`);
    await run(FFMPEG_BIN, [
      '-y',
      '-i', localFullAudio,
      '-ss', String(Number(scene.start_sec).toFixed(3)),
      '-t', String(duration.toFixed(3)),
      '-c:a', 'libmp3lame',
      '-b:a', '128k',
      outFile,
    ]);

    const storagePath = `${job.project_id}/audio/scene_${scene.scene_index}.mp3`;
    await uploadToStorage(outFile, storagePath, 'audio/mpeg');

    await sb
      .from('stealer_scenes')
      .update({ audio_segment_path: storagePath })
      .eq('id', scene.id);

    await recordAsset({
      projectId: job.project_id,
      sceneId: scene.id,
      kind: 'audio_segment',
      storagePath,
      durationSec: duration,
      metadata: { sceneIndex: scene.scene_index },
    });

    // If the prompt is also already generated, kick off the per-scene video generation.
    await maybeQueueGeneration(scene.id);
  }

  return { count: scenes.length };
}
