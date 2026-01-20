import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@/lib/supabase/server';
import { deductCreditsForGeneration } from '@/lib/generation-helper';

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { templateIds, productId, projectName } = await req.json();

    if (!templateIds || !Array.isArray(templateIds) || templateIds.length === 0) {
      return new NextResponse('Missing templateIds', { status: 400 });
    }

    if (!productId) {
      return new NextResponse('Missing productId', { status: 400 });
    }

    if (!projectName) {
      return new NextResponse('Missing projectName', { status: 400 });
    }

    const supabase = await createClient();

    // 1. Fetch Product Data
    const { data: product, error: prodError } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .single();

    if (prodError || !product) {
      return new NextResponse('Product not found', { status: 404 });
    }

    // 2. Fetch Templates Data
    const { data: templates, error: templError } = await supabase
      .from('templates')
      .select('*')
      .in('id', templateIds);

    if (templError) {
       return new NextResponse('Error fetching templates', { status: 500 });
    }

    // Calculate cost
    const COST_PER_AD = 50;
    
    // Deduct credits
    const deductionResult = await deductCreditsForGeneration(userId, 'static_ad_generation', `Clonación de Static Ads: ${projectName}`, req.headers);
    if (!deductionResult.success) {
      return new NextResponse(deductionResult.error || 'Insufficient credits', { status: 402 });
    }

    // Create Project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert({
        clerk_user_id: userId,
        name: projectName,
        type: 'static_ads',
        status: 'processing'
      })
      .select()
      .single();

    if (projectError) {
      throw new Error(`Failed to create project: ${projectError.message}`);
    }

    // 3. Create Generation Records (Pending Analysis)
    // We do NOT call Gemini here to avoid timeouts. The queue processor handles it.
    
    const generations = await Promise.all(
      templates.map(async (template: any) => {
        const { data: generation, error: genError } = await supabase
          .from('generations')
          .insert({
            clerk_user_id: userId,
            type: 'static_ad_generation',
            status: 'pending_analysis', // New Initial Status
            cost: COST_PER_AD,
            project_id: project.id,
            input_data: {
              templateId: template.id,
              productId,
              templateName: template.name,
              templateThumbnail: template.thumbnail_url, // Needed for vision analysis
              productName: product.name,
              productImage: product.images?.[0] // Needed for vision analysis
            },
          })
          .select()
          .single();

        if (genError) throw genError;
        return generation;
      })
    );

    return NextResponse.json({ project, generations });
  } catch (error: any) {
    console.error('[STATIC_AD_CLONE]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
