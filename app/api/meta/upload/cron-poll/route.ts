import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { decrypt } from '@/lib/crypto';
import { pollSingleUpload, MIN_POLL_INTERVAL_MS } from '@/lib/meta-poll';
import type { MetaUpload } from '@/types/meta';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const BATCH_LIMIT = 100;

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

  const cutoff = new Date(Date.now() - MIN_POLL_INTERVAL_MS).toISOString();

  const { data: rows, error } = await supabaseAdmin
    .from('meta_uploads')
    .select('*')
    .eq('status', 'processing')
    .not('meta_asset_id', 'is', null)
    .or(`last_polled_at.is.null,last_polled_at.lt.${cutoff}`)
    .order('last_polled_at', { ascending: true, nullsFirst: true })
    .limit(BATCH_LIMIT);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const uploads = (rows || []) as MetaUpload[];
  if (uploads.length === 0) {
    return NextResponse.json({ polled: 0, ready: 0, failed: 0, authErrors: 0 });
  }

  const byUser = new Map<string, MetaUpload[]>();
  for (const row of uploads) {
    const list = byUser.get(row.clerk_user_id) ?? [];
    list.push(row);
    byUser.set(row.clerk_user_id, list);
  }

  let polled = 0;
  let ready = 0;
  let failed = 0;
  let authErrors = 0;

  for (const [clerkUserId, userRows] of byUser) {
    const { data: connection } = await supabaseAdmin
      .from('meta_connections')
      .select('*')
      .eq('clerk_user_id', clerkUserId)
      .maybeSingle();

    if (!connection || connection.status !== 'active') {
      continue;
    }

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
    for (const row of userRows) {
      if (userAuthFailed) break;
      const outcome = await pollSingleUpload(supabaseAdmin, row, token);
      if (outcome.kind === 'auth-error') {
        await supabaseAdmin
          .from('meta_connections')
          .update({ status: 'expired', last_error: outcome.message })
          .eq('clerk_user_id', clerkUserId);
        userAuthFailed = true;
        authErrors += 1;
        break;
      }
      if (outcome.kind === 'updated') {
        polled += 1;
        if (outcome.row.status === 'ready') ready += 1;
        if (outcome.row.status === 'failed') failed += 1;
      }
    }
  }

  return NextResponse.json({ polled, ready, failed, authErrors });
}
