import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

function getSupabaseAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

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

    // Calculate cost - matches Kie.ai pricing (Nano Banana Pro ~$0.134/image)
    // 1 credit = $0.01, so 14 credits = $0.14 ≈ Kie.ai cost
    const COST_PER_AD = 14;
    const totalCost = templateIds.length * COST_PER_AD;
    
    // Check user's internal credits
    const supabaseAdmin = getSupabaseAdmin();
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
        perAd: COST_PER_AD
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

    // 3. Create Generation Records
    // Include ALL product images (Nano Banana Pro supports up to 8 images per request)
    const productImages = (product.images || []).slice(0, 7); // Max 7 product images (leave 1 slot for template)
    
    const generations = await Promise.all(
      templates.map(async (template: any) => {
        const { data: generation, error: genError } = await supabase
          .from('generations')
          .insert({
            clerk_user_id: userId,
            type: 'static_ad_generation',
            status: 'pending_analysis',
            cost: COST_PER_AD,
            project_id: project.id,
            input_data: {
              templateId: template.id,
              productId,
              templateName: template.name,
              templateThumbnail: template.thumbnail_url,
              productName: product.name,
              productBenefits: product.benefits,
              productImages: productImages, // ALL product images (max 7)
              productImage: productImages[0] || null, // Primary image for backwards compat
              researchData: product.research_data || null,
              hasResearch: !!product.research_data
            },
          })
          .select()
          .single();

        if (genError) throw genError;
        return generation;
      })
    );

    // Simple estimation
    const estimatedMinutes = Math.ceil(templateIds.length * 0.5);
    const batches = Math.ceil(templateIds.length / 5);

    return NextResponse.json({ 
      project, 
      generations,
      bulk: {
        total: templateIds.length,
        totalCreditsDeducted: totalCost,
        estimatedMinutes,
        batches
      }
    });
  } catch (error: any) {
    console.error('[STATIC_AD_CLONE]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
