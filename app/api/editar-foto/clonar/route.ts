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
    const referenceImage = formData.get('referenceImage') as File;
    const productImage = formData.get('productImage') as File;
    const prompt = formData.get('prompt') as string;
    const format = formData.get('format') as string;
    const numVariants = parseInt(formData.get('numVariants') as string);

    const supabase = await createClient();

    // Upload images to Supabase storage
    const refFileName = `${Date.now()}_ref_${referenceImage.name}`;
    const prodFileName = `${Date.now()}_prod_${productImage.name}`;

    const { error: refUploadError } = await supabase.storage
      .from('generations')
      .upload(refFileName, referenceImage);

    const { error: prodUploadError } = await supabase.storage
      .from('generations')
      .upload(prodFileName, productImage);

    if (refUploadError || prodUploadError) {
      throw new Error('Failed to upload images');
    }

    const { data: { publicUrl: refUrl } } = supabase.storage
      .from('generations')
      .getPublicUrl(refFileName);

    const { data: { publicUrl: prodUrl } } = supabase.storage
      .from('generations')
      .getPublicUrl(prodFileName);

    const { data: user } = await supabase
      .from('users')
      .select('id, credits')
      .eq('clerk_id', userId)
      .single();

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const estimatedCost = 30 * numVariants; // Cost per variant
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
        type: 'editar_foto_clonar',
        status: 'pending',
        input_data: { prompt, format, numVariants },
        cost: estimatedCost,
      })
      .select()
      .single();

    const webhookResponse = await triggerN8NWebhook({
      endpoint: N8N_ENDPOINTS.editarFotoClonar,
      data: {
        referenceImageUrl: refUrl,
        productImageUrl: prodUrl,
        prompt,
        format,
        numVariants,
        generationId: generation?.id,
      },
      userId,
    });

    if (!webhookResponse.success) {
      throw new Error(webhookResponse.error || 'Image cloning failed');
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
      N8N_ENDPOINTS.editarFotoClonar
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

    // Result should contain multiple image URLs
    return NextResponse.json({
      success: true,
      images: result.result_url?.split(',') || [result.result_url],
    });
  } catch (error) {
    console.error('Error cloning image:', error);
    return NextResponse.json(
      { error: 'Failed to clone image' },
      { status: 500 }
    );
  }
}

