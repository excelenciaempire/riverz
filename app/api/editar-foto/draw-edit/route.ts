import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { createKieTask, getKieModelConfig } from '@/lib/kie-client';

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { baseImage, maskImage, prompt, maskStrokes, preserveElements } = body;

    if (!baseImage) {
      return NextResponse.json(
        { error: 'Base image is required' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Get pricing config
    const { data: pricingConfig } = await supabase
      .from('pricing_config')
      .select('credits_cost')
      .eq('mode', 'editar_foto_draw_edit')
      .eq('is_active', true)
      .single();

    const creditsCost = pricingConfig?.credits_cost || 100;

    // Create generation record
    const { data: generation, error: genError } = await supabase
      .from('generations')
      .insert({
        clerk_user_id: userId,
        type: 'editar_foto_draw_edit',
        status: 'pending',
        input_data: { 
          prompt: prompt || 'Edit image based on marked areas',
          hasMask: !!maskImage,
          hasStrokes: !!maskStrokes?.length,
          elementCount: {
            texts: preserveElements?.texts?.length || 0,
            shapes: preserveElements?.shapes?.length || 0,
            images: preserveElements?.images?.length || 0,
          }
        },
        cost: creditsCost,
      })
      .select()
      .single();

    if (genError) {
      console.error('Error creating generation:', genError);
      throw new Error('Failed to create generation record');
    }

    // Validate and deduct credits
    const deductResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/credits/deduct`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': req.headers.get('cookie') || '',
      },
      body: JSON.stringify({
        amount: creditsCost,
        generation_id: generation.id,
        description: `Draw to Edit #${generation.id}`,
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

    // Get model configuration
    const { generationModel } = await getKieModelConfig();

    // Prepare input for Nano Banana Pro
    const taskInput: any = {
      prompt: prompt || 'Edit this image based on the marked areas',
      image: [baseImage],
      aspect_ratio: 'auto',
      resolution: '1K',
      output_format: 'png',
    };

    // Add mask if provided
    if (maskImage) {
      taskInput.mask_image = maskImage;
    }

    // Add stroke coordinates if provided
    if (maskStrokes && maskStrokes.length > 0) {
      taskInput.mask_strokes = maskStrokes;
    }

    // Create KIE task
    const taskId = await createKieTask(generationModel, taskInput);

    // Update generation record with task ID
    await supabase
      .from('generations')
      .update({
        status: 'processing',
        n8n_job_id: taskId,
      })
      .eq('id', generation.id);

    return NextResponse.json({
      success: true,
      generationId: generation.id,
      jobId: taskId,
      status: 'processing',
    });

  } catch (error: any) {
    console.error('Error in draw-edit:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process draw-edit request' },
      { status: 500 }
    );
  }
}
