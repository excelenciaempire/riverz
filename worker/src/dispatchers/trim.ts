import path from 'node:path';
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
import ffmpegStatic from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';
import { supabase } from '../lib/supabase.js';
import { ensureProjectTmp, downloadFromStorage, uploadToStorage } from '../lib/storage.js';
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
 * trim_to_duration — bring a generated clip's duration as close as possible to
 * the scene's target duration.
 *
 *  - actual > target: trim around the middle.
 *  - actual < target - 0.5s: leave as is (Phase 2). Phase 6 will add slow-mo /
 *    extension. For now we accept the slight gap; the master audio dictates timing.
 *  - within ±0.5s: leave as is.
 *
 * Reads job.payload = { sceneId, assetId, sourcePath }
 */
export async function handleTrimToDuration(job: StealerJob) {
  const sb = supabase();
  const { sceneId, assetId, sourcePath } = (job.payload || {}) as {
    sceneId: string;
    assetId: string;
    sourcePath: string;
  };
  if (!sceneId || !assetId || !sourcePath) throw new Error('trim_to_duration requires sceneId, assetId, sourcePath in payload');

  const { data: scene, error: sErr } = await sb
    .from('stealer_scenes')
    .select('id, project_id, scene_index, start_sec, end_sec, type')
    .eq('id', sceneId)
    .single();
  if (sErr || !scene) throw new Error('Scene not found');

  const target = Number(scene.end_sec) - Number(scene.start_sec);

  const tmp = await ensureProjectTmp(scene.project_id);
  const localIn = path.join(tmp, `clip_in_${scene.scene_index}.mp4`);
  await downloadFromStorage(sourcePath, localIn);

  const actual = await probeDurationSec(localIn);
  const delta = actual - target;

  let finalLocal = localIn;
  let trimmedPath = sourcePath;
  let trimmedDuration = actual;

  if (delta > 0.5) {
    // Trim, centered.
    const offset = Math.max(0, delta / 2);
    const localOut = path.join(tmp, `clip_out_${scene.scene_index}.mp4`);
    await run(FFMPEG_BIN, [
      '-y',
      '-ss', String(offset.toFixed(3)),
      '-i', localIn,
      '-t', String(target.toFixed(3)),
      '-c:v', 'libx264',
      '-preset', 'medium',
      '-crf', '20',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-movflags', '+faststart',
      localOut,
    ]);
    finalLocal = localOut;
    trimmedDuration = await probeDurationSec(localOut);
    trimmedPath = `${scene.project_id}/clips/scene_${scene.scene_index}_trimmed.mp4`;
    await uploadToStorage(finalLocal, trimmedPath, 'video/mp4');
  }

  // Update the asset row with the (possibly new) path + final duration.
  const finalKind = scene.type === 'actor' ? 'actor_clip' : 'broll_clip';
  await sb
    .from('stealer_assets')
    .update({ storage_path: trimmedPath, duration_sec: trimmedDuration, kind: finalKind })
    .eq('id', assetId);

  await sb
    .from('stealer_scenes')
    .update({ status: 'completed' })
    .eq('id', scene.id);

  await maybeMarkProjectCompleted(scene.project_id);

  // Cleanup local files.
  try { await fs.unlink(localIn); } catch {}
  if (finalLocal !== localIn) try { await fs.unlink(finalLocal); } catch {}

  return { sceneId, assetPath: trimmedPath, duration: trimmedDuration, delta };
}

async function maybeMarkProjectCompleted(projectId: string) {
  const sb = supabase();
  const { data: scenes } = await sb
    .from('stealer_scenes')
    .select('status')
    .eq('project_id', projectId);
  if (!scenes || scenes.length === 0) return;

  const remaining = scenes.filter((s) => !['completed', 'failed'].includes(s.status));
  if (remaining.length > 0) return;

  const anyFailed = scenes.some((s) => s.status === 'failed');
  await sb
    .from('stealer_projects')
    .update({ status: anyFailed ? 'failed' : 'completed' })
    .eq('id', projectId);
}
