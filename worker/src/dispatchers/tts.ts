import path from 'node:path';
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
import ffmpegStatic from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';
import { supabase } from '../lib/supabase.js';
import { synthesizeTts } from '../lib/elevenlabs.js';
import { config } from '../config.js';
import { ensureProjectTmp, uploadToStorage, recordAsset } from '../lib/storage.js';
import { enqueueJob } from '../lib/jobs.js';
import { StealerJob } from '../lib/types.js';

const FFMPEG_BIN = (ffmpegStatic as unknown as string) || 'ffmpeg';
const FFPROBE_BIN = (ffprobeStatic as any).path || 'ffprobe';

function run(bin: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => (stdout += d.toString()));
    proc.stderr.on('data', (d) => (stderr += d.toString()));
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${path.basename(bin)} exited ${code}\n${stderr.slice(-500)}`));
    });
  });
}

async function probeDurationSec(localPath: string): Promise<number> {
  const { stdout } = await run(FFPROBE_BIN, [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    localPath,
  ]);
  return Number(stdout.trim());
}

/**
 * tts_master — generates the full new audio track (voice over) using ElevenLabs.
 *
 * Inputs (from project row):
 *   transcript.text           the original ad's full transcript
 *   selected_voice_id         FK to riverz `voices` table
 *
 * Behavior:
 *  - If no voice is selected OR ElevenLabs is not configured: skip TTS and copy
 *    the source audio path into master_audio_path so the rest of the pipeline
 *    keeps working with the original voice.
 *  - Otherwise: synthesize the script with ElevenLabs v3, save MP3 to Storage.
 *
 * Always enqueues a `split_audio` follow-up so the per-scene segments get cut.
 */
export async function handleTtsMaster(job: StealerJob) {
  if (!job.project_id) throw new Error('tts_master requires project_id');
  const sb = supabase();

  const { data: project, error: pErr } = await sb
    .from('stealer_projects')
    .select('selected_voice_id, transcript, source_audio_path')
    .eq('id', job.project_id)
    .single();
  if (pErr || !project) throw new Error('Project not found');

  let voiceRow: { eleven_labs_voice_id: string | null; name: string | null } | null = null;
  if (project.selected_voice_id) {
    const { data: voice } = await sb
      .from('voices')
      .select('eleven_labs_voice_id, name')
      .eq('id', project.selected_voice_id)
      .single();
    voiceRow = voice as any;
  }

  const elevenVoiceId = voiceRow?.eleven_labs_voice_id || null;
  const transcriptText: string = project.transcript?.text || '';
  const apiKeyOk = !!config.elevenlabs.apiKey;

  // Fallback path: skip TTS, reuse source audio.
  if (!elevenVoiceId || !apiKeyOk || !transcriptText.trim()) {
    if (!project.source_audio_path) {
      throw new Error('No source_audio_path and no voice for TTS');
    }
    console.log(`[tts] Skipping TTS for project ${job.project_id} (voice=${!!elevenVoiceId}, key=${apiKeyOk}, text=${transcriptText.length}). Using source audio.`);
    await sb
      .from('stealer_projects')
      .update({ master_audio_path: project.source_audio_path })
      .eq('id', job.project_id);
    await enqueueJob({ projectId: job.project_id, kind: 'split_audio' });
    return { skipped: true, reason: 'no_voice_or_key' };
  }

  // Real TTS path.
  console.log(`[tts] Generating master audio with voice "${voiceRow?.name}" (${elevenVoiceId.slice(0, 8)})`);
  const mp3Buf = await synthesizeTts({
    voiceId: elevenVoiceId,
    text: transcriptText,
    stability: 0.45,
    similarity: 0.8,
    style: 0.35,
  });

  const tmp = await ensureProjectTmp(job.project_id);
  const localFile = path.join(tmp, 'master.mp3');
  await fs.writeFile(localFile, mp3Buf);
  const duration = await probeDurationSec(localFile);

  const storagePath = `${job.project_id}/master.mp3`;
  await uploadToStorage(localFile, storagePath, 'audio/mpeg');

  await sb
    .from('stealer_projects')
    .update({
      master_audio_path: storagePath,
      master_audio_duration_sec: duration,
    })
    .eq('id', job.project_id);

  await recordAsset({
    projectId: job.project_id,
    kind: 'master_audio',
    storagePath,
    durationSec: duration,
    metadata: { voiceId: elevenVoiceId, voiceName: voiceRow?.name },
  });

  await enqueueJob({ projectId: job.project_id, kind: 'split_audio' });

  try { await fs.unlink(localFile); } catch {}

  return { storagePath, duration };
}
