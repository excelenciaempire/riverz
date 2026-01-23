import { auth } from '@clerk/nextjs/server';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { analyzeWithGemini3Pro, GeminiMessage } from '@/lib/kie-client';
import { getPromptText } from '@/lib/get-ai-prompt';

export const runtime = 'nodejs';
export const maxDuration = 60; // Allow up to 60 seconds for deep research
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { productId } = await req.json();
    if (!productId) {
      return new NextResponse('Missing productId', { status: 400 });
    }

    const supabase = await createClient();

    // 1. Fetch Product Data
    const { data: product, error: fetchError } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .single();

    if (fetchError || !product) {
      return new NextResponse('Product not found', { status: 404 });
    }

    // 2. Update status to processing
    await supabase
      .from('products')
      .update({ research_status: 'processing' })
      .eq('id', productId);

    // 3. Get the deep research prompt template
    const promptTemplate = await getPromptText('product_deep_research');
    
    // 4. Replace variables in prompt
    const systemPrompt = promptTemplate
      .replace('{PRODUCT_NAME}', product.name || '')
      .replace('{PRODUCT_DESCRIPTION}', product.website || '')
      .replace('{PRODUCT_BENEFITS}', product.benefits || '')
      .replace('{TARGET_AUDIENCE}', 'General consumer interested in this product category');

    // 5. Prepare Gemini Messages with product image
    const productImageUrl = product.images?.[0];
    
    const messages: GeminiMessage[] = [
      {
        role: 'developer',
        content: systemPrompt
      },
      {
        role: 'user',
        content: [
          { 
            type: 'text', 
            text: `Analiza este producto y genera el research profundo en formato JSON. Producto: ${product.name}. Beneficios: ${product.benefits}` 
          },
          ...(productImageUrl ? [{ type: 'image_url', image_url: { url: productImageUrl } } as const] : [])
        ]
      }
    ];

    // 6. Call Gemini 3 Pro for deep research
    const researchResponse = await analyzeWithGemini3Pro(messages);

    // 7. Parse JSON response
    let researchData;
    try {
      // Try to extract JSON from the response
      const jsonMatch = researchResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        researchData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse research JSON:', parseError);
      // Store raw response if JSON parsing fails
      researchData = {
        raw_response: researchResponse,
        parse_error: true
      };
    }

    // 8. Update Product with research data
    const { error: updateError } = await supabase
      .from('products')
      .update({ 
        research_data: researchData,
        research_status: 'completed',
        // Also update the simple ai_prompt for backwards compatibility
        ai_prompt: researchData.perfil_demografico?.descripcion || researchResponse.substring(0, 500)
      })
      .eq('id', productId);

    if (updateError) {
      console.error('Failed to update product:', updateError);
      await supabase
        .from('products')
        .update({ research_status: 'failed' })
        .eq('id', productId);
      throw updateError;
    }

    return NextResponse.json({ 
      success: true, 
      researchData,
      status: 'completed'
    });

  } catch (error: any) {
    console.error('Error in deep research:', error);
    
    // Try to update status to failed
    try {
      const { productId } = await req.json().catch(() => ({}));
      if (productId) {
        const supabase = await createClient();
        await supabase
          .from('products')
          .update({ research_status: 'failed' })
          .eq('id', productId);
      }
    } catch {}

    return new NextResponse(error.message || 'Internal Error', { status: 500 });
  }
}
