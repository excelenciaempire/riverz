import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { triggerN8NWebhook, pollN8NResult, N8N_ENDPOINTS } from '@/lib/n8n';

export async function POST(req: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const sourceVideo = formData.get('sourceVideo') as File;
    const characterImage = formData.get('characterImage') as File;
    const resolution = formData.get('resolution') as string;
    const format = formData.get('format') as string;

    const supabase = await createClient();

    // Get user data
    const { data: user } = await supabase
      .from('users')
      .select('id, credits')
      .eq('clerk_id', userId)
      .single();

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check credits
    const estimatedCost = 30;
    if (user.credits < estimatedCost) {
      return NextResponse.json(
        { error: 'Insufficient credits' },
        { status: 402 }
      );
    }

    // Create generation record
    const { data: generation } = await supabase
      .from('generations')
      .insert({
        user_id: user.id,
        type: 'face_swap',
        status: 'pending',
        input_data: { resolution, format },
        cost: estimatedCost,
      })
      .select()
      .single();

    // In production: Upload files to storage, then send URLs to N8N
    // For now, trigger N8N with file data
    const webhookResponse = await triggerN8NWebhook({
      endpoint: N8N_ENDPOINTS.faceSwap,
      data: {
        resolution,
        format,
        generationId: generation?.id,
        // File URLs would go here
      },
      userId,
    });

    if (!webhookResponse.success) {
      throw new Error(webhookResponse.error || 'Face swap failed');
    }

    await supabase
      .from('generations')
      .update({
        status: 'processing',
        n8n_job_id: webhookResponse.job_id,
      })
      .eq('id', generation?.id);

    const result = await pollN8NResult(
      webhookResponse.job_id!,
      N8N_ENDPOINTS.faceSwap
    );

    await supabase
      .from('generations')
      .update({
        status: 'completed',
        result_url: result.result_url,
      })
      .eq('id', generation?.id);

    await supabase
      .from('users')
      .update({ credits: user.credits - estimatedCost })
      .eq('id', user.id);

    return NextResponse.json({
      success: true,
      videoUrl: result.result_url,
    });
  } catch (error) {
    console.error('Error generating face swap:', error);
    return NextResponse.json(
      { error: 'Failed to generate face swap' },
      { status: 500 }
    );
  }
}

