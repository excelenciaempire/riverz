import { NextResponse } from 'next/server';
import { listAdsWithInsights, MetaAuthError, MetaApiError } from '@/lib/meta-client';
import {
  getMetaContext,
  markConnectionExpired,
  checkRateLimit,
} from '@/lib/meta-route-helpers';
import { bindMetaUsageReporter } from '@/lib/meta-rate-limit-bridge';
import type { MetaAdSummary } from '@/types/meta';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Server-side cache TTL for the ads list payload. 5 minutes lets a user
// reload + drill into campaigns/adsets without burning their hourly BUC
// budget on each visit. Bypassed via ?fresh=1.
const ADS_CACHE_TTL_MS = 5 * 60 * 1000;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const adAccountId = url.searchParams.get('adAccountId');
  const limit = Number(url.searchParams.get('limit') || 30);
  const datePreset = url.searchParams.get('datePreset') || 'last_30d';
  const campaignId = url.searchParams.get('campaignId') || undefined;
  const force = url.searchParams.get('fresh') === '1';

  if (!adAccountId) {
    return NextResponse.json({ error: 'adAccountId requerido' }, { status: 400 });
  }

  const result = await getMetaContext();
  if (!result.ok) return result.response;
  const { ctx } = result;

  // Respect any persisted cooldown. If we're inside the window we serve
  // whatever cache we have, otherwise return a 429 the UI can render.
  const limited = await checkRateLimit(ctx.supabase, ctx.userId, adAccountId);
  if (limited) {
    const cached = await loadAdsCache(ctx, adAccountId, datePreset);
    if (cached) {
      // Hydrate intel afresh — it's local to our DB so no rate-limit risk.
      await hydrateIntel(ctx, cached.ads, ctx.userId);
      return NextResponse.json({
        ads: cached.ads,
        cachedAt: cached.cached_at,
        rateLimited: true,
      });
    }
    return limited;
  }

  // Serve the 5-minute cache when fresh.
  if (!force && !campaignId) {
    const cached = await loadAdsCache(ctx, adAccountId, datePreset);
    if (cached && Date.now() - new Date(cached.cached_at).getTime() < ADS_CACHE_TTL_MS) {
      await hydrateIntel(ctx, cached.ads, ctx.userId);
      return NextResponse.json({ ads: cached.ads, cachedAt: cached.cached_at, fromCache: true });
    }
  }

  // Bind the reporter so any 80004 / high-usage signal updates the
  // cooldown row before we even return.
  const unbind = bindMetaUsageReporter(ctx.supabase, ctx.userId);
  try {
    // Pre-load cached video URLs so listAdsWithInsights can skip its
    // expensive second-pass fallback for ads we already resolved.
    const cachedAssetByAdId = await loadCachedAssetUrls(ctx, adAccountId);

    const ads: MetaAdSummary[] = await listAdsWithInsights(ctx.token, adAccountId, {
      limit,
      datePreset,
      campaignId,
      cachedAssetByAdId,
    });

    await hydrateIntel(ctx, ads, ctx.userId);
    await upsertAdIntelSnapshots(ctx, adAccountId, ads);
    if (!campaignId) {
      await saveAdsCache(ctx, adAccountId, datePreset, ads);
    }

    return NextResponse.json({ ads });
  } catch (err: any) {
    if (err instanceof MetaAuthError) {
      await markConnectionExpired(ctx.userId, err.message);
      return NextResponse.json({ requiresReconnect: true, error: err.message }, { status: 401 });
    }
    if (err instanceof MetaApiError && err.code && err.code >= 80000 && err.code <= 80099) {
      // BUC throttle — usage reporter already wrote a cooldown. Surface
      // any cached payload + the rate-limited flag.
      const cached = await loadAdsCache(ctx, adAccountId, datePreset);
      if (cached) {
        await hydrateIntel(ctx, cached.ads, ctx.userId);
        return NextResponse.json({
          ads: cached.ads,
          cachedAt: cached.cached_at,
          rateLimited: true,
          message: err.message,
        });
      }
      return NextResponse.json(
        { rateLimited: true, error: err.message, retryAfterSec: 60 * 60 },
        { status: 429, headers: { 'retry-after': '3600' } },
      );
    }
    return NextResponse.json({ error: err?.message || 'Error en Meta API' }, { status: 502 });
  } finally {
    unbind();
  }
}

// ---------------------------------------------------------------------------
// Cache helpers
// ---------------------------------------------------------------------------

async function loadAdsCache(
  ctx: { userId: string; supabase: any },
  adAccountId: string,
  datePreset: string,
): Promise<{ ads: MetaAdSummary[]; cached_at: string } | null> {
  const { data } = await ctx.supabase
    .from('meta_ads_cache')
    .select('payload, cached_at')
    .eq('clerk_user_id', ctx.userId)
    .eq('ad_account_id', adAccountId)
    .eq('date_preset', datePreset)
    .maybeSingle();
  if (!data) return null;
  const ads = (data.payload?.ads ?? []) as MetaAdSummary[];
  return { ads, cached_at: data.cached_at };
}

async function saveAdsCache(
  ctx: { userId: string; supabase: any },
  adAccountId: string,
  datePreset: string,
  ads: MetaAdSummary[],
): Promise<void> {
  await ctx.supabase.from('meta_ads_cache').upsert(
    {
      clerk_user_id: ctx.userId,
      ad_account_id: adAccountId,
      date_preset: datePreset,
      payload: { ads },
      cached_at: new Date().toISOString(),
    },
    { onConflict: 'clerk_user_id,ad_account_id,date_preset' },
  );
}

/**
 * Returns the cached video/image URL per ad so listAdsWithInsights can
 * skip its preview-iframe scrape pass for ads we already resolved.
 */
async function loadCachedAssetUrls(
  ctx: { userId: string; supabase: any },
  adAccountId: string,
): Promise<Map<string, string>> {
  const { data } = await ctx.supabase
    .from('meta_ad_intel')
    .select('meta_ad_id, asset_url')
    .eq('clerk_user_id', ctx.userId)
    .eq('ad_account_id', adAccountId)
    .not('asset_url', 'is', null);
  const map = new Map<string, string>();
  for (const row of data ?? []) {
    if (row.asset_url) map.set(row.meta_ad_id, row.asset_url);
  }
  return map;
}

async function hydrateIntel(
  ctx: { userId: string; supabase: any },
  ads: MetaAdSummary[],
  userId: string,
): Promise<void> {
  const adIds = ads.map((a) => a.id);
  if (adIds.length === 0) return;
  const { data: intel } = await ctx.supabase
    .from('meta_ad_intel')
    .select('*')
    .eq('clerk_user_id', userId)
    .in('meta_ad_id', adIds);
  const intelByAd = new Map((intel ?? []).map((i: any) => [i.meta_ad_id, i]));
  for (const ad of ads) {
    ad.intel = (intelByAd.get(ad.id) as any) ?? null;
  }
}

async function upsertAdIntelSnapshots(
  ctx: { userId: string; supabase: any },
  adAccountId: string,
  ads: MetaAdSummary[],
) {
  if (ads.length === 0) return;
  const rows = ads.map((ad) => ({
    clerk_user_id: ctx.userId,
    ad_account_id: adAccountId,
    meta_ad_id: ad.id,
    meta_creative_id: ad.creative_id ?? null,
    asset_type: ad.media_kind,
    thumbnail_url: ad.thumbnail_url,
    asset_url:
      ad.media_kind === 'video' ? (ad.video_source_url ?? null) : (ad.image_url ?? null),
    ad_name: ad.name,
    campaign_id: ad.campaign_id ?? null,
    campaign_name: ad.campaign_name ?? null,
    adset_id: ad.adset_id ?? null,
    adset_name: ad.adset_name ?? null,
    page_id: ad.page_id ?? null,
    primary_text: ad.primary_text ?? null,
    headline: ad.headline ?? null,
    cta: ad.cta ?? null,
    link_url: ad.link_url ?? null,
    effective_status: ad.effective_status ?? null,
    insights: ad.insights ?? null,
    insights_synced_at: new Date().toISOString(),
  }));
  await ctx.supabase
    .from('meta_ad_intel')
    .upsert(rows, { onConflict: 'clerk_user_id,meta_ad_id', ignoreDuplicates: false });
}
