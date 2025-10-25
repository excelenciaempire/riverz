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
    const image = formData.get('image') as File;
    const prompt = formData.get('prompt') as string;

    const supabase = await createClient();

    const { data: user } = await supabase
      .from('users')
      .select('id, credits')
      .eq('clerk_id', userId)
      .single();

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const estimatedCost = 15;
    if (user.credits < estimatedCost) {
      return NextResponse.json(
        { error: 'Insufficient credits' },
        { status: 402 }
      );
    }

    const { data: generation } = await supabase
      .from('generations')
      .insert({
        user_id: user.id,
        type: 'editar_foto_editar',
        status: 'pending',
        input_data: { prompt },
        cost: estimatedCost,
      })
      .select()
      .single();

    // Upload image to Supabase storage
    const fileName = `${Date.now()}_${image.name}`;
    const { error: uploadError } = await supabase.storage
      .from('generations')
      .upload(fileName, image);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('generations')
      .getPublicUrl(fileName);

    const webhookResponse = await triggerN8NWebhook({
      endpoint: N8N_ENDPOINTS.editarFotoEditar,
      data: {
        imageUrl: publicUrl,
        prompt,
        generationId: generation?.id,
      },
      userId,
    });

    if (!webhookResponse.success) {
      throw new Error(webhookResponse.error || 'Image editing failed');
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
      N8N_ENDPOINTS.editarFotoEditar
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
      images: [result.result_url],
    });
  } catch (error) {
    console.error('Error editing image:', error);
    return NextResponse.json(
      { error: 'Failed to edit image' },
      { status: 500 }
    );
  }
}

