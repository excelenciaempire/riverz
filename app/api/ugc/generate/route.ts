import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { triggerN8NWebhook, N8N_ENDPOINTS } from '@/lib/n8n';
import { 
  rateLimit, 
  getClientIp, 
  validateGenerationRequest, 
  logSecurityEvent,
  RATE_LIMITS 
} from '@/lib/security';

export async function POST(req: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limiting
    const clientIp = await getClientIp();
    const rateLimitKey = `ugc:${userId}:${clientIp}`;
    const rateLimitResult = await rateLimit(
      rateLimitKey,
      RATE_LIMITS.generation.limit,
      RATE_LIMITS.generation.windowMs
    );

    if (!rateLimitResult.success) {
      logSecurityEvent('RATE_LIMIT_EXCEEDED', userId, {
        endpoint: '/api/ugc/generate',
        ip: clientIp,
      });
      
      return NextResponse.json(
        { error: 'Demasiadas solicitudes. Intenta de nuevo en un minuto.' },
        { status: 429 }
      );
    }

    const { avatar, script, voiceId } = await req.json();

    // Validar entrada
    const validation = validateGenerationRequest({ prompt: script });
    if (!validation.valid) {
      logSecurityEvent('INVALID_INPUT', userId, {
        endpoint: '/api/ugc/generate',
        errors: validation.errors,
      });
      
      return NextResponse.json(
        { error: validation.errors.join(', ') },
        { status: 400 }
      );
    }
    const supabase = await createClient();

    // Obtener costo del pricing_config
    const { data: pricingConfig } = await supabase
      .from('pricing_config')
      .select('credits_cost')
      .eq('mode', 'ugc')
      .eq('is_active', true)
      .single();

    const creditsCost = pricingConfig?.credits_cost || 100;

    // Crear registro de generación primero
    const { data: generation, error: genError } = await supabase
      .from('generations')
      .insert({
        clerk_user_id: userId,
        type: 'ugc',
        status: 'pending',
        input_data: { avatar, script, voiceId },
        cost: creditsCost,
      })
      .select()
      .single();

    if (genError) {
      console.error('Error creating generation:', genError);
      throw new Error('Failed to create generation record');
    }

    // Validar y deducir créditos
    const deductResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/credits/deduct`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': req.headers.get('cookie') || '',
      },
      body: JSON.stringify({
        amount: creditsCost,
        generation_id: generation.id,
        description: `Generación UGC #${generation.id}`,
      }),
    });

    if (!deductResponse.ok) {
      const errorData = await deductResponse.json();
      
      // Marcar generación como failed
      await supabase
        .from('generations')
        .update({
          status: 'failed',
          error_message: 'Insufficient credits',
        })
        .eq('id', generation.id);
      
      if (deductResponse.status === 402) {
        return NextResponse.json(
          { 
            error: 'Insufficient credits',
            required: creditsCost,
            current: errorData.current_credits
          },
          { status: 402 }
        );
      }
      
      throw new Error('Failed to deduct credits');
    }

    // Trigger N8N webhook
    const webhookResponse = await triggerN8NWebhook({
      endpoint: N8N_ENDPOINTS.ugc,
      data: {
        avatar,
        script,
        voiceId,
        generationId: generation.id,
        userId,
      },
      userId,
    });

    if (!webhookResponse.success) {
      // Revertir generación a failed
      await supabase
        .from('generations')
        .update({
          status: 'failed',
          error_message: webhookResponse.error || 'N8N webhook failed',
        })
        .eq('id', generation.id);

      throw new Error(webhookResponse.error || 'N8N webhook failed');
    }

    // Actualizar estado de generación
    await supabase
      .from('generations')
      .update({
        status: 'processing',
        n8n_job_id: webhookResponse.job_id,
      })
      .eq('id', generation.id);

    // Retornar inmediatamente con el job_id para polling
    return NextResponse.json({
      success: true,
      generationId: generation.id,
      jobId: webhookResponse.job_id,
      status: 'processing',
    });
  } catch (error: any) {
    console.error('Error generating UGC:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate UGC video' },
      { status: 500 }
    );
  }
}

