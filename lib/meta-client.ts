import type {
  MetaAdAccount,
  MetaPage,
  MetaInstagramAccount,
  MetaCampaign,
  MetaAdSummary,
  MetaInsightsRow,
  MetaAdMediaKind,
} from '@/types/meta';

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

// ============================================================================
// Pages + Instagram
// ============================================================================

export async function listPages(token: string): Promise<MetaPage[]> {
  const params = new URLSearchParams({
    fields: 'id,name,category,picture{data{url}},instagram_business_account{id,username}',
    limit: '100',
    access_token: token,
  });
  const json = await metaFetch(`${BASE}/me/accounts?${params.toString()}`);
  const data = (json?.data ?? []) as Array<{
    id: string;
    name: string;
    category?: string;
    picture?: { data?: { url?: string } };
    instagram_business_account?: { id?: string; username?: string };
  }>;
  return data.map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category ?? null,
    picture_url: p.picture?.data?.url ?? null,
    has_instagram: !!p.instagram_business_account?.id,
  }));
}

export async function listInstagramAccountsForPage(
  token: string,
  pageId: string,
): Promise<MetaInstagramAccount[]> {
  const params = new URLSearchParams({
    fields: 'instagram_business_account{id,username,profile_picture_url}',
    access_token: token,
  });
  const json = await metaFetch(`${BASE}/${pageId}?${params.toString()}`);
  const ig = json?.instagram_business_account;
  if (!ig?.id) return [];
  return [
    {
      id: ig.id,
      username: ig.username,
      profile_picture_url: ig.profile_picture_url ?? null,
    },
  ];
}

// ============================================================================
// Campaigns / Ads listing + insights
// ============================================================================

export async function listCampaigns(
  token: string,
  adAccountId: string,
  opts: { limit?: number; effectiveStatus?: string[] } = {},
): Promise<MetaCampaign[]> {
  const acct = ensureActPrefix(adAccountId);
  const fields = [
    'id',
    'name',
    'objective',
    'status',
    'effective_status',
    'daily_budget',
    'lifetime_budget',
    'created_time',
  ].join(',');
  const params = new URLSearchParams({
    fields,
    limit: String(opts.limit ?? 25),
    access_token: token,
  });
  if (opts.effectiveStatus?.length) {
    params.set('effective_status', JSON.stringify(opts.effectiveStatus));
  }
  const json = await metaFetch(`${BASE}/${acct}/campaigns?${params.toString()}`);
  return ((json?.data ?? []) as MetaCampaign[]).map((c) => ({ ...c }));
}

const AD_FIELDS = [
  'id',
  'name',
  'status',
  'effective_status',
  'campaign_id',
  'campaign{name}',
  'adset_id',
  'adset{name}',
  'creative{id,thumbnail_url,object_story_spec,asset_feed_spec,video_id,image_url,image_hash,object_type,effective_object_story_id}',
].join(',');

function pickInsightsRow(rows: any[] | undefined): MetaInsightsRow | null {
  if (!rows || rows.length === 0) return null;
  const r = rows[0];
  const actions = (r.actions ?? []) as Array<{ action_type: string; value: string }>;
  const actionValues = (r.action_values ?? []) as Array<{ action_type: string; value: string }>;
  const purchaseAction = actions.find((a) => a.action_type === 'omni_purchase' || a.action_type === 'purchase');
  const purchaseValue = actionValues.find(
    (a) => a.action_type === 'omni_purchase' || a.action_type === 'purchase',
  );
  const purchases = purchaseAction ? Number(purchaseAction.value) : undefined;
  const purchase_value = purchaseValue ? Number(purchaseValue.value) : undefined;
  const spendNum = r.spend ? Number(r.spend) : undefined;
  const roas = purchase_value && spendNum ? purchase_value / spendNum : undefined;
  return {
    spend: r.spend,
    impressions: r.impressions,
    clicks: r.clicks,
    ctr: r.ctr,
    cpm: r.cpm,
    cpc: r.cpc,
    reach: r.reach,
    purchases,
    purchase_value,
    roas,
  };
}

function classifyMedia(creative: any): MetaAdMediaKind {
  if (!creative) return 'unknown';
  if (creative.video_id || creative.object_story_spec?.video_data) return 'video';
  if (creative.asset_feed_spec?.videos?.length) return 'video';
  if (creative.asset_feed_spec?.images?.length && creative.asset_feed_spec.images.length > 1)
    return 'carousel';
  if (creative.image_url || creative.image_hash || creative.object_story_spec?.link_data?.image_hash)
    return 'image';
  if (creative.object_story_spec?.link_data?.child_attachments) return 'carousel';
  return 'unknown';
}

function extractCreativeFields(creative: any): {
  thumbnail_url: string | null;
  image_url: string | null;
  video_id: string | null;
  primary_text: string | null;
  headline: string | null;
  cta: string | null;
  link_url: string | null;
  page_id: string | null;
} {
  const oss = creative?.object_story_spec ?? {};
  const link = oss.link_data ?? {};
  const video = oss.video_data ?? {};
  const afs = creative?.asset_feed_spec ?? {};
  const firstAfsBody = afs?.bodies?.[0]?.text ?? null;
  const firstAfsTitle = afs?.titles?.[0]?.text ?? null;
  const firstAfsCta = afs?.call_to_action_types?.[0] ?? null;
  const firstAfsLink = afs?.link_urls?.[0]?.website_url ?? null;
  return {
    thumbnail_url: creative?.thumbnail_url ?? null,
    image_url: creative?.image_url ?? null,
    video_id: creative?.video_id ?? video.video_id ?? afs?.videos?.[0]?.video_id ?? null,
    primary_text: link.message ?? video.message ?? firstAfsBody,
    headline: link.name ?? video.title ?? firstAfsTitle,
    cta: link.call_to_action?.type ?? video.call_to_action?.type ?? firstAfsCta,
    link_url: link.link ?? video.call_to_action?.value?.link ?? firstAfsLink,
    page_id: oss.page_id ?? null,
  };
}

export async function getVideoSourceUrl(token: string, videoId: string): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      fields: 'source,permalink_url',
      access_token: token,
    });
    const json = await metaFetch(`${BASE}/${videoId}?${params.toString()}`);
    return (json?.source ?? null) as string | null;
  } catch {
    return null;
  }
}

export async function listAdsWithInsights(
  token: string,
  adAccountId: string,
  opts: { limit?: number; campaignId?: string; datePreset?: string } = {},
): Promise<MetaAdSummary[]> {
  const acct = ensureActPrefix(adAccountId);
  const params = new URLSearchParams({
    fields: AD_FIELDS,
    limit: String(opts.limit ?? 25),
    access_token: token,
  });
  if (opts.campaignId) {
    params.set('filtering', JSON.stringify([{ field: 'campaign.id', operator: 'EQUAL', value: opts.campaignId }]));
  }
  const json = await metaFetch(`${BASE}/${acct}/ads?${params.toString()}`);
  const rows = (json?.data ?? []) as any[];

  // Insights + video sources in parallel — both make per-ad/per-video Graph
  // calls so doing them concurrently halves the wall-clock latency.
  const allCreatives = rows.map((r) => r.creative ?? {});
  const videoIds = allCreatives
    .map((c) => extractCreativeFields(c).video_id)
    .filter((v): v is string => !!v);

  const [insightsByAd, videoSourceById] = await Promise.all([
    fetchInsightsForAds(token, rows.map((r) => r.id), opts.datePreset || 'last_30d'),
    fetchVideoSources(token, videoIds),
  ]);

  const ads: MetaAdSummary[] = rows.map((row) => {
    const creative = row.creative ?? {};
    const media_kind = classifyMedia(creative);
    const fields = extractCreativeFields(creative);
    const video_source_url = fields.video_id ? (videoSourceById.get(fields.video_id) ?? null) : null;
    return {
      id: row.id,
      name: row.name,
      status: row.status,
      effective_status: row.effective_status,
      campaign_id: row.campaign_id ?? row.campaign?.id,
      campaign_name: row.campaign?.name,
      adset_id: row.adset_id ?? row.adset?.id,
      adset_name: row.adset?.name,
      creative_id: creative.id,
      media_kind,
      thumbnail_url: fields.thumbnail_url,
      video_id: fields.video_id,
      video_source_url,
      image_url: fields.image_url,
      primary_text: fields.primary_text,
      headline: fields.headline,
      cta: fields.cta,
      link_url: fields.link_url,
      page_id: fields.page_id,
      insights: insightsByAd.get(row.id) ?? null,
    };
  });

  return ads;
}

async function fetchVideoSources(
  token: string,
  videoIds: string[],
): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();
  if (videoIds.length === 0) return map;
  const unique = Array.from(new Set(videoIds));
  const chunkSize = 6;
  for (let i = 0; i < unique.length; i += chunkSize) {
    const slice = unique.slice(i, i + chunkSize);
    const results = await Promise.allSettled(
      slice.map(async (id) => {
        const src = await getVideoSourceUrl(token, id);
        return [id, src] as const;
      }),
    );
    for (const r of results) {
      if (r.status === 'fulfilled') map.set(r.value[0], r.value[1]);
    }
  }
  return map;
}

async function fetchInsightsForAds(
  token: string,
  adIds: string[],
  datePreset: string,
): Promise<Map<string, MetaInsightsRow | null>> {
  const map = new Map<string, MetaInsightsRow | null>();
  if (adIds.length === 0) return map;
  const fields = [
    'spend',
    'impressions',
    'clicks',
    'ctr',
    'cpm',
    'cpc',
    'reach',
    'actions',
    'action_values',
  ].join(',');
  // Fetch in parallel chunks (Meta supports per-ad insights edge directly)
  const chunkSize = 6;
  for (let i = 0; i < adIds.length; i += chunkSize) {
    const slice = adIds.slice(i, i + chunkSize);
    const results = await Promise.allSettled(
      slice.map(async (id) => {
        const params = new URLSearchParams({
          fields,
          date_preset: datePreset,
          access_token: token,
        });
        const json = await metaFetch(`${BASE}/${id}/insights?${params.toString()}`);
        const row = pickInsightsRow(json?.data ?? []);
        return [id, row] as const;
      }),
    );
    for (const r of results) {
      if (r.status === 'fulfilled') map.set(r.value[0], r.value[1]);
    }
  }
  return map;
}

export async function getAdInsights(
  token: string,
  adId: string,
  datePreset = 'last_30d',
): Promise<MetaInsightsRow | null> {
  const params = new URLSearchParams({
    fields: 'spend,impressions,clicks,ctr,cpm,cpc,reach,actions,action_values',
    date_preset: datePreset,
    access_token: token,
  });
  const json = await metaFetch(`${BASE}/${adId}/insights?${params.toString()}`);
  return pickInsightsRow(json?.data ?? []);
}

// ============================================================================
// Campaign creation
// ============================================================================

export async function createCampaign(
  token: string,
  adAccountId: string,
  payload: {
    name: string;
    objective: string;
    status?: 'ACTIVE' | 'PAUSED';
    special_ad_categories?: string[];
  },
): Promise<{ id: string }> {
  const acct = ensureActPrefix(adAccountId);
  const body = new URLSearchParams({
    name: payload.name,
    objective: payload.objective,
    status: payload.status ?? 'PAUSED',
    special_ad_categories: JSON.stringify(payload.special_ad_categories ?? []),
    access_token: token,
  });
  const json = await metaFetch(`${BASE}/${acct}/campaigns`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!json?.id) throw new MetaApiError('Meta no devolvió campaign id');
  return { id: String(json.id) };
}

export async function createAdSet(
  token: string,
  adAccountId: string,
  payload: {
    name: string;
    campaign_id: string;
    daily_budget: number;            // cents
    billing_event?: string;
    optimization_goal?: string;
    targeting: any;
    status?: 'ACTIVE' | 'PAUSED';
    promoted_object?: any;
    bid_strategy?: string;
    start_time?: string;
  },
): Promise<{ id: string }> {
  const acct = ensureActPrefix(adAccountId);
  const body = new URLSearchParams({
    name: payload.name,
    campaign_id: payload.campaign_id,
    daily_budget: String(payload.daily_budget),
    billing_event: payload.billing_event ?? 'IMPRESSIONS',
    optimization_goal: payload.optimization_goal ?? 'OFFSITE_CONVERSIONS',
    targeting: JSON.stringify(payload.targeting),
    status: payload.status ?? 'PAUSED',
    bid_strategy: payload.bid_strategy ?? 'LOWEST_COST_WITHOUT_CAP',
    access_token: token,
  });
  if (payload.promoted_object) body.set('promoted_object', JSON.stringify(payload.promoted_object));
  if (payload.start_time) body.set('start_time', payload.start_time);
  const json = await metaFetch(`${BASE}/${acct}/adsets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!json?.id) throw new MetaApiError('Meta no devolvió adset id');
  return { id: String(json.id) };
}

export interface CreateAdCreativePayload {
  name: string;
  page_id: string;
  instagram_actor_id?: string | null;
  link: string;
  message: string;
  headline?: string;
  description?: string;
  cta?: string;
  image_hash?: string;
  video_id?: string;
  thumbnail_url?: string;
}

export async function createAdCreative(
  token: string,
  adAccountId: string,
  payload: CreateAdCreativePayload,
): Promise<{ id: string }> {
  const acct = ensureActPrefix(adAccountId);
  const cta = payload.cta || 'SHOP_NOW';
  const linkData: any = {
    link: payload.link,
    message: payload.message,
    call_to_action: { type: cta, value: { link: payload.link } },
  };
  if (payload.headline) linkData.name = payload.headline;
  if (payload.description) linkData.description = payload.description;

  const objectStorySpec: any = { page_id: payload.page_id };
  if (payload.instagram_actor_id) objectStorySpec.instagram_actor_id = payload.instagram_actor_id;

  if (payload.video_id) {
    const videoData: any = {
      video_id: payload.video_id,
      message: payload.message,
      call_to_action: { type: cta, value: { link: payload.link } },
    };
    if (payload.headline) videoData.title = payload.headline;
    if (payload.thumbnail_url) videoData.image_url = payload.thumbnail_url;
    objectStorySpec.video_data = videoData;
  } else if (payload.image_hash) {
    linkData.image_hash = payload.image_hash;
    objectStorySpec.link_data = linkData;
  } else {
    throw new MetaApiError('Necesitas image_hash o video_id para crear creative');
  }

  const body = new URLSearchParams({
    name: payload.name,
    object_story_spec: JSON.stringify(objectStorySpec),
    access_token: token,
  });
  const json = await metaFetch(`${BASE}/${acct}/adcreatives`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!json?.id) throw new MetaApiError('Meta no devolvió creative id');
  return { id: String(json.id) };
}

export async function createAd(
  token: string,
  adAccountId: string,
  payload: {
    name: string;
    adset_id: string;
    creative_id: string;
    status?: 'ACTIVE' | 'PAUSED';
  },
): Promise<{ id: string }> {
  const acct = ensureActPrefix(adAccountId);
  const body = new URLSearchParams({
    name: payload.name,
    adset_id: payload.adset_id,
    creative: JSON.stringify({ creative_id: payload.creative_id }),
    status: payload.status ?? 'PAUSED',
    access_token: token,
  });
  const json = await metaFetch(`${BASE}/${acct}/ads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!json?.id) throw new MetaApiError('Meta no devolvió ad id');
  return { id: String(json.id) };
}
