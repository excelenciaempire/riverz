import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export async function POST(req: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { amount, generation_id, description } = body;

    if (amount === undefined || amount < 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    if (amount === 0) {
      return NextResponse.json({
        success: true,
        credits_deducted: 0,
        message: 'No credits deducted',
      });
    }

    // Get current user credits
    const { data: userCredits, error: fetchError } = await supabaseAdmin
      .from('user_credits')
      .select('credits')
      .eq('clerk_user_id', userId)
      .single();

    if (fetchError) {
      console.error('Error fetching user credits:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch credits' }, { status: 500 });
    }

    // Check sufficient credits
    if (userCredits.credits < amount) {
      return NextResponse.json({
        error: 'Insufficient credits',
        current_credits: userCredits.credits,
        required_credits: amount
      }, { status: 402 });
    }

    // Deduct credits
    const newBalance = userCredits.credits - amount;
    
    const { error: updateError } = await supabaseAdmin
      .from('user_credits')
      .update({ 
        credits: newBalance,
        updated_at: new Date().toISOString()
      })
      .eq('clerk_user_id', userId);

    if (updateError) {
      console.error('Error updating credits:', updateError);
      return NextResponse.json({ error: 'Failed to deduct credits' }, { status: 500 });
    }

    // Log transaction
    try {
      await supabaseAdmin
        .from('credit_transactions')
        .insert({
          clerk_user_id: userId,
          amount: -amount,
          transaction_type: 'deduction',
          generation_id: generation_id || null,
          description: description || 'Generation',
          balance_after: newBalance
        });
    } catch (e) {
      console.error('Error logging transaction:', e);
    }

    return NextResponse.json({
      success: true,
      credits_deducted: amount,
      new_balance: newBalance
    });
  } catch (error) {
    console.error('Error in credits/deduct:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
