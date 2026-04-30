import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { resolveConnection } from '@/lib/meta-connection';
import { runTranscribeForIntel } from '@/lib/transcribe-runner';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Vercel cap. With chunks of 6 and ~30 s per video this lets us churn
// through ~60 ads in one invocation. Larger queues require multiple
// triggers from the client.
export const maxDuration = 300;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const CHUNK_SIZE = 6;
const MAX_PER_CALL = 60;

interface BulkRequest {
  adAccountId: string;
  /** Optional explicit list of ad ids. When omitted, every intel row in
   *  the account that doesn't yet have a transcript is queued. */
  adIds?: string[];
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: BulkRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }
  if (!body.adAccountId) {
    return NextResponse.json({ error: 'adAccountId requerido' }, { status: 400 });
  }

  // Resolve token once — every ad in the same account uses it.
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
  const token = resolved.token;

  // Pick the queue: any intel row without a transcript yet, optionally
  // narrowed to the ids the client passed (useful for re-running just
  // the failures).
  let query = supabaseAdmin
    .from('meta_ad_intel')
    .select('meta_ad_id, asset_type, asset_url, thumbnail_url, ad_name, transcript')
    .eq('clerk_user_id', userId)
    .eq('ad_account_id', body.adAccountId)
    .or('transcript.is.null,transcript_status.eq.failed')
    .limit(MAX_PER_CALL);
  if (body.adIds && body.adIds.length > 0) {
    query = query.in('meta_ad_id', body.adIds);
  }
  const { data: rows, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const queue = (rows ?? []).filter((r) => !r.transcript);
  if (queue.length === 0) {
    return NextResponse.json({ queued: 0, processed: 0, ok: 0, failed: 0 });
  }

  // Mark every selected ad as queued up-front so the progress endpoint
  // sees the new pipeline immediately.
  await supabaseAdmin
    .from('meta_ad_intel')
    .update({ transcript_status: 'queued', transcript_error: null })
    .eq('clerk_user_id', userId)
    .eq('ad_account_id', body.adAccountId)
    .in(
      'meta_ad_id',
      queue.map((r) => r.meta_ad_id),
    );

  let ok = 0;
  let failed = 0;
  let authFailed = false;

  // Sequential chunks of CHUNK_SIZE running in parallel. If we hit an
  // auth error, mark the connection expired and stop — every subsequent
  // ad would fail the same way.
  for (let i = 0; i < queue.length; i += CHUNK_SIZE) {
    if (authFailed) break;
    const slice = queue.slice(i, i + CHUNK_SIZE);
    const results = await Promise.allSettled(
      slice.map((row) => runTranscribeForIntel(supabaseAdmin, userId, row, token)),
    );
    for (const r of results) {
      if (r.status !== 'fulfilled') {
        failed += 1;
        continue;
      }
      if (r.value.kind === 'ok') ok += 1;
      else if (r.value.kind === 'auth-error') {
        authFailed = true;
        failed += 1;
      } else failed += 1;
    }
  }

  if (authFailed) {
    await supabaseAdmin
      .from('meta_connections')
      .update({ status: 'expired', last_error: 'Token rejected during bulk transcribe' })
      .eq('clerk_user_id', userId);
  }

  return NextResponse.json({
    queued: queue.length,
    processed: ok + failed,
    ok,
    failed,
    requiresReconnect: authFailed || undefined,
  });
}
