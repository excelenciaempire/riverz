import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { transcribeAsset, TranscribeError } from '@/lib/transcribe-asset';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

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
    return NextResponse.json(
      { error: 'No encontramos info de este anuncio. Refresca la lista.' },
      { status: 404 },
    );
  }

  // Decide which URL to send to kie.ai/Gemini.
  // For images: prefer the full-res asset_url, fall back to thumbnail.
  // For videos: use the thumbnail (kie.ai's Gemini does not accept video bytes).
  const isVideo = intel.asset_type === 'video';
  const assetUrl = isVideo
    ? (intel.thumbnail_url || intel.asset_url)
    : (intel.asset_url || intel.thumbnail_url);

  if (!assetUrl) {
    return NextResponse.json(
      { error: 'No hay URL de imagen para analizar (ni thumbnail).' },
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
