import { auth } from '@clerk/nextjs/server';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { analyzeWithGemini3Pro, GeminiMessage } from '@/lib/kie-client';
import { getPromptText } from '@/lib/get-ai-prompt';

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

    // 2. Prepare Gemini Messages
    const productImageUrl = product.images?.[0];
    
    // Get dynamic prompt from database
    const systemPrompt = await getPromptText('product_analysis');
    
    const messages: GeminiMessage[] = [
      {
        role: 'system',
        content: systemPrompt
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: `Product Name: ${product.name}\nBenefits: ${product.benefits}\nDescription: ${product.website || ''}` },
          ...(productImageUrl ? [{ type: 'image_url', image_url: { url: productImageUrl } } as const] : [])
        ]
      }
    ];

    // 3. Call Gemini
    const aiPrompt = await analyzeWithGemini3Pro(messages);

    // 4. Update Product with AI Prompt
    const { error: updateError } = await supabase
      .from('products')
      .update({ ai_prompt: aiPrompt })
      .eq('id', productId);

    if (updateError) throw updateError;

    return NextResponse.json({ success: true, aiPrompt });
  } catch (error) {
    console.error('Error analyzing product with Gemini 3 Pro:', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
