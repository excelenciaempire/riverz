import { NextResponse } from 'next/server';
import { listAdsWithInsights, MetaAuthError } from '@/lib/meta-client';
import { getMetaContext, markConnectionExpired } from '@/lib/meta-route-helpers';
import type { MetaAdSummary } from '@/types/meta';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const adAccountId = url.searchParams.get('adAccountId');
  const limit = Number(url.searchParams.get('limit') || 30);
  const datePreset = url.searchParams.get('datePreset') || 'last_30d';
  const campaignId = url.searchParams.get('campaignId') || undefined;

  if (!adAccountId) {
    return NextResponse.json({ error: 'adAccountId requerido' }, { status: 400 });
  }

  const result = await getMetaContext();
  if (!result.ok) return result.response;
  const { ctx } = result;

  try {
    const ads: MetaAdSummary[] = await listAdsWithInsights(ctx.token, adAccountId, {
      limit,
      datePreset,
      campaignId,
    });

    // Hydrate AI intel from our DB.
    const adIds = ads.map((a) => a.id);
    if (adIds.length > 0) {
      const { data: intel } = await ctx.supabase
        .from('meta_ad_intel')
        .select('*')
        .eq('clerk_user_id', ctx.userId)
        .in('meta_ad_id', adIds);
      const intelByAd = new Map((intel ?? []).map((i: any) => [i.meta_ad_id, i]));
      for (const ad of ads) {
        ad.intel = (intelByAd.get(ad.id) as any) ?? null;
      }
    }

    // Persist a lightweight snapshot so ad_intel grows over time.
    await upsertAdIntelSnapshots(ctx, adAccountId, ads);

    return NextResponse.json({ ads });
  } catch (err: any) {
    if (err instanceof MetaAuthError) {
      await markConnectionExpired(ctx.userId, err.message);
      return NextResponse.json({ requiresReconnect: true, error: err.message }, { status: 401 });
    }
    return NextResponse.json({ error: err?.message || 'Error en Meta API' }, { status: 502 });
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
    asset_url: ad.image_url ?? null,
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
  // upsert keyed by (clerk_user_id, meta_ad_id)
  await ctx.supabase
    .from('meta_ad_intel')
    .upsert(rows, { onConflict: 'clerk_user_id,meta_ad_id', ignoreDuplicates: false });
}
