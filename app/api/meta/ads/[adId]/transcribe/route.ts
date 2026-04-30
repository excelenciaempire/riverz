import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { getVideoSourceUrl, MetaAuthError } from '@/lib/meta-client';
import { resolveConnection } from '@/lib/meta-connection';
import { transcribeAsset, TranscribeError } from '@/lib/transcribe-asset';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

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
    return NextResponse.json({ error: 'No encontramos info de este anuncio. Refresca la lista.' }, { status: 404 });
  }

  // Resolve a playable URL.
  let assetUrl = intel.asset_url || intel.thumbnail_url || null;

  if (intel.asset_type === 'video') {
    // Fetch fresh source from Meta — thumbnails won't have audio.
    const { data: connection } = await supabaseAdmin
      .from('meta_connections')
      .select('*')
      .eq('clerk_user_id', userId)
      .maybeSingle();
    const resolved = resolveConnection(connection);
    if (!resolved.ok) {
      return NextResponse.json({ requiresReconnect: !!resolved.requiresReconnect, error: resolved.error }, { status: resolved.status });
    }
    // Find video_id from creative — we need it. Re-fetch ad creative if missing.
    let videoId: string | null = null;
    try {
      const adRes = await fetch(
        `https://graph.facebook.com/${process.env.META_GRAPH_API_VERSION || 'v23.0'}/${adId}?fields=creative{video_id,object_story_spec,asset_feed_spec}&access_token=${encodeURIComponent(resolved.token)}`,
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
        const src = await getVideoSourceUrl(resolved.token, videoId);
        if (src) assetUrl = src;
      } catch (err: any) {
        if (err instanceof MetaAuthError) {
          return NextResponse.json({ requiresReconnect: true, error: err.message }, { status: 401 });
        }
      }
    }
  }

  if (!assetUrl) {
    return NextResponse.json({ error: 'No hay URL de asset para transcribir' }, { status: 400 });
  }

  await supabaseAdmin
    .from('meta_ad_intel')
    .update({ transcript_status: 'running', transcript_error: null })
    .eq('clerk_user_id', userId)
    .eq('meta_ad_id', adId);

  try {
    const transcript = await transcribeAsset(assetUrl, intel.ad_name || `ad-${adId}`);
    const { data: updated } = await supabaseAdmin
      .from('meta_ad_intel')
      .update({
        transcript,
        transcript_status: 'done',
        transcript_error: null,
        asset_url: assetUrl,
      })
      .eq('clerk_user_id', userId)
      .eq('meta_ad_id', adId)
      .select('*')
      .maybeSingle();
    return NextResponse.json({ intel: updated });
  } catch (err: any) {
    const message = err instanceof TranscribeError ? err.message : err?.message || 'Transcripción falló';
    await supabaseAdmin
      .from('meta_ad_intel')
      .update({ transcript_status: 'failed', transcript_error: message })
      .eq('clerk_user_id', userId)
      .eq('meta_ad_id', adId);
    const status = err instanceof TranscribeError && err.code === 'config' ? 500 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
