import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { getVideoMeta, MetaAuthError } from '@/lib/meta-client';
import { resolveConnection } from '@/lib/meta-connection';
import { transcribeAsset, TranscribeError } from '@/lib/transcribe-asset';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const META_API_VERSION = process.env.META_GRAPH_API_VERSION || 'v23.0';

/**
 * Transcribes / analyses an ad creative.
 *
 *   IMAGE → kie.ai Gemini 3 Pro on the image URL (current behavior).
 *   VIDEO → Google AI Files API + Gemini for real audio transcription.
 *           Picks up the video's `source` URL on demand if the cached
 *           `asset_url` is missing or stale.
 */
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ adId: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { adId } = await ctx.params;

  const { data: intel } = await supabaseAdmin
    .from('meta_ad_intel')
    .select('*')
    .eq('clerk_user_id', userId)
    .eq('meta_ad_id', adId)
    .maybeSingle();

  if (!intel) {
    return NextResponse.json(
      { error: 'No encontramos info de este anuncio. Refresca la lista.' },
      { status: 404 },
    );
  }

  const isVideo = intel.asset_type === 'video';
  let assetUrl: string | null = isVideo
    ? intel.asset_url // cached video source
    : intel.asset_url || intel.thumbnail_url;

  // For videos: if the cached source is missing, try to refetch from Graph
  // right now. Avoids forcing the user to reload the list page just to refresh
  // a single video's source URL.
  if (isVideo && !assetUrl) {
    const { data: connection } = await supabaseAdmin
      .from('meta_connections')
      .select('*')
      .eq('clerk_user_id', userId)
      .maybeSingle();
    const resolved = resolveConnection(connection);
    if (!resolved.ok) {
      return NextResponse.json(
        { requiresReconnect: !!resolved.requiresReconnect, error: resolved.error },
        { status: resolved.status },
      );
    }
    let videoId: string | null = null;
    try {
      const adRes = await fetch(
        `https://graph.facebook.com/${META_API_VERSION}/${adId}?fields=creative{video_id,object_story_spec,asset_feed_spec}&access_token=${encodeURIComponent(resolved.token)}`,
      );
      if (adRes.ok) {
        const j = await adRes.json();
        const creative = j?.creative ?? {};
        videoId =
          creative.video_id ||
          creative.object_story_spec?.video_data?.video_id ||
          creative.asset_feed_spec?.videos?.[0]?.video_id ||
          null;
      }
    } catch {
      /* ignore */
    }
    if (videoId) {
      try {
        const meta = await getVideoMeta(resolved.token, videoId);
        if (meta.source) {
          assetUrl = meta.source;
          // Cache it back so future runs hit it directly.
          await supabaseAdmin
            .from('meta_ad_intel')
            .update({ asset_url: meta.source, thumbnail_url: meta.thumbnail || intel.thumbnail_url })
            .eq('clerk_user_id', userId)
            .eq('meta_ad_id', adId);
        }
      } catch (err: any) {
        if (err instanceof MetaAuthError) {
          return NextResponse.json({ requiresReconnect: true, error: err.message }, { status: 401 });
        }
      }
    }
  }

  if (!assetUrl) {
    return NextResponse.json(
      {
        error: isVideo
          ? 'Meta no devuelve el source del video (posiblemente por permisos o antigüedad). Intenta abrirlo en Facebook.'
          : 'No hay URL de imagen para analizar.',
      },
      { status: 400 },
    );
  }

  await supabaseAdmin
    .from('meta_ad_intel')
    .update({ transcript_status: 'running', transcript_error: null })
    .eq('clerk_user_id', userId)
    .eq('meta_ad_id', adId);

  try {
    const transcript = await transcribeAsset(assetUrl, intel.ad_name || `ad-${adId}`, { isVideo });
    const { data: updated } = await supabaseAdmin
      .from('meta_ad_intel')
      .update({
        transcript,
        transcript_status: 'done',
        transcript_error: null,
      })
      .eq('clerk_user_id', userId)
      .eq('meta_ad_id', adId)
      .select('*')
      .maybeSingle();
    return NextResponse.json({ intel: updated });
  } catch (err: any) {
    const message =
      err instanceof TranscribeError ? err.message : err?.message || 'Transcripción falló';
    await supabaseAdmin
      .from('meta_ad_intel')
      .update({ transcript_status: 'failed', transcript_error: message })
      .eq('clerk_user_id', userId)
      .eq('meta_ad_id', adId);
    const status = err instanceof TranscribeError && err.code === 'config' ? 500 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
