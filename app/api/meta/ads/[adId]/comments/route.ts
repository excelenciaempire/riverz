import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { resolveConnection } from '@/lib/meta-connection';
import { runCommentsForAd } from '@/lib/comments-runner';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const META_API_VERSION = process.env.META_GRAPH_API_VERSION || 'v23.0';

// Skip if synced within the last 7 days unless force=1.
const STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

export async function POST(req: Request, ctx: { params: Promise<{ adId: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { adId } = await ctx.params;
  const force = new URL(req.url).searchParams.get('force') === '1';

  const { data: intel } = await supabaseAdmin
    .from('meta_ad_intel')
    .select('*')
    .eq('clerk_user_id', userId)
    .eq('meta_ad_id', adId)
    .maybeSingle();
  if (!intel) {
    return NextResponse.json(
      { error: 'No encontramos info de este anuncio.' },
      { status: 404 },
    );
  }

  if (
    !force &&
    intel.comments_synced_at &&
    Date.now() - new Date(intel.comments_synced_at).getTime() < STALE_AFTER_MS
  ) {
    return NextResponse.json({ intel, skipped: true, reason: 'recent-sync' });
  }

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

  // Story id may be missing from intel — re-pull from Graph if needed.
  let storyId: string | null = null;
  try {
    const r = await fetch(
      `https://graph.facebook.com/${META_API_VERSION}/${adId}?fields=effective_object_story_id&access_token=${encodeURIComponent(resolved.token)}`,
    );
    if (r.ok) {
      const j = await r.json();
      storyId = (j?.effective_object_story_id as string | null) ?? null;
    }
  } catch {
    /* fall through to no-story */
  }

  const outcome = await runCommentsForAd(supabaseAdmin, userId, adId, storyId, resolved.token);

  if (outcome.kind === 'auth-error') {
    await supabaseAdmin
      .from('meta_connections')
      .update({ status: 'expired', last_error: outcome.message })
      .eq('clerk_user_id', userId);
    return NextResponse.json({ requiresReconnect: true, error: outcome.message }, { status: 401 });
  }
  if (outcome.kind === 'no-story') {
    return NextResponse.json(
      { error: 'Este anuncio no tiene un post asociado. No hay comentarios que leer.' },
      { status: 400 },
    );
  }
  if (outcome.kind === 'failed') {
    return NextResponse.json({ error: outcome.message }, { status: 502 });
  }

  const { data: updated } = await supabaseAdmin
    .from('meta_ad_intel')
    .select('*')
    .eq('clerk_user_id', userId)
    .eq('meta_ad_id', adId)
    .maybeSingle();
  return NextResponse.json({
    intel: updated,
    total: outcome.kind === 'ok' ? outcome.total : 0,
  });
}
