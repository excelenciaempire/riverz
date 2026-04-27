import { config } from '../config.js';

/**
 * kie.ai Veo 3.1 client for video generation.
 *
 * Endpoints (per https://docs.kie.ai/veo3-api/):
 *   POST /api/v1/veo/generate       — create a task, returns { data: { taskId } }
 *   GET  /api/v1/veo/record-info    — poll status by taskId
 *
 * Status codes from record-info: 0=generating, 1=success, 2=failed, 3=generation_failed.
 *
 * Aspect ratios: 16:9, 9:16, Auto.
 * Resolutions: 720p, 1080p, 4k.
 * Models: veo3, veo3_fast (default), veo3_lite.
 */

export interface VeoGenerateInput {
  prompt: string;
  imageUrls?: string[];
  model?: 'veo3' | 'veo3_fast' | 'veo3_lite';
  aspect_ratio?: '16:9' | '9:16' | 'Auto';
  resolution?: '720p' | '1080p' | '4k';
  callBackUrl?: string;
}

export interface VeoTaskInfo {
  status: 'generating' | 'success' | 'failed';
  fallback: boolean;
  videoUrl: string | null;
  resolution: string | null;
  rawCode: number;
}

function authHeaders() {
  if (!config.kie.apiKey) throw new Error('KIE_API_KEY not set');
  return {
    Authorization: `Bearer ${config.kie.apiKey}`,
    'Content-Type': 'application/json',
  };
}

export async function createVeoTask(input: VeoGenerateInput): Promise<string> {
  const body = {
    prompt: input.prompt,
    imageUrls: input.imageUrls,
    model: input.model || 'veo3_fast',
    aspect_ratio: input.aspect_ratio || '9:16',
    resolution: input.resolution || '1080p',
    callBackUrl: input.callBackUrl,
  };

  const res = await fetch(`${config.kie.baseUrl}/api/v1/veo/generate`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Veo generate ${res.status}: ${txt.slice(0, 500)}`);
  }
  const data = await res.json();
  if (data.code !== 200 || !data.data?.taskId) {
    throw new Error(`Veo generate error: ${data.msg || JSON.stringify(data).slice(0, 300)}`);
  }
  return data.data.taskId as string;
}

export async function getVeoTask(taskId: string): Promise<VeoTaskInfo> {
  const res = await fetch(
    `${config.kie.baseUrl}/api/v1/veo/record-info?taskId=${encodeURIComponent(taskId)}`,
    { headers: { Authorization: `Bearer ${config.kie.apiKey}` } }
  );
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Veo record-info ${res.status}: ${txt.slice(0, 500)}`);
  }
  const data = await res.json();

  // The kie.ai veo response shape (loose to handle minor changes):
  //   { code: 200, data: { taskId, info: { resultUrls, originUrls, resolution, ... }, fallbackFlag, status? } }
  // Status codes per docs: 0 generating | 1 success | 2 failed | 3 generation_failed.
  // Some kie.ai gateways return status inside data, others alongside info.
  const d = data.data || {};
  const info = d.info || {};
  const rawCode: number = typeof d.status === 'number' ? d.status
    : typeof d.taskStatus === 'number' ? d.taskStatus
    : typeof info.status === 'number' ? info.status
    : -1;

  let status: VeoTaskInfo['status'] = 'generating';
  if (rawCode === 1) status = 'success';
  else if (rawCode === 2 || rawCode === 3) status = 'failed';
  else status = 'generating';

  // resultUrls comes back either as a JSON array or a stringified array — normalize.
  let videoUrl: string | null = null;
  const ru = info.resultUrls ?? d.resultUrls;
  if (Array.isArray(ru) && ru.length > 0) videoUrl = String(ru[0]);
  else if (typeof ru === 'string') {
    try {
      const parsed = JSON.parse(ru);
      if (Array.isArray(parsed) && parsed.length > 0) videoUrl = String(parsed[0]);
      else if (typeof parsed === 'string') videoUrl = parsed;
    } catch {
      videoUrl = ru;
    }
  }

  // If we don't have an explicit numeric status but DO have a videoUrl, treat as success.
  if (status === 'generating' && videoUrl) status = 'success';

  return {
    status,
    fallback: !!d.fallbackFlag,
    videoUrl,
    resolution: info.resolution || null,
    rawCode,
  };
}

/** Downloads any URL into a Buffer (used to copy the video from kie's CDN to our Storage). */
export async function fetchToBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed ${res.status}: ${url}`);
  return Buffer.from(await res.arrayBuffer());
}
