import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const KIE_API_KEY = process.env.KIE_API_KEY!;
const KIE_API_URL = 'https://api.kie.ai/api/v1/jobs/createTask';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Cost per edit (matches Nano Banana Pro pricing)
const EDIT_COST = 14;

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { prompt, imageUrl, generationId } = await req.json();

    if (!prompt || !imageUrl) {
      return NextResponse.json({ error: 'Missing prompt or imageUrl' }, { status: 400 });
    }

    // Check user credits before editing
    const { data: userData, error: userError } = await supabase
      .from('user_credits')
      .select('credits')
      .eq('clerk_user_id', userId)
      .single();

    if (userError || !userData || userData.credits < EDIT_COST) {
      return NextResponse.json({
        error: 'Créditos insuficientes para editar',
        required: EDIT_COST,
        available: userData?.credits || 0
      }, { status: 402 });
    }

    // Deduct credits
    await supabase
      .from('user_credits')
      .update({ 
        credits: userData.credits - EDIT_COST,
        updated_at: new Date().toISOString()
      })
      .eq('clerk_user_id', userId);

    // Call KIE API with Nano Banana Pro
    // IMPORTANT: Max 8 images per request - here we use 1 (the image being edited)
    const response = await fetch(KIE_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${KIE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'nano-banana-pro',
        input: {
          prompt: prompt,
          image_input: [imageUrl], // Single image being edited
          aspect_ratio: 'auto', // Preserve original aspect ratio
          resolution: '2K', // High quality output
          output_format: 'png'
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('KIE API Error:', errorText);
      
      // Refund credits on failure
      await supabase
        .from('user_credits')
        .update({ credits: userData.credits })
        .eq('clerk_user_id', userId);
      
      return NextResponse.json({ error: `API Error: ${errorText}` }, { status: response.status });
    }

    const data = await response.json();

    if (data.code !== 200) {
      // Refund credits on failure
      await supabase
        .from('user_credits')
        .update({ credits: userData.credits })
        .eq('clerk_user_id', userId);
      
      return NextResponse.json({ error: data.msg }, { status: 500 });
    }

    return NextResponse.json({ 
      taskId: data.data.taskId,
      generationId,
      creditsCost: EDIT_COST
    });

  } catch (error: any) {
    console.error('Error calling AI edit:', error);
    return NextResponse.json({ error: error.message || 'Internal Error' }, { status: 500 });
  }
}
