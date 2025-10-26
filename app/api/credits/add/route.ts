import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

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

export async function POST(req: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { amount, transaction_type, description } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid amount' },
        { status: 400 }
      );
    }

    if (!transaction_type) {
      return NextResponse.json(
        { error: 'Transaction type is required' },
        { status: 400 }
      );
    }

    // Obtener balance actual
    const { data: userCredits, error: fetchError } = await supabaseAdmin
      .from('user_credits')
      .select('credits')
      .eq('clerk_user_id', userId)
      .single();

    if (fetchError) {
      console.error('Error fetching user credits:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch user credits' },
        { status: 500 }
      );
    }

    // Agregar créditos (operación atómica)
    const newBalance = userCredits.credits + amount;
    
    const { error: updateError } = await supabaseAdmin
      .from('user_credits')
      .update({ 
        credits: newBalance,
        updated_at: new Date().toISOString()
      })
      .eq('clerk_user_id', userId);

    if (updateError) {
      console.error('Error updating credits:', updateError);
      return NextResponse.json(
        { error: 'Failed to add credits' },
        { status: 500 }
      );
    }

    // Registrar transacción
    const { error: transactionError } = await supabaseAdmin
      .from('credit_transactions')
      .insert({
        clerk_user_id: userId,
        amount: amount, // Positivo para agregar
        transaction_type: transaction_type, // 'purchase', 'subscription', 'refund', 'admin_grant'
        description: description || 'Credits added',
        balance_after: newBalance
      });

    if (transactionError) {
      console.error('Error creating transaction:', transactionError);
      // No fallar si la transacción no se registra, pero loguearlo
    }

    return NextResponse.json({
      success: true,
      credits_added: amount,
      new_balance: newBalance
    });
  } catch (error) {
    console.error('Error in credits/add:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

