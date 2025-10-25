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

    const { avatar, script, voiceId } = await req.json();
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

    // Check credits (estimated cost for UGC video)
    const estimatedCost = 50; // Adjust based on actual costs
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
        type: 'ugc',
        status: 'pending',
        input_data: { avatar, script, voiceId },
        cost: estimatedCost,
      })
      .select()
      .single();

    // Trigger N8N webhook
    const webhookResponse = await triggerN8NWebhook({
      endpoint: N8N_ENDPOINTS.ugc,
      data: {
        avatar,
        script,
        voiceId,
        generationId: generation?.id,
      },
      userId,
    });

    if (!webhookResponse.success) {
      throw new Error(webhookResponse.error || 'N8N webhook failed');
    }

    // Update generation status
    await supabase
      .from('generations')
      .update({
        status: 'processing',
        n8n_job_id: webhookResponse.job_id,
      })
      .eq('id', generation?.id);

    // Poll for result (in production, this would be a separate endpoint)
    const result = await pollN8NResult(
      webhookResponse.job_id!,
      N8N_ENDPOINTS.ugc
    );

    // Update generation with result
    await supabase
      .from('generations')
      .update({
        status: 'completed',
        result_url: result.result_url,
      })
      .eq('id', generation?.id);

    // Deduct credits
    await supabase
      .from('users')
      .update({ credits: user.credits - estimatedCost })
      .eq('id', user.id);

    return NextResponse.json({
      success: true,
      videoUrl: result.result_url,
      generationId: generation?.id,
    });
  } catch (error) {
    console.error('Error generating UGC:', error);
    return NextResponse.json(
      { error: 'Failed to generate UGC video' },
      { status: 500 }
    );
  }
}

