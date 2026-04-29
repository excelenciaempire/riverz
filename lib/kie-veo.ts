const KIE_API_KEY = process.env.KIE_API_KEY;
const KIE_BASE_URL = process.env.KIE_BASE_URL || 'https://api.kie.ai';

export type VeoModel = 'veo3' | 'veo3_fast' | 'veo3_lite';
export type VeoAspect = '16:9' | '9:16' | 'Auto';
export type VeoResolution = '720p' | '1080p' | '4k';

export interface VeoGenerateInput {
  prompt: string;
  imageUrls?: string[];
  model?: VeoModel;
  aspect_ratio?: VeoAspect;
  resolution?: VeoResolution;
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
  if (!KIE_API_KEY) throw new Error('KIE_API_KEY not set');
  return {
    Authorization: `Bearer ${KIE_API_KEY}`,
    'Content-Type': 'application/json',
  };
}

export async function createVeoTask(input: VeoGenerateInput): Promise<string> {
  const body: Record<string, unknown> = {
    prompt: input.prompt,
    model: input.model || 'veo3_fast',
    aspect_ratio: input.aspect_ratio || '9:16',
    resolution: input.resolution || '1080p',
  };
  if (input.imageUrls && input.imageUrls.length > 0) body.imageUrls = input.imageUrls;
  if (input.callBackUrl) body.callBackUrl = input.callBackUrl;

  const res = await fetch(`${KIE_BASE_URL}/api/v1/veo/generate`, {
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
    `${KIE_BASE_URL}/api/v1/veo/record-info?taskId=${encodeURIComponent(taskId)}`,
    { headers: { Authorization: `Bearer ${KIE_API_KEY}` } },
  );
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Veo record-info ${res.status}: ${txt.slice(0, 500)}`);
  }
  const data = await res.json();

  // record-info shape per https://docs.kie.ai/veo3-api/get-veo-3-video-details:
  //   data.successFlag: 0=generating, 1=success, 2=failed, 3=generation_failed
  //   data.resultUrls: stringified JSON array of mp4 URLs
  // Older gateway variants have used data.status / data.taskStatus / data.info.status,
  // so we fall back to those if successFlag is missing.
  const d = data.data || {};
  const info = d.info || {};
  const rawCode: number =
    typeof d.successFlag === 'number'
      ? d.successFlag
      : typeof d.status === 'number'
      ? d.status
      : typeof d.taskStatus === 'number'
      ? d.taskStatus
      : typeof info.status === 'number'
      ? info.status
      : -1;

  let status: VeoTaskInfo['status'] = 'generating';
  if (rawCode === 1) status = 'success';
  else if (rawCode === 2 || rawCode === 3) status = 'failed';

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

  if (status === 'generating' && videoUrl) status = 'success';

  return {
    status,
    fallback: !!d.fallbackFlag,
    videoUrl,
    resolution: info.resolution || null,
    rawCode,
  };
}

export async function downloadToBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed ${res.status}: ${url}`);
  return Buffer.from(await res.arrayBuffer());
}
