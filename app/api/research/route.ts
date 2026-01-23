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

    // Update status to processing
    await supabase
      .from('products')
      .update({ research_status: 'processing' })
      .eq('id', productId);

    // Get prompt template
    const promptTemplate = await getPromptText('product_deep_research');
    
    const systemPrompt = promptTemplate
      .replace('{PRODUCT_NAME}', product.name || '')
      .replace('{PRODUCT_DESCRIPTION}', product.website || '')
      .replace('{PRODUCT_BENEFITS}', product.benefits || '')
      .replace('{TARGET_AUDIENCE}', 'General consumer interested in this product category');

    const productImageUrl = product.images?.[0];
    
    const messages: GeminiMessage[] = [
      { role: 'developer', content: systemPrompt },
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

    // Call Gemini
    const researchResponse = await analyzeWithGemini3Pro(messages);

    // Parse JSON
    let researchData;
    try {
      const jsonMatch = researchResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        researchData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found');
      }
    } catch {
      researchData = { raw_response: researchResponse, parse_error: true };
    }

    // Update product
    const { error: updateError } = await supabase
      .from('products')
      .update({ 
        research_data: researchData,
        research_status: 'completed',
        ai_prompt: researchData.perfil_demografico?.descripcion || researchResponse.substring(0, 500)
      })
      .eq('id', productId);

    if (updateError) {
      await supabase.from('products').update({ research_status: 'failed' }).eq('id', productId);
      throw updateError;
    }

    return NextResponse.json({ success: true, researchData, status: 'completed' });

  } catch (error: any) {
    console.error('Research error:', error);
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
      hasResearch: !!product.research_data,
      researchData: product.research_data
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
