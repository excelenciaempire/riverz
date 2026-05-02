import { NextResponse } from 'next/server';
import {
  createCampaign,
  createAdSet,
  createAdCreative,
  createAd,
  MetaAuthError,
  MetaApiError,
  type CreativeFeatureToggles,
} from '@/lib/meta-client';
import { getMetaContext, markConnectionExpired } from '@/lib/meta-route-helpers';
import type {
  CampaignTarget,
  AdSetTarget,
  LaunchAdRow,
  LaunchRequest,
  LaunchResponse,
  LaunchRowResult,
} from '@/types/meta';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function objectiveToOptimizationGoal(objective: string): string {
  switch (objective) {
    case 'OUTCOME_SALES':
      return 'OFFSITE_CONVERSIONS';
    case 'OUTCOME_LEADS':
      return 'LEAD_GENERATION';
    case 'OUTCOME_TRAFFIC':
      return 'LINK_CLICKS';
    case 'OUTCOME_AWARENESS':
      return 'REACH';
    default:
      return 'POST_ENGAGEMENT';
  }
}

function campaignKey(target: CampaignTarget): string {
  if (target.kind === 'existing') return `existing:${target.id}`;
  return `new:${target.spec.name}|${target.spec.objective}`;
}

function adsetKey(campaignKeyVal: string, target: AdSetTarget): string {
  if (target.kind === 'existing') return `existing:${target.id}`;
  // El nombre del adset puede repetirse entre campañas — incluyo la campaign key.
  return `new:${campaignKeyVal}|${target.spec.name}|${target.spec.daily_budget_cents}|${target.spec.countries.join(',')}|${target.spec.age_min}-${target.spec.age_max}`;
}

export async function POST(req: Request) {
  let body: LaunchRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }
  const { adAccountId, rows } = body || ({} as LaunchRequest);
  if (!adAccountId) return NextResponse.json({ error: 'adAccountId requerido' }, { status: 400 });
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'rows vacío' }, { status: 400 });
  }

  const result = await getMetaContext();
  if (!result.ok) return result.response;
  const { ctx } = result;

  // Identidad por defecto desde la conexión
  const defaultPageId = (ctx.connection?.default_page_id as string | null) || undefined;
  const defaultIgId = (ctx.connection?.default_instagram_id as string | null) || undefined;

  // Verificar uploads
  const uploadIds = Array.from(new Set(rows.map((r) => r.uploadId)));
  const { data: uploads, error: upErr } = await ctx.supabase
    .from('meta_uploads')
    .select('*')
    .in('id', uploadIds)
    .eq('clerk_user_id', ctx.userId)
    .eq('ad_account_id', adAccountId);
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
  if (!uploads || uploads.length !== uploadIds.length) {
    return NextResponse.json(
      { error: 'Algunos assets no existen o no están en esta cuenta' },
      { status: 403 },
    );
  }
  const notReady = uploads.filter((u: any) => u.status !== 'ready');
  if (notReady.length > 0) {
    return NextResponse.json(
      {
        error: `${notReady.length} asset(s) aún no están listos en Meta. Espera a que terminen de procesar.`,
      },
      { status: 409 },
    );
  }
  const uploadById = new Map<string, any>(uploads.map((u: any) => [u.id, u]));

  const warnings: string[] = [];
  const createdCampaigns: Array<{ id: string; name: string }> = [];
  const createdAdSets: Array<{ id: string; name: string; campaign_id: string }> = [];
  const rowResults: LaunchRowResult[] = [];

  // Caches de IDs creados/resueltos en este request
  const campaignIdByKey = new Map<string, string>();
  const adsetIdByKey = new Map<string, string>();
  const adsetCampaignIdByKey = new Map<string, string>();

  try {
    for (const row of rows as LaunchAdRow[]) {
      const upload = uploadById.get(row.uploadId);
      if (!upload) {
        rowResults.push({
          rowId: row.rowId,
          uploadId: row.uploadId,
          error: 'Upload no encontrado',
        });
        continue;
      }
      const cKey = campaignKey(row.campaign);
      let campaignId = campaignIdByKey.get(cKey);
      if (!campaignId) {
        if (row.campaign.kind === 'existing') {
          campaignId = row.campaign.id;
        } else {
          const spec = row.campaign.spec;
          const created = await createCampaign(ctx.token, adAccountId, {
            name: spec.name,
            objective: spec.objective,
            status: 'PAUSED',
          });
          campaignId = created.id;
          createdCampaigns.push({ id: campaignId, name: spec.name });
        }
        campaignIdByKey.set(cKey, campaignId);
      }

      const aKey = adsetKey(cKey, row.adset);
      let adsetId = adsetIdByKey.get(aKey);
      if (!adsetId) {
        if (row.adset.kind === 'existing') {
          adsetId = row.adset.id;
        } else {
          const spec = row.adset.spec;
          const targeting: any = {
            age_min: spec.age_min,
            age_max: spec.age_max,
            geo_locations: { countries: spec.countries },
            publisher_platforms: spec.publisher_platforms ?? ['facebook', 'instagram'],
            facebook_positions: ['feed', 'video_feeds', 'instream_video'],
            instagram_positions: ['stream', 'story', 'reels'],
          };
          const objectiveForOpt =
            row.campaign.kind === 'new' ? row.campaign.spec.objective : 'OUTCOME_SALES';
          const created = await createAdSet(ctx.token, adAccountId, {
            name: spec.name,
            campaign_id: campaignId,
            daily_budget: spec.daily_budget_cents,
            optimization_goal: objectiveToOptimizationGoal(objectiveForOpt),
            targeting,
            status: 'PAUSED',
          });
          adsetId = created.id;
          createdAdSets.push({ id: adsetId, name: spec.name, campaign_id: campaignId });
        }
        adsetIdByKey.set(aKey, adsetId);
        adsetCampaignIdByKey.set(aKey, campaignId);
      }

      // Identidad: por fila > default de la cuenta
      const pageId =
        row.metadata.page_id_override ||
        row.identity?.page_id ||
        defaultPageId;
      const igId =
        row.metadata.instagram_actor_id_override ||
        row.identity?.instagram_actor_id ||
        defaultIgId ||
        null;
      if (!pageId) {
        rowResults.push({
          rowId: row.rowId,
          uploadId: row.uploadId,
          campaignId,
          adsetId,
          error: 'Falta page_id (configura tu Fan Page en /campanas/meta)',
        });
        continue;
      }

      const meta = row.metadata || {};
      const link = meta.link_url;
      if (!link) {
        rowResults.push({
          rowId: row.rowId,
          uploadId: row.uploadId,
          campaignId,
          adsetId,
          error: 'Falta destination URL (link_url)',
        });
        continue;
      }

      const adName =
        meta.name?.trim() ||
        `Ad ${row.uploadId.slice(-6)}`;
      const message =
        (meta.primary_texts && meta.primary_texts[0]) ||
        meta.primary_text ||
        meta.headline ||
        adName;

      try {
        const creative = await createAdCreative(ctx.token, adAccountId, {
          name: adName,
          page_id: pageId,
          instagram_actor_id: igId,
          link,
          message,
          headline: meta.headline,
          description: meta.description,
          cta: meta.cta || 'SHOP_NOW',
          image_hash: upload.asset_type === 'image' ? upload.meta_asset_hash || undefined : undefined,
          video_id: upload.asset_type === 'video' ? upload.meta_asset_id || undefined : undefined,
          thumbnail_url:
            upload.asset_type === 'video' ? meta.thumbnail_url || undefined : undefined,
          display_url: meta.display_url,
          url_params: meta.url_params,
          primary_texts: meta.primary_texts,
          headlines: meta.headlines,
          descriptions: meta.descriptions,
          ai_features: meta.ai_features as CreativeFeatureToggles | undefined,
        });
        const ad = await createAd(ctx.token, adAccountId, {
          name: adName,
          adset_id: adsetId,
          creative_id: creative.id,
          status: 'PAUSED',
        });
        rowResults.push({
          rowId: row.rowId,
          uploadId: row.uploadId,
          campaignId,
          adsetId,
          adId: ad.id,
        });
      } catch (err: any) {
        const msg =
          err instanceof MetaApiError
            ? `[${err.code ?? '?'}] ${err.message}`
            : err?.message || 'unknown';
        rowResults.push({
          rowId: row.rowId,
          uploadId: row.uploadId,
          campaignId,
          adsetId,
          error: msg,
        });
        warnings.push(`Row ${row.rowId.slice(-6)}: ${msg}`);
      }
    }

    const okCount = rowResults.filter((r) => r.adId).length;
    if (okCount === 0) {
      return NextResponse.json(
        {
          error: 'No se pudo crear ningún ad. Revisa los errores por fila.',
          rows: rowResults,
          warnings,
          created: { campaigns: createdCampaigns, adsets: createdAdSets },
        },
        { status: 502 },
      );
    }

    const response: LaunchResponse = {
      rows: rowResults,
      created: { campaigns: createdCampaigns, adsets: createdAdSets },
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
