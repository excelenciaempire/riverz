import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs/promises';
import ffmpegStatic from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';
import { supabase } from '../lib/supabase.js';
import { config } from '../config.js';
import {
  ensureProjectTmp,
  downloadFromStorage,
  uploadToStorage,
  recordAsset,
} from '../lib/storage.js';
import { enqueueJob } from '../lib/jobs.js';
import { StealerJob } from '../lib/types.js';

const FFMPEG_BIN = (ffmpegStatic as unknown as string) || 'ffmpeg';
const FFPROBE_BIN = (ffprobeStatic as any).path || 'ffprobe';

/** Run a binary and return stdout/stderr. Rejects on non-zero exit. */
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
      else reject(new Error(`${path.basename(bin)} exited with code ${code}\n${stderr}`));
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

// --------------------------------------------------------------------------
// extract_audio
// --------------------------------------------------------------------------

export async function handleExtractAudio(job: StealerJob) {
  if (!job.project_id) throw new Error('extract_audio requires project_id');
  const sb = supabase();

  const { data: project, error } = await sb
    .from('stealer_projects')
    .select('source_video_path')
    .eq('id', job.project_id)
    .single();
  if (error || !project?.source_video_path) {
    throw new Error('Project source video missing');
  }

  const tmp = await ensureProjectTmp(job.project_id);
  const inFile = path.join(tmp, 'source.mp4');
  const outFile = path.join(tmp, 'audio.wav');

  await downloadFromStorage(project.source_video_path, inFile);

  await run(FFMPEG_BIN, [
    '-y',
    '-i', inFile,
    '-vn',
    '-ac', '1',
    '-ar', '16000',
    '-c:a', 'pcm_s16le',
    outFile,
  ]);

  const audioStoragePath = `${job.project_id}/audio.wav`;
  await uploadToStorage(outFile, audioStoragePath, 'audio/wav');

  const duration = await probeDurationSec(inFile);
  await sb
    .from('stealer_projects')
    .update({
      source_audio_path: audioStoragePath,
      source_duration_sec: duration,
    })
    .eq('id', job.project_id);

  // Fan-out: transcribe + detect_scenes can run in parallel after this.
  await enqueueJob({ projectId: job.project_id, kind: 'transcribe' });
  await enqueueJob({ projectId: job.project_id, kind: 'detect_scenes' });

  return { audioStoragePath, durationSec: duration };
}

// --------------------------------------------------------------------------
// detect_scenes
// --------------------------------------------------------------------------

interface SceneCut {
  start: number;
  end: number;
}

/**
 * Use ffmpeg's scene-detect filter to find cuts. We run with -vf "select=gt(scene,T)"
 * and parse showinfo output for pts_time values, then turn them into [start,end] pairs.
 */
async function detectSceneCuts(localPath: string, totalSec: number, threshold = 0.3): Promise<SceneCut[]> {
  const { stderr } = await run(FFMPEG_BIN, [
    '-i', localPath,
    '-filter:v', `select='gt(scene,${threshold})',showinfo`,
    '-f', 'null',
    '-',
  ]).catch((err) => {
    // ffmpeg writes the showinfo output to stderr regardless of exit code.
    if (err && typeof err.message === 'string' && err.message.includes('pts_time')) {
      return { stderr: err.message } as { stderr: string };
    }
    throw err;
  });

  const cutTimes: number[] = [];
  const re = /pts_time:([0-9.]+)/g;
  let m;
  while ((m = re.exec(stderr)) !== null) {
    cutTimes.push(Number(m[1]));
  }

  // Build segments: 0 → cut1, cut1 → cut2, ..., cutN → end.
  const points = [0, ...cutTimes, totalSec].filter((t, i, arr) => i === 0 || t > arr[i - 1] + 0.05);
  const cuts: SceneCut[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    cuts.push({ start: points[i], end: points[i + 1] });
  }

  // If the video has effectively no detected cuts, treat the whole thing as one scene.
  if (cuts.length === 0) cuts.push({ start: 0, end: totalSec });

  return cuts;
}

export async function handleDetectScenes(job: StealerJob) {
  if (!job.project_id) throw new Error('detect_scenes requires project_id');
  const sb = supabase();

  const { data: project, error } = await sb
    .from('stealer_projects')
    .select('source_video_path, source_duration_sec')
    .eq('id', job.project_id)
    .single();
  if (error || !project?.source_video_path) throw new Error('Project source video missing');

  const tmp = await ensureProjectTmp(job.project_id);
  const inFile = path.join(tmp, 'source.mp4');
  await downloadFromStorage(project.source_video_path, inFile);

  const totalSec = project.source_duration_sec || (await probeDurationSec(inFile));
  const cuts = await detectSceneCuts(inFile, totalSec);

  // Insert scene rows.
  const rows = cuts.map((c, i) => ({
    project_id: job.project_id,
    scene_index: i,
    start_sec: Number(c.start.toFixed(3)),
    end_sec: Number(c.end.toFixed(3)),
    type: 'broll', // user can flip to 'actor' in the timeline editor
  }));

  // Wipe any pre-existing scenes for idempotency, then insert fresh.
  await sb.from('stealer_scenes').delete().eq('project_id', job.project_id);
  const { error: insErr } = await sb.from('stealer_scenes').insert(rows);
  if (insErr) throw insErr;

  // After scenes are in, queue keyframe extraction.
  await enqueueJob({ projectId: job.project_id, kind: 'extract_keyframes' });

  await maybeMarkScenesReady(job.project_id);

  return { sceneCount: rows.length };
}

// --------------------------------------------------------------------------
// extract_keyframes
// --------------------------------------------------------------------------

export async function handleExtractKeyframes(job: StealerJob) {
  if (!job.project_id) throw new Error('extract_keyframes requires project_id');
  const sb = supabase();

  const [{ data: project, error: pErr }, { data: scenes, error: sErr }] = await Promise.all([
    sb.from('stealer_projects').select('source_video_path').eq('id', job.project_id).single(),
    sb.from('stealer_scenes').select('*').eq('project_id', job.project_id).order('scene_index'),
  ]);
  if (pErr || !project?.source_video_path) throw new Error('Project source video missing');
  if (sErr || !scenes || scenes.length === 0) throw new Error('No scenes to extract keyframes for');

  const tmp = await ensureProjectTmp(job.project_id);
  const inFile = path.join(tmp, 'source.mp4');
  await downloadFromStorage(project.source_video_path, inFile);

  for (const scene of scenes) {
    const mid = (Number(scene.start_sec) + Number(scene.end_sec)) / 2;
    const outFile = path.join(tmp, `keyframe_${scene.scene_index}.jpg`);

    await run(FFMPEG_BIN, [
      '-y',
      '-ss', String(mid.toFixed(3)),
      '-i', inFile,
      '-frames:v', '1',
      '-q:v', '3',
      outFile,
    ]);

    const storagePath = `${job.project_id}/keyframes/scene_${scene.scene_index}.jpg`;
    await uploadToStorage(outFile, storagePath, 'image/jpeg');

    await sb
      .from('stealer_scenes')
      .update({ keyframe_path: storagePath })
      .eq('id', scene.id);

    await recordAsset({
      projectId: job.project_id,
      sceneId: scene.id,
      kind: 'keyframe',
      storagePath,
      metadata: { sceneIndex: scene.scene_index, midpointSec: mid },
    });
  }

  await maybeMarkScenesReady(job.project_id);

  return { count: scenes.length };
}

// --------------------------------------------------------------------------
// shared helper
// --------------------------------------------------------------------------

/**
 * After detect_scenes / extract_keyframes / transcribe finish, we move the project to
 * 'awaiting_user_review' so the user can edit the timeline. This is idempotent: it
 * only flips the status if all three prerequisites are satisfied.
 */
async function maybeMarkScenesReady(projectId: string) {
  const sb = supabase();
  const { data: project } = await sb
    .from('stealer_projects')
    .select('status, transcript')
    .eq('id', projectId)
    .single();
  if (!project) return;
  if (project.status !== 'ingesting' && project.status !== 'scenes_ready') return;

  const { count: sceneCount } = await sb
    .from('stealer_scenes')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', projectId);

  const { count: keyframeCount } = await sb
    .from('stealer_assets')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', projectId)
    .eq('kind', 'keyframe');

  const transcriptReady = !!project.transcript;
  const scenesReady = (sceneCount || 0) > 0;
  const keyframesReady = (keyframeCount || 0) === sceneCount;

  if (scenesReady && keyframesReady && transcriptReady) {
    await sb
      .from('stealer_projects')
      .update({ status: 'awaiting_user_review' })
      .eq('id', projectId);
  } else if (scenesReady) {
    await sb.from('stealer_projects').update({ status: 'scenes_ready' }).eq('id', projectId);
  }
}
