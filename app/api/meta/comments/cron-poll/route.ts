import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { decrypt } from '@/lib/crypto';
import { runCommentsForAd } from '@/lib/comments-runner';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// Per tick: pick up to BATCH_LIMIT ads that need a fresh comments sync
// (active ads where comments_synced_at is null or older than STALE_AFTER).
const BATCH_LIMIT = 50;
const STALE_AFTER = '7 days';
const META_API_VERSION = process.env.META_GRAPH_API_VERSION || 'v23.0';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const staleCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Pick active ads where comments are stale or never synced.
  const { data: rows, error } = await supabaseAdmin
    .from('meta_ad_intel')
    .select('clerk_user_id, meta_ad_id, comments_synced_at, effective_status')
    .eq('effective_status', 'ACTIVE')
    .or(`comments_synced_at.is.null,comments_synced_at.lt.${staleCutoff}`)
    .order('comments_synced_at', { ascending: true, nullsFirst: true })
    .limit(BATCH_LIMIT);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!rows || rows.length === 0) {
    return NextResponse.json({ processed: 0, message: 'nothing to sync' });
  }

  // Group by user — token resolution + auth-failure short-circuit per user.
  const byUser = new Map<string, typeof rows>();
  for (const r of rows) {
    const list = byUser.get(r.clerk_user_id) ?? [];
    list.push(r);
    byUser.set(r.clerk_user_id, list);
  }

  let ok = 0;
  let failed = 0;

  for (const [userId, ads] of byUser) {
    const { data: connection } = await supabaseAdmin
      .from('meta_connections')
      .select('*')
      .eq('clerk_user_id', userId)
      .maybeSingle();
    if (!connection || connection.status !== 'active') continue;

    let token: string;
    try {
      token = decrypt({
        ciphertext: connection.access_token_ciphertext,
        iv: connection.access_token_iv,
        tag: connection.access_token_tag,
      });
    } catch {
      continue;
    }

    let userAuthFailed = false;
    for (const ad of ads) {
      if (userAuthFailed) break;

      // Story id isn't on intel — re-pull from Graph (cheap; one field).
      let storyId: string | null = null;
      try {
        const r = await fetch(
          `https://graph.facebook.com/${META_API_VERSION}/${ad.meta_ad_id}?fields=effective_object_story_id&access_token=${encodeURIComponent(token)}`,
        );
        if (r.ok) {
          const j = await r.json();
          storyId = (j?.effective_object_story_id as string | null) ?? null;
        }
      } catch {
        /* skip this ad */
        continue;
      }

      const outcome = await runCommentsForAd(supabaseAdmin, userId, ad.meta_ad_id, storyId, token);
      if (outcome.kind === 'auth-error') {
        userAuthFailed = true;
        await supabaseAdmin
          .from('meta_connections')
          .update({ status: 'expired', last_error: outcome.message })
          .eq('clerk_user_id', userId);
        failed += 1;
        continue;
      }
      if (outcome.kind === 'ok' || outcome.kind === 'no-comments') ok += 1;
      else failed += 1;
    }
  }

  return NextResponse.json({ processed: ok + failed, ok, failed });
}
