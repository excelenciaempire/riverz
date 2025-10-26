import { createClient } from '@/lib/supabase/server';

/**
 * Helper para deducir créditos antes de una generación
 */
export async function deductCreditsForGeneration(
  userId: string,
  mode: string,
  description: string,
  requestHeaders: Headers
): Promise<{ success: boolean; creditsCost: number; error?: string }> {
  const supabase = await createClient();

  // Obtener costo del pricing_config
  const { data: pricingConfig } = await supabase
    .from('pricing_config')
    .select('credits_cost')
    .eq('mode', mode)
    .eq('is_active', true)
    .single();

  const creditsCost = pricingConfig?.credits_cost || 100;

  // Validar y deducir créditos
  const deductResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/credits/deduct`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': requestHeaders.get('cookie') || '',
    },
    body: JSON.stringify({
      amount: creditsCost,
      description,
    }),
  });

  if (!deductResponse.ok) {
    const errorData = await deductResponse.json();
    
    if (deductResponse.status === 402) {
      return {
        success: false,
        creditsCost,
        error: `Insufficient credits. Required: ${creditsCost}, Current: ${errorData.current_credits}`,
      };
    }
    
    return {
      success: false,
      creditsCost,
      error: 'Failed to deduct credits',
    };
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

