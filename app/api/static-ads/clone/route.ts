import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@/lib/supabase/server';
import { estimateBulkTime } from '@/lib/rate-limiter';

export const maxDuration = 30; // Allow time for DB operations

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

    // Validate bulk limit (100 max per batch for safety)
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

    // Calculate cost
    const COST_PER_AD = 50;
    const totalCost = templateIds.length * COST_PER_AD;
    
    // Check user credits first
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('credits')
      .eq('clerk_user_id', userId)
      .single();

    if (userError || !userData) {
      return new NextResponse('User not found', { status: 404 });
    }

    if (userData.credits < totalCost) {
      return NextResponse.json({
        error: 'Insufficient credits',
        required: totalCost,
        available: userData.credits,
        perAd: COST_PER_AD
      }, { status: 402 });
    }

    // Deduct all credits upfront
    const { error: deductError } = await supabase
      .from('users')
      .update({ credits: userData.credits - totalCost })
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

    // 3. Create Generation Records (Pending Analysis)
    // We do NOT call Gemini here to avoid timeouts. The queue processor handles it.
    // Include research_data if available for enhanced prompt generation
    
    const generations = await Promise.all(
      templates.map(async (template: any) => {
        const { data: generation, error: genError } = await supabase
          .from('generations')
          .insert({
            clerk_user_id: userId,
            type: 'static_ad_generation',
            status: 'pending_analysis', // Initial Status - will be processed by queue
            cost: COST_PER_AD,
            project_id: project.id,
            input_data: {
              templateId: template.id,
              productId,
              templateName: template.name,
              templateThumbnail: template.thumbnail_url, // Needed for vision analysis
              productName: product.name,
              productBenefits: product.benefits,
              productImage: product.images?.[0], // Needed for vision analysis
              // Include deep research data if available
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

    // Calculate time estimate for user
    const estimate = estimateBulkTime(templateIds.length);

    return NextResponse.json({ 
      project, 
      generations,
      bulk: {
        total: templateIds.length,
        totalCreditsDeducted: totalCost,
        estimatedMinutes: estimate.estimatedMinutes,
        batches: estimate.batches
      }
    });
  } catch (error: any) {
    console.error('[STATIC_AD_CLONE]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
