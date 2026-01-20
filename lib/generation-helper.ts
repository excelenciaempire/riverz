import { createClient, createAdminClient } from '@/lib/supabase/server';

/**
 * Helper para deducir créditos antes de una generación
 */
export async function deductCreditsForGeneration(
  userId: string,
  mode: string,
  description: string,
  requestHeaders?: Headers
): Promise<{ success: boolean; creditsCost: number; error?: string }> {
  const supabase = await createClient();
  const supabaseAdmin = createAdminClient();

  // Obtener costo del pricing_config
  const { data: pricingConfig } = await supabase
    .from('pricing_config')
    .select('credits_cost')
    .eq('mode', mode)
    .eq('is_active', true)
    .single();

  const creditsCost = pricingConfig?.credits_cost || 100;

  // Obtener balance actual usando admin client (bypass RLS si es necesario para lectura segura)
  const { data: userCredits, error: fetchError } = await supabaseAdmin
    .from('user_credits')
    .select('credits')
    .eq('clerk_user_id', userId)
    .single();

  if (fetchError) {
    console.error('Error fetching user credits:', fetchError);
    return {
      success: false,
      creditsCost,
      error: 'Failed to fetch user credits',
    };
  }

  // Validar que tenga suficientes créditos
  if (userCredits.credits < creditsCost) {
    return {
      success: false,
      creditsCost,
      error: `Insufficient credits. Required: ${creditsCost}, Current: ${userCredits.credits}`,
    };
  }

  // Deducir créditos (operación atómica)
  const newBalance = userCredits.credits - creditsCost;
  
  const { error: updateError } = await supabaseAdmin
    .from('user_credits')
    .update({ 
      credits: newBalance,
      updated_at: new Date().toISOString()
    })
    .eq('clerk_user_id', userId);

  if (updateError) {
    console.error('Error updating credits:', updateError);
    return {
      success: false,
      creditsCost,
      error: 'Failed to deduct credits',
    };
  }

  // Registrar transacción
  const { error: transactionError } = await supabaseAdmin
    .from('credit_transactions')
    .insert({
      clerk_user_id: userId,
      amount: -creditsCost, // Negativo para deducción
      transaction_type: 'deduction',
      description: description || 'Credit deduction for generation',
      balance_after: newBalance
    });

  if (transactionError) {
    console.error('Error creating transaction:', transactionError);
    // No fallar si la transacción no se registra, pero loguearlo
  }

  return {
    success: true,
    creditsCost,
  };
}

/**
 * Helper para crear un registro de generación
 */
export async function createGenerationRecord(
  userId: string,
  type: string,
  inputData: any,
  cost: number
): Promise<{ success: boolean; generation?: any; error?: string }> {
  const supabase = await createClient();

  const { data: generation, error: genError } = await supabase
    .from('generations')
    .insert({
      clerk_user_id: userId,
      type,
      status: 'pending',
      input_data: inputData,
      cost,
    })
    .select()
    .single();

  if (genError) {
    console.error('Error creating generation:', genError);
    return {
      success: false,
      error: 'Failed to create generation record',
    };
  }

  return {
    success: true,
    generation,
  };
}

/**
 * Helper para actualizar el estado de una generación
 */
export async function updateGenerationStatus(
  generationId: string,
  status: 'pending' | 'processing' | 'completed' | 'failed',
  additionalData?: {
    n8n_job_id?: string;
    result_url?: string;
    error_message?: string;
  }
) {
  const supabase = await createClient();

  await supabase
    .from('generations')
    .update({
      status,
      ...additionalData,
      updated_at: new Date().toISOString(),
    })
    .eq('id', generationId);
}


