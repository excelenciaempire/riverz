import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit, RATE_LIMITS } from '@/lib/security';

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

    // Rate limit per user. clone is the most expensive single call (writes
    // up to 100 × 5 = 500 generation rows + holds locks on user_credits).
    const rl = await rateLimit(`static-ads-clone:${userId}`, RATE_LIMITS.generation.limit, RATE_LIMITS.generation.windowMs);
    if (!rl.success) {
      return NextResponse.json({ error: 'Demasiadas solicitudes. Intenta en un momento.' }, { status: 429 });
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
    
    // Atomic deduction: read → update with current-balance guard, retry on contention.
    // Without this two concurrent /clone calls could both pass the balance check and
    // overdraw the user's credits.
    let newBalance: number | null = null;
    let lastSeenBalance = 0;
    for (let attempt = 0; attempt < 3 && newBalance === null; attempt++) {
      const { data: userData, error: userError } = await supabaseAdmin
        .from('user_credits')
        .select('credits')
        .eq('clerk_user_id', userId)
        .single();
      if (userError || !userData) {
        return new NextResponse('User not found', { status: 404 });
      }
      lastSeenBalance = userData.credits;
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

      const proposed = userData.credits - totalCost;
      const { data: updRow, error: deductError } = await supabaseAdmin
        .from('user_credits')
        .update({ credits: proposed, updated_at: new Date().toISOString() })
        .eq('clerk_user_id', userId)
        .eq('credits', userData.credits)
        .select('credits')
        .maybeSingle();
      if (deductError) {
        return new NextResponse('Failed to deduct credits', { status: 500 });
      }
      if (updRow) newBalance = updRow.credits;
      // else: row changed mid-flight, retry
    }
    if (newBalance === null) {
      return NextResponse.json(
        { error: 'Concurrent update conflict, please retry', current_credits: lastSeenBalance },
        { status: 409 }
      );
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

    // Fire-and-forget: kick off the queue immediately so the first analysis
    // doesn't have to wait for the frontend useEffect or the GitHub cron.
    // Uses CRON_SECRET so it bypasses Clerk; we don't await the response.
    const cronSecret = process.env.CRON_SECRET;
    const appOrigin = process.env.NEXT_PUBLIC_APP_URL;
    if (cronSecret && appOrigin) {
      fetch(`${appOrigin}/api/static-ads/process-queue`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cronSecret}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ projectId: project.id }),
      }).catch((err) => console.error('[STATIC_AD_CLONE] kickoff failed:', err?.message || err));
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
