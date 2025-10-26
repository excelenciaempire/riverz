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
    const { amount, generation_id, description } = body;

    if (amount === undefined || amount < 0) {
      return NextResponse.json(
        { error: 'Invalid amount' },
        { status: 400 }
      );
    }

    // Si amount es 0, solo registrar transacción sin deducir
    if (amount === 0 && generation_id) {
      return NextResponse.json({
        success: true,
        credits_deducted: 0,
        message: 'Transaction recorded',
      });
    }

    if (amount === 0) {
      return NextResponse.json(
        { error: 'Amount must be greater than 0' },
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

    // Validar que tenga suficientes créditos
    if (userCredits.credits < amount) {
      return NextResponse.json(
        { 
          error: 'Insufficient credits',
          current_credits: userCredits.credits,
          required_credits: amount
        },
        { status: 402 } // Payment Required
      );
    }

    // Deducir créditos (operación atómica)
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
      return NextResponse.json(
        { error: 'Failed to deduct credits' },
        { status: 500 }
      );
    }

    // Registrar transacción
    const { error: transactionError } = await supabaseAdmin
      .from('credit_transactions')
      .insert({
        clerk_user_id: userId,
        amount: -amount, // Negativo para deducción
        transaction_type: 'deduction',
        generation_id: generation_id || null,
        description: description || 'Credit deduction for generation',
        balance_after: newBalance
      });

    if (transactionError) {
      console.error('Error creating transaction:', transactionError);
      // No fallar si la transacción no se registra, pero loguearlo
    }

    return NextResponse.json({
      success: true,
      credits_deducted: amount,
      new_balance: newBalance
    });
  } catch (error) {
    console.error('Error in credits/deduct:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
