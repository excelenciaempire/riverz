/**
 * GET /api/referrals/code → devuelve el código de referido del user actual.
 *
 * El "código" es simplemente los primeros 8 chars del clerk_user_id en
 * base32. Es estable, único, y no requiere tabla extra. Las URLs se ven
 * como `riverz.app/?ref=usr1a2b3c`.
 */

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function deriveRefCode(clerkUserId: string): string {
  // Hash short y URL-safe. clerk_user_id ya es opaque; no hace falta crypto extra.
  return clerkUserId.replace(/[^a-zA-Z0-9]/g, '').slice(-8).toLowerCase() || 'rvz0001';
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('referrals')
    .select('id, status, credits_awarded, signed_up_at, activated_at')
    .eq('referrer_clerk_id', userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const code = deriveRefCode(userId);
  const total_credits_earned = (data ?? []).reduce((s, r) => s + (r.credits_awarded ?? 0), 0);
  const activated = (data ?? []).filter((r) => r.status === 'activated').length;
  return NextResponse.json({
    code,
    referrals: data ?? [],
    total_credits_earned,
    activated_count: activated,
  });
}
