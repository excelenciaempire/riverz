import { NextResponse } from 'next/server';
import {
  createAdCreative,
  createAd,
  MetaAuthError,
  MetaApiError,
  type CreativeFeatureToggles,
} from '@/lib/meta-client';
import { getMetaContext, markConnectionExpired } from '@/lib/meta-route-helpers';
import type {
  LaunchAdRow,
  LaunchRequest,
  LaunchResponse,
  LaunchRowResult,
} from '@/types/meta';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/meta/launch
 *
 * Crea ads en campañas/ad sets que YA existen en Meta. La UI no permite
 * crear nuevos desde el wizard — eso se hace en Ads Manager. Cada fila
 * apunta a un meta_uploads.id ya listo, una campaña existente y un ad set
 * existente. El endpoint sólo crea creative + ad por fila.
 */
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
  const rowResults: LaunchRowResult[] = [];

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

      if (!row.campaign?.id || !row.adset?.id) {
        rowResults.push({
          rowId: row.rowId,
          uploadId: row.uploadId,
          error: 'Falta asignar campaña o ad set',
        });
        continue;
      }
      const campaignId = row.campaign.id;
      const adsetId = row.adset.id;

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

      const adName = meta.name?.trim() || `Ad ${row.uploadId.slice(-6)}`;
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
          image_hash:
            upload.asset_type === 'image' ? upload.meta_asset_hash || undefined : undefined,
          video_id:
            upload.asset_type === 'video' ? upload.meta_asset_id || undefined : undefined,
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
        },
        { status: 502 },
      );
    }

    const response: LaunchResponse = { rows: rowResults, warnings };
    return NextResponse.json(response);
  } catch (err: any) {
    if (err instanceof MetaAuthError) {
      await markConnectionExpired(ctx.userId, err.message);
      return NextResponse.json({ requiresReconnect: true, error: err.message }, { status: 401 });
    }
    return NextResponse.json({ error: err?.message || 'Error en Meta API' }, { status: 502 });
  }
}
