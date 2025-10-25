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

    const { productId } = await req.json();
    const supabase = await createClient();

    // Get product data
    const { data: product } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .single();

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // Trigger N8N webhook for AI ideation
    const webhookResponse = await triggerN8NWebhook({
      endpoint: N8N_ENDPOINTS.staticAdsIdeacion,
      data: {
        product,
      },
      userId,
    });

    if (!webhookResponse.success) {
      throw new Error(webhookResponse.error || 'Ideation failed');
    }

    // Poll for result
    const result = await pollN8NResult(
      webhookResponse.job_id!,
      N8N_ENDPOINTS.staticAdsIdeacion
    );

    // The result should contain ad concepts organized by awareness level
    return NextResponse.json({
      success: true,
      concepts: result.result_url, // This would be JSON data, not a URL
    });
  } catch (error) {
    console.error('Error generating ad concepts:', error);
    return NextResponse.json(
      { error: 'Failed to generate ad concepts' },
      { status: 500 }
    );
  }
}

