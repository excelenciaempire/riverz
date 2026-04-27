import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

    if (templateIds.length > 100) {
      return NextResponse.json({ 
        error: 'Maximum 100 templates per batch',
        maxAllowed: 100
      }, { status: 400 });
    }

    if (!productId) {
      return new NextResponse('Missing productId', { status: 400 });
    }

    if (!projectName) {
      return new NextResponse('Missing projectName', { status: 400 });
    }

    // 1. Fetch Product Data
    const { data: product, error: prodError } = await supabaseAdmin
      .from('products')
      .select('*')
      .eq('id', productId)
      .single();

    if (prodError || !product) {
      return new NextResponse('Product not found', { status: 404 });
    }

    // 2. Fetch Templates Data
    const { data: templates, error: templError } = await supabaseAdmin
      .from('templates')
      .select('*')
      .in('id', templateIds);

    if (templError) {
       return new NextResponse('Error fetching templates', { status: 500 });
    }

    // Pricing model: each Nano Banana Pro image ≈ $0.134 ≈ 14 credits.
    // Per selected template we now generate 5 distinct creative variations,
    // so the user is billed 14 × 5 = 70 credits per template.
    const COST_PER_IMAGE = 14;
    const VARIATIONS_PER_TEMPLATE = 5;
    const COST_PER_TEMPLATE = COST_PER_IMAGE * VARIATIONS_PER_TEMPLATE;
    const totalCost = templateIds.length * COST_PER_TEMPLATE;
    
    // Check user's internal credits
    const { data: userData, error: userError } = await supabaseAdmin
      .from('user_credits')
      .select('credits')
      .eq('clerk_user_id', userId)
      .single();

    if (userError || !userData) {
      return new NextResponse('User not found', { status: 404 });
    }

    if (userData.credits < totalCost) {
      return NextResponse.json({
        error: 'Créditos insuficientes',
        required: totalCost,
        available: userData.credits,
        perImage: COST_PER_IMAGE,
        perTemplate: COST_PER_TEMPLATE,
        variationsPerTemplate: VARIATIONS_PER_TEMPLATE,
      }, { status: 402 });
    }

    // Deduct credits upfront
    const { error: deductError } = await supabaseAdmin
      .from('user_credits')
      .update({ 
        credits: userData.credits - totalCost,
        updated_at: new Date().toISOString()
      })
      .eq('clerk_user_id', userId);

    if (deductError) {
      return new NextResponse('Failed to deduct credits', { status: 500 });
    }

    // Create Project
    const { data: project, error: projectError } = await supabaseAdmin
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

    // 3. Create Generation Records — 5 variations per template.
    // The variation with index=1 is the LEADER: it runs the shared analysis steps
    // (template analysis + adaptation + 5-prompt generation) and writes the JSONs
    // into the sibling rows. Variations 2..5 wait in pending_variation until
    // the leader hands them their assigned prompt.
    const productImages = (product.images || []).slice(0, 7);

    const allGenerations: any[] = [];
    for (const template of templates as any[]) {
      const variationRows = await Promise.all(
        Array.from({ length: VARIATIONS_PER_TEMPLATE }, (_, i) => i + 1).map(async (variationIndex) => {
          const isLeader = variationIndex === 1;
          const { data: generation, error: genError } = await supabaseAdmin
            .from('generations')
            .insert({
              clerk_user_id: userId,
              type: 'static_ad_generation',
              status: isLeader ? 'pending_analysis' : 'pending_variation',
              cost: COST_PER_IMAGE,
              project_id: project.id,
              input_data: {
                templateId: template.id,
                productId,
                templateName: template.name,
                templateThumbnail: template.thumbnail_url,
                productName: product.name,
                productBenefits: product.benefits,
                productImages,
                productImage: productImages[0] || null,
                researchData: product.research_data || null,
                hasResearch: !!product.research_data,
                variationIndex,
                isLeader,
                totalVariations: VARIATIONS_PER_TEMPLATE,
              },
            })
            .select()
            .single();

          if (genError) throw genError;
          return generation;
        })
      );
      allGenerations.push(...variationRows);
    }

    // Estimation: ~30s per Nano Banana image, processed in parallel batches.
    const totalImages = templateIds.length * VARIATIONS_PER_TEMPLATE;
    const estimatedMinutes = Math.max(1, Math.ceil(totalImages * 0.3));
    const batches = Math.ceil(totalImages / 10);

    return NextResponse.json({
      project,
      generations: allGenerations,
      bulk: {
        templateCount: templateIds.length,
        variationsPerTemplate: VARIATIONS_PER_TEMPLATE,
        totalImages,
        totalCreditsDeducted: totalCost,
        estimatedMinutes,
        batches,
      },
    });
  } catch (error: any) {
    console.error('[STATIC_AD_CLONE]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
