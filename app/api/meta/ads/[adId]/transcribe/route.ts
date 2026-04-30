import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { resolveConnection } from '@/lib/meta-connection';
import { runTranscribeForIntel } from '@/lib/transcribe-runner';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/**
 * Transcribes / analyses ONE ad creative on demand. Routes the heavy
 * lifting through `runTranscribeForIntel` so the bulk endpoint shares
 * the exact same URL-resolution + status-transition behaviour.
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

  const outcome = await runTranscribeForIntel(supabaseAdmin, userId, intel, resolved.token);

  if (outcome.kind === 'auth-error') {
    await supabaseAdmin
      .from('meta_connections')
      .update({ status: 'expired', last_error: outcome.message })
      .eq('clerk_user_id', userId);
    return NextResponse.json({ requiresReconnect: true, error: outcome.message }, { status: 401 });
  }

  if (outcome.kind !== 'ok') {
    return NextResponse.json({ error: outcome.message }, { status: 400 });
  }

  const { data: updated } = await supabaseAdmin
    .from('meta_ad_intel')
    .select('*')
    .eq('clerk_user_id', userId)
    .eq('meta_ad_id', adId)
    .maybeSingle();
  return NextResponse.json({ intel: updated });
}
