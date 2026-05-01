import { auth } from '@clerk/nextjs/server';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { analyzeWithGemini3Pro, GeminiMessage } from '@/lib/kie-client';
import { getPromptWithVariables } from '@/lib/get-ai-prompt';

export const runtime = 'nodejs';
export const maxDuration = 60; // Hobby plan has 10s limit, Pro has 60s
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let productId: string | undefined;
  
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const body = await req.json();
    productId = body.productId;
    
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

    // 3. Get the deep research prompt with all variables injected
    const systemPrompt = await getPromptWithVariables('product_deep_research', {
      PRODUCT_NAME: product.name || '',
      PRODUCT_DESCRIPTION: product.description || product.website || '',
      PRODUCT_PRICE: product.price ? `$${product.price}` : 'No especificado',
      PRODUCT_BENEFITS: product.benefits || '',
      PRODUCT_CATEGORY: product.category || 'General',
      PRODUCT_WEBSITE: product.website || 'No especificado'
    });

    // 4. Prepare text-only request (no images for speed on Hobby plan)
    const userMessage = `Analiza este producto y genera el research profundo en formato JSON.
      
Producto: ${product.name}
Descripción: ${product.description || 'No disponible'}
Beneficios: ${product.benefits || 'No especificados'}
Precio: ${product.price ? '$' + product.price : 'No especificado'}
Categoría: ${product.category || 'General'}
Website: ${product.website || 'No especificado'}

Genera el análisis basándote en esta información del producto.`;

    // 5. Prepare messages (text only for speed)
    const messages: GeminiMessage[] = [
      { role: 'developer', content: systemPrompt },
      { role: 'user', content: userMessage }
    ];

    // 6. Call Gemini 3 Pro for deep research (text only, faster)
    console.log(`[DEEP-RESEARCH] Calling Gemini 3 Pro (text only for speed)...`);
    
    const researchResponse = await analyzeWithGemini3Pro(messages, {
      temperature: 0.5,
      maxTokens: 8000
    });

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
      console.error('[DEEP-RESEARCH] Failed to parse research JSON:', parseError);
      // Store raw response if JSON parsing fails
      researchData = {
        raw_response: researchResponse,
        parse_error: true
      };
    }

    // 8. Update Product with research data and completion timestamp
    const { error: updateError } = await supabase
      .from('products')
      .update({ 
        research_data: researchData,
        research_status: 'completed',
        research_completed_at: new Date().toISOString(),
        // Also update the simple ai_prompt for backwards compatibility
        ai_prompt: researchData.perfil_demografico?.descripcion_detallada || 
                   researchData.perfil_demografico?.descripcion || 
                   researchResponse.substring(0, 500)
      })
      .eq('id', productId);

    if (updateError) {
      console.error('[DEEP-RESEARCH] Failed to update product:', updateError);
      await supabase
        .from('products')
        .update({ research_status: 'failed' })
        .eq('id', productId);
      throw updateError;
    }

    console.log(`[DEEP-RESEARCH] Completed successfully for product ${productId}`);

    return NextResponse.json({ 
      success: true, 
      researchData,
      status: 'completed'
    });

  } catch (error: any) {
    console.error('[DEEP-RESEARCH] Error:', error);
    
    // Try to update status to failed
    if (productId) {
      try {
        const supabase = await createClient();
        await supabase
          .from('products')
          .update({ research_status: 'failed' })
          .eq('id', productId);
      } catch (updateError) {
        console.error('[DEEP-RESEARCH] Failed to update status to failed:', updateError);
      }
    }

    return new NextResponse(error.message || 'Internal Error', { status: 500 });
  }
}
