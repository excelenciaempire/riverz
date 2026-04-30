/**
 * Reusable orchestration around `transcribeAsset` for a single ad row.
 *
 * Handles:
 *   - Resolving the playable URL (cache → /{video_id}?fields=source →
 *     /{ad_id}/previews iframe scrape).
 *   - Status transitions on `meta_ad_intel.transcript_status`.
 *   - Caching of resolved video source URLs back into `asset_url`.
 *
 * Both the per-ad route (`/api/meta/ads/[adId]/transcribe`) and the bulk
 * route (`/api/meta/transcribe/bulk`) call this so behaviour stays
 * identical regardless of how the work was triggered.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getVideoMeta, getAdPreviewVideoUrl, MetaAuthError } from '@/lib/meta-client';
import { transcribeAsset, TranscribeError } from '@/lib/transcribe-asset';

const META_API_VERSION = process.env.META_GRAPH_API_VERSION || 'v23.0';

export type TranscribeOutcome =
  | { kind: 'ok'; transcript: string }
  | { kind: 'auth-error'; message: string }
  | { kind: 'no-asset'; message: string }
  | { kind: 'failed'; message: string };

export interface IntelRow {
  meta_ad_id: string;
  asset_type: string | null;
  asset_url: string | null;
  thumbnail_url: string | null;
  ad_name: string | null;
}

/**
 * Resolves a playable asset URL for the given ad row, falling through
 * the same three-step chain as the per-ad transcribe route.
 * Caches discovered URLs back into meta_ad_intel.asset_url.
 */
async function resolveAssetUrl(
  supabase: SupabaseClient,
  userId: string,
  intel: IntelRow,
  token: string,
): Promise<string | null> {
  const isVideo = intel.asset_type === 'video';
  let url: string | null = isVideo
    ? intel.asset_url
    : intel.asset_url || intel.thumbnail_url;
  if (!isVideo || url) return url;

  // 1) Try /{video_id}?fields=source via Graph (cheap)
  let videoId: string | null = null;
  try {
    const res = await fetch(
      `https://graph.facebook.com/${META_API_VERSION}/${intel.meta_ad_id}?fields=creative{video_id,object_story_spec,asset_feed_spec}&access_token=${encodeURIComponent(token)}`,
    );
    if (res.ok) {
      const j = await res.json();
      const c = j?.creative ?? {};
      videoId =
        c.video_id ||
        c.object_story_spec?.video_data?.video_id ||
        c.asset_feed_spec?.videos?.[0]?.video_id ||
        null;
    }
  } catch {
    /* ignore — the ad row may have been deleted Meta-side */
  }
  if (videoId) {
    const meta = await getVideoMeta(token, videoId);
    if (meta.source) {
      url = meta.source;
      await supabase
        .from('meta_ad_intel')
        .update({ asset_url: url, thumbnail_url: meta.thumbnail || intel.thumbnail_url })
        .eq('clerk_user_id', userId)
        .eq('meta_ad_id', intel.meta_ad_id);
      return url;
    }
  }

  // 2) Fallback to ad-preview iframe scraping
  const previewUrl = await getAdPreviewVideoUrl(token, intel.meta_ad_id);
  if (previewUrl) {
    await supabase
      .from('meta_ad_intel')
      .update({ asset_url: previewUrl })
      .eq('clerk_user_id', userId)
      .eq('meta_ad_id', intel.meta_ad_id);
    return previewUrl;
  }

  return null;
}

/**
 * Transcribe one ad end-to-end. Returns a structured outcome instead of
 * throwing — callers can iterate through a list and tally failures.
 */
export async function runTranscribeForIntel(
  supabase: SupabaseClient,
  userId: string,
  intel: IntelRow,
  token: string,
): Promise<TranscribeOutcome> {
  const isVideo = intel.asset_type === 'video';

  // Mark running so progress polling reflects what's actually in flight.
  await supabase
    .from('meta_ad_intel')
    .update({ transcript_status: 'running', transcript_error: null })
    .eq('clerk_user_id', userId)
    .eq('meta_ad_id', intel.meta_ad_id);

  let assetUrl: string | null;
  try {
    assetUrl = await resolveAssetUrl(supabase, userId, intel, token);
  } catch (err: any) {
    if (err instanceof MetaAuthError) {
      return { kind: 'auth-error', message: err.message };
    }
    assetUrl = null;
  }

  if (!assetUrl) {
    const message = isVideo
      ? 'No pudimos resolver el .mp4 del video.'
      : 'No hay URL de imagen para analizar.';
    await supabase
      .from('meta_ad_intel')
      .update({ transcript_status: 'failed', transcript_error: message })
      .eq('clerk_user_id', userId)
      .eq('meta_ad_id', intel.meta_ad_id);
    return { kind: 'no-asset', message };
  }

  try {
    const transcript = await transcribeAsset(
      assetUrl,
      intel.ad_name || `ad-${intel.meta_ad_id}`,
      { isVideo },
    );
    await supabase
      .from('meta_ad_intel')
      .update({ transcript, transcript_status: 'done', transcript_error: null })
      .eq('clerk_user_id', userId)
      .eq('meta_ad_id', intel.meta_ad_id);
    return { kind: 'ok', transcript };
  } catch (err: any) {
    const message =
      err instanceof TranscribeError ? err.message : err?.message || 'Transcripción falló';
    await supabase
      .from('meta_ad_intel')
      .update({ transcript_status: 'failed', transcript_error: message })
      .eq('clerk_user_id', userId)
      .eq('meta_ad_id', intel.meta_ad_id);
    return { kind: 'failed', message };
  }
}
