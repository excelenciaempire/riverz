import { auth } from '@clerk/nextjs/server';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { 
  analyzeWithClaudeSonnet, 
  GeminiMessage,
  imageUrlToBase64,
  stripBase64Prefix,
  getMediaTypeFromDataUri
} from '@/lib/kie-client';
import { getPromptWithVariables } from '@/lib/get-ai-prompt';

export const runtime = 'nodejs';
export const maxDuration = 120; // Allow up to 120 seconds for deep research with multiple images
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

    // 4. Convert ALL product images to base64
    // Claude Sonnet 4.5 supports multimodal - send all images for comprehensive analysis
    const productImages = product.images || [];
    const imageContent: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> = [];
    
    // Add text instruction first
    imageContent.push({
      type: 'text',
      text: `Analiza este producto y genera el research profundo en formato JSON.
      
Producto: ${product.name}
Descripción: ${product.description || 'No disponible'}
Beneficios: ${product.benefits || 'No especificados'}
Precio: ${product.price ? '$' + product.price : 'No especificado'}
Categoría: ${product.category || 'General'}

Las imágenes del producto se muestran a continuación. Analiza todas las imágenes para entender completamente el producto, su packaging, presentación y características visuales.`
    });

    // Convert each image to base64 and add to content
    console.log(`[DEEP-RESEARCH] Processing ${productImages.length} product images...`);
    
    for (const imageUrl of productImages) {
      if (imageUrl && imageUrl.startsWith('http')) {
        try {
          // Download and convert to base64
          const dataUri = await imageUrlToBase64(imageUrl);
          
          // For Claude via kie.ai, we can send as data URI
          imageContent.push({
            type: 'image_url',
            image_url: { url: dataUri }
          });
          
          console.log(`[DEEP-RESEARCH] Added image: ${imageUrl.substring(0, 50)}...`);
        } catch (imgError) {
          console.error(`[DEEP-RESEARCH] Failed to process image: ${imageUrl}`, imgError);
          // Continue with other images
        }
      }
    }

    // 5. Prepare Claude Messages
    const messages: GeminiMessage[] = [
      {
        role: 'developer',
        content: systemPrompt
      },
      {
        role: 'user',
        content: imageContent
      }
    ];

    // 6. Call Claude Sonnet 4.5 for deep research
    console.log(`[DEEP-RESEARCH] Calling Claude Sonnet 4.5 with ${imageContent.length - 1} images...`);
    
    const researchResponse = await analyzeWithClaudeSonnet(messages, {
      temperature: 0.7,
      maxTokens: 8000,
      model: 'claude-sonnet-4-5-20250929'
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
      status: 'completed',
      imagesProcessed: imageContent.length - 1 // Subtract the text content
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
