import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/**
 * Returns the count of intel rows by transcript_status for the given ad
 * account. The bulk-transcribe UI polls this every few seconds while the
 * long-running POST is in flight so the user sees N → N-1 → ... → 0.
 */
export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const adAccountId = url.searchParams.get('adAccountId');
  if (!adAccountId) {
    return NextResponse.json({ error: 'adAccountId requerido' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('meta_ad_intel')
    .select('transcript_status, transcript')
    .eq('clerk_user_id', userId)
    .eq('ad_account_id', adAccountId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = data ?? [];
  let queued = 0;
  let running = 0;
  let done = 0;
  let failed = 0;
  let withTranscript = 0;
  for (const r of rows) {
    if (r.transcript) withTranscript += 1;
    switch (r.transcript_status) {
      case 'queued':
        queued += 1;
        break;
      case 'running':
        running += 1;
        break;
      case 'done':
        done += 1;
        break;
      case 'failed':
        failed += 1;
        break;
    }
  }

  return NextResponse.json({
    total: rows.length,
    queued,
    running,
    done,
    failed,
    withTranscript,
    pending: rows.length - withTranscript,
  });
}
