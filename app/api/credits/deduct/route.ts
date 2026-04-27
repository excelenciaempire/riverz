import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

/**
 * POST /api/credits/deduct
 * Body: { amount, generation_id?, description? }
 *
 * Atomic deduction with optimistic concurrency control:
 *   1. Read current credits.
 *   2. UPDATE ... SET credits = current - amount WHERE credits = current.
 *      If no row matched, somebody else mutated the row in between — retry.
 *
 * Without the WHERE-equals-current guard, two concurrent requests can both pass
 * a "do you have enough?" pre-check and overdraw the balance. The retry loop
 * caps at 3 attempts; legitimate contention almost always resolves on the first
 * retry.
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { amount, generation_id, description } = await req.json();

    if (typeof amount !== 'number' || amount < 0 || !Number.isFinite(amount)) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }
    if (amount === 0) {
      return NextResponse.json({ success: true, credits_deducted: 0, message: 'No credits deducted' });
    }

    let newBalance: number | null = null;
    let lastSeenBalance = 0;

    for (let attempt = 0; attempt < 3; attempt++) {
      const { data: row, error: readErr } = await supabaseAdmin
        .from('user_credits')
        .select('credits')
        .eq('clerk_user_id', userId)
        .single();
      if (readErr || !row) {
        return NextResponse.json({ error: 'Failed to fetch credits' }, { status: 500 });
      }
      lastSeenBalance = row.credits;
      if (row.credits < amount) {
        return NextResponse.json(
          { error: 'Insufficient credits', current_credits: row.credits, required_credits: amount },
          { status: 402 }
        );
      }

      const proposed = row.credits - amount;
      const { data: updated, error: updateErr } = await supabaseAdmin
        .from('user_credits')
        .update({ credits: proposed, updated_at: new Date().toISOString() })
        .eq('clerk_user_id', userId)
        .eq('credits', row.credits) // optimistic guard
        .select('credits')
        .maybeSingle();
      if (updateErr) {
        console.error('[credits/deduct] update error:', updateErr);
        return NextResponse.json({ error: 'Failed to deduct credits' }, { status: 500 });
      }
      if (updated) {
        newBalance = updated.credits;
        break;
      }
      // contention; retry
    }

    if (newBalance === null) {
      return NextResponse.json(
        { error: 'Concurrent update conflict, please retry', current_credits: lastSeenBalance },
        { status: 409 }
      );
    }

    // Best-effort transaction log. Failure here doesn't roll back the deduction;
    // we accept slightly stale audit logs over double-charging.
    try {
      await supabaseAdmin.from('credit_transactions').insert({
        clerk_user_id: userId,
        amount: -amount,
        transaction_type: 'deduction',
        generation_id: generation_id || null,
        description: description || 'Generation',
        balance_after: newBalance,
      });
    } catch (e) {
      console.error('[credits/deduct] transaction log error:', e);
    }

    return NextResponse.json({ success: true, credits_deducted: amount, new_balance: newBalance });
  } catch (error: any) {
    console.error('[credits/deduct] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
