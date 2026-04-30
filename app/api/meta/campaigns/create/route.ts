import { NextResponse } from 'next/server';
import {
  createCampaign,
  createAdSet,
  createAdCreative,
  createAd,
  MetaAuthError,
  MetaApiError,
} from '@/lib/meta-client';
import { getMetaContext, markConnectionExpired } from '@/lib/meta-route-helpers';
import type { CreateCampaignRequest, CreateCampaignResponse } from '@/types/meta';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request) {
  let body: CreateCampaignRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const {
    adAccountId,
    pageId,
    instagramId,
    campaignName,
    objective,
    dailyBudgetCents,
    link,
    cta,
    uploadIds,
    countries,
    targetingAgeMin,
    targetingAgeMax,
  } = body || ({} as CreateCampaignRequest);

  if (!adAccountId || !pageId || !campaignName || !objective || !dailyBudgetCents || !link) {
    return NextResponse.json(
      { error: 'Faltan campos: adAccountId, pageId, campaignName, objective, dailyBudgetCents, link' },
      { status: 400 },
    );
  }
  if (!Array.isArray(uploadIds) || uploadIds.length === 0) {
    return NextResponse.json({ error: 'Selecciona al menos un asset (uploadIds)' }, { status: 400 });
  }
  if (uploadIds.length > 10) {
    return NextResponse.json({ error: 'Máximo 10 anuncios por campaña' }, { status: 400 });
  }

  const result = await getMetaContext();
  if (!result.ok) return result.response;
  const { ctx } = result;

  // Load uploads + verify ownership and that they're ready.
  const { data: uploads, error: upErr } = await ctx.supabase
    .from('meta_uploads')
    .select('*')
    .in('id', uploadIds)
    .eq('clerk_user_id', ctx.userId)
    .eq('ad_account_id', adAccountId);
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
  if (!uploads || uploads.length !== uploadIds.length) {
    return NextResponse.json({ error: 'Algunos assets no existen o no están en esta cuenta' }, { status: 403 });
  }
  const notReady = uploads.filter((u) => u.status !== 'ready');
  if (notReady.length > 0) {
    return NextResponse.json(
      { error: `${notReady.length} asset(s) aún no están listos en Meta. Espera a que terminen de procesar.` },
      { status: 409 },
    );
  }

  const warnings: string[] = [];

  try {
    // 1. Campaign
    const campaign = await createCampaign(ctx.token, adAccountId, {
      name: campaignName,
      objective,
      status: 'PAUSED',
    });

    // 2. Ad set — single ad set, all ads inside it.
    const targeting: any = {
      age_min: targetingAgeMin ?? 18,
      age_max: targetingAgeMax ?? 65,
      geo_locations: { countries: countries && countries.length > 0 ? countries : ['US'] },
      publisher_platforms: ['facebook', 'instagram'],
      facebook_positions: ['feed', 'video_feeds', 'instream_video'],
      instagram_positions: ['stream', 'story', 'reels'],
    };
    const optimization_goal =
      objective === 'OUTCOME_SALES'
        ? 'OFFSITE_CONVERSIONS'
        : objective === 'OUTCOME_LEADS'
          ? 'LEAD_GENERATION'
          : objective === 'OUTCOME_TRAFFIC'
            ? 'LINK_CLICKS'
            : objective === 'OUTCOME_AWARENESS'
              ? 'REACH'
              : 'POST_ENGAGEMENT';

    const adset = await createAdSet(ctx.token, adAccountId, {
      name: `${campaignName} – Ad set`,
      campaign_id: campaign.id,
      daily_budget: dailyBudgetCents,
      optimization_goal,
      targeting,
      status: 'PAUSED',
    });

    // 3. Creative + ad per upload.
    const adIds: string[] = [];
    for (const u of uploads) {
      const meta = (u.ad_metadata ?? {}) as any;
      const adName = meta.name || u.id.slice(-8);
      const message = meta.primary_text || campaignName;
      try {
        const creative = await createAdCreative(ctx.token, adAccountId, {
          name: adName,
          page_id: pageId,
          instagram_actor_id: instagramId ?? null,
          link,
          message,
          headline: meta.headline,
          description: meta.description,
          cta: meta.cta || cta || 'SHOP_NOW',
          image_hash: u.asset_type === 'image' ? u.meta_asset_hash || undefined : undefined,
          video_id: u.asset_type === 'video' ? u.meta_asset_id || undefined : undefined,
          thumbnail_url: u.asset_type === 'video' ? meta.thumbnail_url || undefined : undefined,
        });
        const ad = await createAd(ctx.token, adAccountId, {
          name: adName,
          adset_id: adset.id,
          creative_id: creative.id,
          status: 'PAUSED',
        });
        adIds.push(ad.id);
      } catch (err: any) {
        const msg = err instanceof MetaApiError ? `[${err.code ?? '?'}] ${err.message}` : err?.message || 'unknown';
        warnings.push(`Asset ${u.id.slice(-6)}: ${msg}`);
      }
    }

    if (adIds.length === 0) {
      return NextResponse.json(
        { error: 'No se pudo crear ningún ad. Revisa los warnings.', warnings },
        { status: 502 },
      );
    }

    const response: CreateCampaignResponse = {
      campaign_id: campaign.id,
      adset_id: adset.id,
      ad_ids: adIds,
      warnings,
    };
    return NextResponse.json(response);
  } catch (err: any) {
    if (err instanceof MetaAuthError) {
      await markConnectionExpired(ctx.userId, err.message);
      return NextResponse.json({ requiresReconnect: true, error: err.message }, { status: 401 });
    }
    return NextResponse.json({ error: err?.message || 'Error en Meta API' }, { status: 502 });
  }
}
