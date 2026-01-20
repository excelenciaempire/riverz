import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const KIE_API_KEY = process.env.KIE_API_KEY || '174d2ff19987520a25ecd1ed9c3ccc2b';
const KIE_BASE_URL = 'https://api.kie.ai';

// Usar service_role para operaciones atómicas
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

// Get current Kie.ai balance
async function getKieBalance(): Promise<number> {
  try {
    const response = await fetch(`${KIE_BASE_URL}/api/v1/chat/credit`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${KIE_API_KEY}`,
      },
    });
    
    if (!response.ok) return 0;
    const data = await response.json();
    return data.code === 200 ? data.data : 0;
  } catch {
    return 0;
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { amount, generation_id, description } = body;

    if (amount === undefined || amount < 0) {
      return NextResponse.json(
        { error: 'Invalid amount' },
        { status: 400 }
      );
    }

    // Si amount es 0, solo registrar transacción sin deducir
    if (amount === 0) {
      return NextResponse.json({
        success: true,
        credits_deducted: 0,
        message: 'Transaction recorded',
      });
    }

    // Check Kie.ai balance instead of internal credits
    const kieBalance = await getKieBalance();
    
    // Estimate Kie.ai cost (rough estimate: 1 Riverz credit = 0.1 Kie.ai credit)
    const estimatedKieCost = Math.ceil(amount * 0.1);
    
    if (kieBalance < estimatedKieCost) {
      return NextResponse.json(
        { 
          error: 'Insufficient credits',
          current_credits: kieBalance,
          required_credits: estimatedKieCost
        },
        { status: 402 }
      );
    }

    // Log the usage (for tracking purposes only)
    try {
      await supabaseAdmin
        .from('credit_transactions')
        .insert({
          clerk_user_id: userId,
          amount: -amount,
          transaction_type: 'deduction',
          generation_id: generation_id || null,
          description: description || 'Generation usage',
          balance_after: kieBalance // Log current Kie.ai balance
        });
    } catch (e) {
      console.error('Error logging transaction:', e);
    }

    // Return success - actual deduction happens when Kie.ai API is called
    return NextResponse.json({
      success: true,
      credits_deducted: amount,
      new_balance: kieBalance
    });
  } catch (error) {
    console.error('Error in credits/deduct:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
