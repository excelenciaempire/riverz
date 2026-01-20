import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@/lib/supabase/server';
import { estimateBulkTime } from '@/lib/rate-limiter';

const KIE_API_KEY = process.env.KIE_API_KEY || '174d2ff19987520a25ecd1ed9c3ccc2b';
const KIE_BASE_URL = 'https://api.kie.ai';

// Get current Kie.ai balance
async function getKieBalance(): Promise<number> {
  try {
    const response = await fetch(`${KIE_BASE_URL}/api/v1/chat/credit`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${KIE_API_KEY}` },
    });
    if (!response.ok) return 0;
    const data = await response.json();
    return data.code === 200 ? data.data : 0;
  } catch {
    return 0;
  }
}

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

    // Check Kie.ai balance (real-time credits)
    const kieBalance = await getKieBalance();
    
    // Estimate: ~5 Kie.ai credits per static ad generation
    const estimatedKieCost = templateIds.length * 5;
    
    if (kieBalance < estimatedKieCost) {
      return NextResponse.json({
        error: 'Créditos insuficientes',
        required: estimatedKieCost,
        available: kieBalance,
        message: 'No hay suficientes créditos para esta generación'
      }, { status: 402 });
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
