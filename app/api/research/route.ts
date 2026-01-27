import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { analyzeWithGemini3Pro, GeminiMessage } from '@/lib/kie-client';
import { getPromptText } from '@/lib/get-ai-prompt';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST /api/research - Start deep research
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { productId } = await req.json();
    if (!productId) {
      return NextResponse.json({ error: 'Missing productId' }, { status: 400 });
    }

    // Fetch Product
    const { data: product, error: fetchError } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .single();

    if (fetchError || !product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    console.log('[RESEARCH] Starting for product:', product.name, 'ID:', productId);

    // Update status to processing
    await supabase
      .from('products')
      .update({ research_status: 'processing' })
      .eq('id', productId);

    // Get prompt template from DB or fallback
    let promptTemplate: string;
    try {
      promptTemplate = await getPromptText('product_deep_research');
      console.log('[RESEARCH] Got prompt template, length:', promptTemplate.length);
    } catch (promptError) {
      console.error('[RESEARCH] Error getting prompt:', promptError);
      promptTemplate = `Analiza el producto "{PRODUCT_NAME}" con beneficios "{PRODUCT_BENEFITS}" y genera un perfil de comprador en formato JSON.`;
    }
    
    // Replace variables in the prompt
    const systemPrompt = promptTemplate
      .replace(/\{PRODUCT_NAME\}/g, product.name || 'Producto')
      .replace(/\{PRODUCT_DESCRIPTION\}/g, product.website || product.name || '')
      .replace(/\{PRODUCT_BENEFITS\}/g, product.benefits || '')
      .replace(/\{TARGET_AUDIENCE\}/g, 'Consumidor interesado en este tipo de producto');

    const productImageUrl = product.images?.[0];
    console.log('[RESEARCH] Product image:', productImageUrl ? 'Present' : 'None');
    
    // Build messages for Gemini
    const userContent: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> = [
      { 
        type: 'text', 
        text: `Analiza este producto y genera el research profundo en formato JSON válido.
        
Producto: ${product.name}
Beneficios: ${product.benefits || 'No especificados'}
Web: ${product.website || 'No disponible'}

Responde ÚNICAMENTE con el JSON, sin markdown ni explicaciones adicionales.` 
      }
    ];
    
    // Add product image if available
    if (productImageUrl && productImageUrl.startsWith('http')) {
      userContent.push({ 
        type: 'image_url', 
        image_url: { url: productImageUrl } 
      });
    }
    
    const messages: GeminiMessage[] = [
      { role: 'developer', content: systemPrompt },
      { role: 'user', content: userContent }
    ];

    // Call Gemini
    let researchResponse: string;
    let researchData: any;
    
    try {
      console.log('[RESEARCH] Calling Gemini 3 Pro...');
      researchResponse = await analyzeWithGemini3Pro(messages);
      console.log('[RESEARCH] Gemini response received, length:', researchResponse?.length || 0);
      console.log('[RESEARCH] Response preview:', researchResponse?.substring(0, 300));
    } catch (geminiError: any) {
      console.error('[RESEARCH] Gemini API error:', geminiError.message);
      
      // Mark as failed instead of using fallback
      await supabase
        .from('products')
        .update({ 
          research_status: 'failed',
          research_data: { error: geminiError.message, timestamp: new Date().toISOString() }
        })
        .eq('id', productId);
      
      return NextResponse.json({ 
        success: false, 
        error: `Error de IA: ${geminiError.message}`,
        status: 'failed' 
      }, { status: 500 });
    }

    // Parse JSON from response
    try {
      // Remove markdown code blocks if present
      let cleanedResponse = researchResponse
        .replace(/```json\n?/gi, '')
        .replace(/```\n?/gi, '')
        .trim();
      
      // Try to extract JSON object
      const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        researchData = JSON.parse(jsonMatch[0]);
        console.log('[RESEARCH] Successfully parsed JSON with keys:', Object.keys(researchData));
      } else {
        throw new Error('No JSON object found in response');
      }
    } catch (parseError: any) {
      console.error('[RESEARCH] JSON parse error:', parseError.message);
      console.log('[RESEARCH] Raw response:', researchResponse);
      
      // Store raw response for debugging
      researchData = { 
        raw_response: researchResponse, 
        parse_error: true,
        error_message: parseError.message
      };
    }

    // Update product with research data
    const { error: updateError } = await supabase
      .from('products')
      .update({ 
        research_data: researchData,
        research_status: researchData.parse_error ? 'partial' : 'completed',
        ai_prompt: researchData.perfil_demografico?.descripcion || 
                   researchData.perfil_demografico?.avatar ||
                   `Research generado para ${product.name}`
      })
      .eq('id', productId);

    if (updateError) {
      console.error('[RESEARCH] DB update error:', updateError);
      await supabase.from('products').update({ research_status: 'failed' }).eq('id', productId);
      throw updateError;
    }

    console.log('[RESEARCH] Completed successfully for product:', product.name);

    return NextResponse.json({ 
      success: true, 
      researchData, 
      status: researchData.parse_error ? 'partial' : 'completed',
      hasParseError: !!researchData.parse_error
    });

  } catch (error: any) {
    console.error('[RESEARCH] Unexpected error:', error);
    return NextResponse.json({ error: error.message || 'Internal Error' }, { status: 500 });
  }
}

// GET /api/research?productId=xxx - Get research status
export async function GET(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const productId = searchParams.get('productId');

    if (!productId) {
      return NextResponse.json({ error: 'Missing productId' }, { status: 400 });
    }

    const { data: product, error } = await supabase
      .from('products')
      .select('research_status, research_data')
      .eq('id', productId)
      .single();

    if (error || !product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    return NextResponse.json({
      status: product.research_status || null,
      hasResearch: !!product.research_data && !product.research_data?.error,
      researchData: product.research_data,
      hasFallback: product.research_data?.generated_fallback || false,
      hasParseError: product.research_data?.parse_error || false
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
