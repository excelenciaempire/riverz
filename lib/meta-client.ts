import type { MetaAdAccount } from '@/types/meta';

const API_VERSION = process.env.META_GRAPH_API_VERSION || 'v23.0';
const BASE = `https://graph.facebook.com/${API_VERSION}`;

export class MetaAuthError extends Error {
  constructor(message: string, public code?: number) {
    super(message);
    this.name = 'MetaAuthError';
  }
}

export class MetaApiError extends Error {
  constructor(
    message: string,
    public code?: number,
    public subcode?: number,
    public httpStatus?: number,
  ) {
    super(message);
    this.name = 'MetaApiError';
  }
}

interface MetaErrorPayload {
  error?: {
    message?: string;
    code?: number;
    error_subcode?: number;
    type?: string;
  };
}

const RATE_LIMIT_CODES = new Set([4, 17, 32, 613]);
const AUTH_ERROR_CODES = new Set([190, 102, 463]);
const MAX_RETRIES = 3;

async function metaFetch(url: string, init: RequestInit = {}): Promise<any> {
  let attempt = 0;
  let lastError: unknown;
  while (attempt <= MAX_RETRIES) {
    const res = await fetch(url, init);
    let json: any = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }

    if (res.ok) {
      const usageHeader = res.headers.get('x-business-use-case-usage');
      if (usageHeader) {
        try {
          const usage = JSON.parse(usageHeader);
          for (const accountUsage of Object.values(usage) as any[]) {
            if (Array.isArray(accountUsage)) {
              for (const entry of accountUsage) {
                const max = Math.max(
                  Number(entry?.call_count ?? 0),
                  Number(entry?.total_cputime ?? 0),
                  Number(entry?.total_time ?? 0),
                );
                if (max > 75) {
                  await sleep(1000 + Math.random() * 1000);
                }
              }
            }
          }
        } catch {
          /* ignore malformed header */
        }
      }
      return json;
    }

    const err: MetaErrorPayload = json || {};
    const code = err.error?.code;
    const subcode = err.error?.error_subcode;
    const message = err.error?.message || `Meta API HTTP ${res.status}`;

    if (code && AUTH_ERROR_CODES.has(code)) {
      throw new MetaAuthError(message, code);
    }

    if (code && RATE_LIMIT_CODES.has(code) && attempt < MAX_RETRIES) {
      const delay = Math.pow(4, attempt) * 1000 + Math.random() * 500;
      await sleep(delay);
      attempt += 1;
      lastError = new MetaApiError(message, code, subcode, res.status);
      continue;
    }

    throw new MetaApiError(message, code, subcode, res.status);
  }
  throw lastError ?? new MetaApiError('Meta API exhausted retries');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

export interface FbTokenResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
}

export async function exchangeCodeForToken(code: string, redirectUri: string): Promise<FbTokenResponse> {
  const params = new URLSearchParams({
    client_id: requireEnv('META_APP_ID'),
    client_secret: requireEnv('META_APP_SECRET'),
    redirect_uri: redirectUri,
    code,
  });
  return metaFetch(`${BASE}/oauth/access_token?${params.toString()}`);
}

export async function getLongLivedToken(shortToken: string): Promise<FbTokenResponse> {
  const params = new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: requireEnv('META_APP_ID'),
    client_secret: requireEnv('META_APP_SECRET'),
    fb_exchange_token: shortToken,
  });
  return metaFetch(`${BASE}/oauth/access_token?${params.toString()}`);
}

export async function getMe(token: string): Promise<{ id: string; name: string }> {
  const params = new URLSearchParams({
    fields: 'id,name',
    access_token: token,
  });
  return metaFetch(`${BASE}/me?${params.toString()}`);
}

export async function listAdAccounts(token: string): Promise<MetaAdAccount[]> {
  const params = new URLSearchParams({
    fields: 'id,account_id,name,currency,business{name}',
    limit: '100',
    access_token: token,
  });
  const json = await metaFetch(`${BASE}/me/adaccounts?${params.toString()}`);
  const data = (json?.data ?? []) as Array<{
    id: string;
    account_id: string;
    name: string;
    currency?: string;
    business?: { name?: string };
  }>;
  return data.map((acc) => ({
    id: acc.id,
    account_id: acc.account_id,
    name: acc.name,
    currency: acc.currency,
    business_name: acc.business?.name ?? null,
  }));
}

export interface UploadImageResult {
  hash: string;
  url?: string;
  name: string;
}

export async function uploadImageFromUrl(
  token: string,
  adAccountId: string,
  imageUrl: string,
  name: string,
): Promise<UploadImageResult> {
  const acct = ensureActPrefix(adAccountId);
  const body = new URLSearchParams({
    url: imageUrl,
    name,
    access_token: token,
  });
  const json = await metaFetch(`${BASE}/${acct}/adimages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const images = json?.images || {};
  const first = Object.values(images)[0] as { hash?: string; url?: string } | undefined;
  if (!first?.hash) {
    throw new MetaApiError('Meta did not return an image hash');
  }
  return { hash: first.hash, url: first.url, name };
}

export interface UploadVideoResult {
  id: string;
}

export async function uploadVideoFromUrl(
  token: string,
  adAccountId: string,
  fileUrl: string,
  name: string,
): Promise<UploadVideoResult> {
  const acct = ensureActPrefix(adAccountId);
  const body = new URLSearchParams({
    file_url: fileUrl,
    name,
    access_token: token,
  });
  const json = await metaFetch(`${BASE}/${acct}/advideos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!json?.id) {
    throw new MetaApiError('Meta did not return a video id');
  }
  return { id: String(json.id) };
}

export type MetaVideoStatus = 'processing' | 'ready' | 'error';

export interface VideoStatusResult {
  status: MetaVideoStatus;
  progress?: number;
  errorMessage?: string;
}

export async function getVideoStatus(token: string, videoId: string): Promise<VideoStatusResult> {
  const params = new URLSearchParams({
    fields: 'status',
    access_token: token,
  });
  const json = await metaFetch(`${BASE}/${videoId}?${params.toString()}`);
  const raw = json?.status?.video_status as string | undefined;
  const progress = json?.status?.processing_progress as number | undefined;
  const errorMessage = json?.status?.error?.message as string | undefined;
  let status: MetaVideoStatus;
  if (raw === 'ready') status = 'ready';
  else if (raw === 'error') status = 'error';
  else status = 'processing';
  return { status, progress, errorMessage };
}

function ensureActPrefix(adAccountId: string): string {
  return adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
}
