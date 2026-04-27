import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { supabase } from './supabase.js';

/** Ensure scratch dir exists for a given project. */
export async function ensureProjectTmp(projectId: string): Promise<string> {
  const dir = path.join(config.worker.tmpDir, projectId);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

/** Download a file from Supabase Storage to a local path. */
export async function downloadFromStorage(storagePath: string, destLocalPath: string): Promise<void> {
  const sb = supabase();
  const { data, error } = await sb.storage.from(config.supabase.bucket).download(storagePath);
  if (error || !data) throw new Error(`Download failed for ${storagePath}: ${error?.message || 'no data'}`);
  await fs.mkdir(path.dirname(destLocalPath), { recursive: true });
  const buf = Buffer.from(await data.arrayBuffer());
  await fs.writeFile(destLocalPath, buf);
}

/** Upload a local file to Supabase Storage and return its storage path. */
export async function uploadToStorage(
  localPath: string,
  storagePath: string,
  contentType: string
): Promise<string> {
  const sb = supabase();
  const buf = await fs.readFile(localPath);
  const { error } = await sb.storage
    .from(config.supabase.bucket)
    .upload(storagePath, buf, { contentType, upsert: true });
  if (error) throw new Error(`Upload failed for ${storagePath}: ${error.message}`);
  return storagePath;
}

/** Insert a row in stealer_assets so the UI can find/show this artifact. */
export async function recordAsset(opts: {
  projectId: string;
  sceneId?: string | null;
  kind: string;
  storagePath: string;
  durationSec?: number | null;
  metadata?: Record<string, any> | null;
}): Promise<string> {
  const sb = supabase();
  const { data, error } = await sb
    .from('stealer_assets')
    .insert({
      project_id: opts.projectId,
      scene_id: opts.sceneId ?? null,
      kind: opts.kind,
      storage_path: opts.storagePath,
      duration_sec: opts.durationSec ?? null,
      metadata: opts.metadata ?? null,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

/** Best-effort cleanup of a project's tmp dir between job kinds. */
export async function cleanupProjectTmp(projectId: string): Promise<void> {
  const dir = path.join(config.worker.tmpDir, projectId);
  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch (err) {
    console.warn(`[storage] Failed to clean tmp ${dir}:`, err);
  }
}
