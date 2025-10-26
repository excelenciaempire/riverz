import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { triggerN8NWebhook, N8N_ENDPOINTS } from '@/lib/n8n';

export async function POST(req: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const image = formData.get('image') as File | null;
    const prompt = formData.get('prompt') as string;
    const model = formData.get('model') as string;
    const format = formData.get('format') as string;
    const duration = formData.get('duration') as string;

    const supabase = await createClient();

    // Obtener costo del pricing_config
    const { data: pricingConfig } = await supabase
      .from('pricing_config')
      .select('credits_cost')
      .eq('mode', 'clips')
      .eq('is_active', true)
      .single();

    const creditsCost = pricingConfig?.credits_cost || 120;

    // TODO: Upload image to Supabase Storage if provided
    // const imageUrl = image ? await uploadToStorage(image, 'user-uploads') : null;

    // Crear registro de generación
    const { data: generation, error: genError } = await supabase
      .from('generations')
      .insert({
        clerk_user_id: userId,
        type: 'clips',
        status: 'pending',
        input_data: { prompt, model, format, duration, hasImage: !!image },
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
        description: `Clip Generation #${generation.id}`,
      }),
    });

    if (!deductResponse.ok) {
      const errorData = await deductResponse.json();
      
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
      endpoint: N8N_ENDPOINTS.clips,
      data: {
        prompt,
        model,
        format,
        duration,
        generationId: generation.id,
        userId,
        // imageUrl,
      },
      userId,
    });

    if (!webhookResponse.success) {
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

    return NextResponse.json({
      success: true,
      generationId: generation.id,
      jobId: webhookResponse.job_id,
      status: 'processing',
    });
  } catch (error: any) {
    console.error('Error generating clip:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate clip' },
      { status: 500 }
    );
  }
}

