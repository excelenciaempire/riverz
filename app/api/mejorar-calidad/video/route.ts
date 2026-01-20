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
    const video = formData.get('video') as File;
    const targetResolution = formData.get('targetResolution') as string;
    const enhanceDetails = formData.get('enhanceDetails') === 'true';
    const reduceNoise = formData.get('reduceNoise') === 'true';

    if (!video) {
      return NextResponse.json(
        { error: 'Video is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Obtener costo del pricing_config
    const { data: pricingConfig } = await supabase
      .from('pricing_config')
      .select('credits_cost')
      .eq('mode', 'mejorar_calidad_video')
      .eq('is_active', true)
      .single();

    const creditsCost = pricingConfig?.credits_cost || 200;

    // TODO: Upload video to Supabase Storage
    // const videoUrl = await uploadToStorage(video, 'user-uploads');

    // Crear registro de generación
    const { data: generation, error: genError } = await supabase
      .from('generations')
      .insert({
        clerk_user_id: userId,
        type: 'mejorar_calidad_video',
        status: 'pending',
        input_data: { 
          targetResolution: targetResolution || '1080p',
          enhanceDetails,
          reduceNoise
        },
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
        description: `Mejorar Calidad Video #${generation.id}`,
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
      endpoint: N8N_ENDPOINTS.mejorarCalidadVideo,
      data: {
        targetResolution: targetResolution || '1080p',
        enhanceDetails,
        reduceNoise,
        generationId: generation.id,
        userId,
        // videoUrl,
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
    console.error('Error enhancing video:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to enhance video' },
      { status: 500 }
    );
  }
}
