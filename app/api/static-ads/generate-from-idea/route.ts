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

/**
 * Static Ads · Ideación → Image
 *
 * Turns a single ad_concepts row into one Nano Banana Pro generation. The
 * concept already carries `image_prompt` (populated by the internal ideation
 * system). This endpoint:
 *
 *   1. Validates ownership (concept → product → user) and credits.
 *   2. Creates a project (or appends to an existing one).
 *   3. Inserts a single `generations` row directly in `pending_generation`
 *      status — Steps 1–3 of the gallery pipeline (template analysis +
 *      adaptation + prompt generation by Gemini) are SKIPPED because the
 *      `image_prompt` is the final Nano Banana prompt already.
 *   4. Kicks off process-queue so STEP 4 (createKieTask) runs without
 *      waiting for the next UI tick.
 *
 * The existing process-queue code in `processVariationGeneration` handles
 * `pending_generation` rows without requiring `templateAnalysisJson` or
 * `adaptedJson`, so no orchestrator change is needed.
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return new NextResponse('Unauthorized', { status: 401 });

    const rl = await rateLimit(
      `static-ads-generate-from-idea:${userId}`,
      RATE_LIMITS.generation.limit,
      RATE_LIMITS.generation.windowMs
    );
    if (!rl.success) {
      return NextResponse.json(
        { error: 'Demasiadas solicitudes. Intenta en un momento.' },
        { status: 429 }
      );
    }

    const { ideaId, productId, projectName, projectId: existingProjectId } = await req.json();

    if (!ideaId) return NextResponse.json({ error: 'Missing ideaId' }, { status: 400 });
    if (!productId) return NextResponse.json({ error: 'Missing productId' }, { status: 400 });

    // Fetch concept + product. We require both to belong to the same product
    // and that product to belong to the user — otherwise a malicious caller
    // could trigger generations against someone else's product photos.
    const { data: idea, error: ideaErr } = await supabaseAdmin
      .from('ad_concepts')
      .select('*')
      .eq('id', ideaId)
      .single();
    if (ideaErr || !idea) {
      return NextResponse.json({ error: 'Idea not found' }, { status: 404 });
    }
    if (idea.product_id !== productId) {
      return NextResponse.json({ error: 'Idea does not belong to this product' }, { status: 400 });
    }

    const { data: product, error: prodErr } = await supabaseAdmin
      .from('products')
      .select('*')
      .eq('id', productId)
      .eq('clerk_user_id', userId)
      .single();
    if (prodErr || !product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    if (!idea.image_prompt || typeof idea.image_prompt !== 'string' || !idea.image_prompt.trim()) {
      return NextResponse.json(
        {
          error: 'Esta idea aún no tiene un prompt asignado. Espera a que el sistema lo genere.',
          code: 'MISSING_IMAGE_PROMPT',
        },
        { status: 422 }
      );
    }

    const productImages: string[] = (product.images || []).slice(0, 7);
    if (productImages.length === 0) {
      return NextResponse.json(
        { error: 'Este producto no tiene imágenes cargadas' },
        { status: 400 }
      );
    }

    // Atomic credit deduction (mirrors the pattern in clone/route.ts).
    const COST_PER_IMAGE = 14;
    let newBalance: number | null = null;
    let lastSeenBalance = 0;
    for (let attempt = 0; attempt < 3 && newBalance === null; attempt++) {
      const { data: userData, error: userError } = await supabaseAdmin
        .from('user_credits')
        .select('credits')
        .eq('clerk_user_id', userId)
        .single();
      if (userError || !userData) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      lastSeenBalance = userData.credits;
      if (userData.credits < COST_PER_IMAGE) {
        return NextResponse.json(
          {
            error: 'Créditos insuficientes',
            required: COST_PER_IMAGE,
            available: userData.credits,
          },
          { status: 402 }
        );
      }
      const proposed = userData.credits - COST_PER_IMAGE;
      const { data: updRow, error: deductError } = await supabaseAdmin
        .from('user_credits')
        .update({ credits: proposed, updated_at: new Date().toISOString() })
        .eq('clerk_user_id', userId)
        .eq('credits', userData.credits)
        .select('credits')
        .maybeSingle();
      if (deductError) {
        return NextResponse.json({ error: 'Failed to deduct credits' }, { status: 500 });
      }
      if (updRow) newBalance = updRow.credits;
    }
    if (newBalance === null) {
      return NextResponse.json(
        { error: 'Concurrent update conflict, please retry', current_credits: lastSeenBalance },
        { status: 409 }
      );
    }

    // Create or reuse project. Default name is the idea's headline so the
    // historial card title matches what the user clicked on.
    const resolvedProjectName = (projectName?.trim() || idea.headline || 'Idea generada').slice(0, 200);
    let project: any;
    if (existingProjectId) {
      const { data: existing, error: lookupError } = await supabaseAdmin
        .from('projects')
        .select('*')
        .eq('id', existingProjectId)
        .eq('clerk_user_id', userId)
        .single();
      if (lookupError || !existing) {
        return NextResponse.json({ error: 'Existing project not found or not yours' }, { status: 404 });
      }
      project = existing;
      if (existing.status !== 'processing') {
        await supabaseAdmin.from('projects').update({ status: 'processing' }).eq('id', existing.id);
      }
    } else {
      const { data: created, error: projectError } = await supabaseAdmin
        .from('projects')
        .insert({
          clerk_user_id: userId,
          name: resolvedProjectName,
          type: 'static_ads',
          status: 'processing',
        })
        .select()
        .single();
      if (projectError) {
        return NextResponse.json(
          { error: `Failed to create project: ${projectError.message}` },
          { status: 500 }
        );
      }
      project = created;
    }

    // Insert the generation row directly in `pending_generation`. We also
    // expose `generatedPrompt` (the field process-queue STEP 4 reads) so it
    // can dispatch to Nano Banana without going through Steps 1–3.
    const aspectRatio = '4:5';
    const { data: generation, error: genError } = await supabaseAdmin
      .from('generations')
      .insert({
        clerk_user_id: userId,
        type: 'static_ad_generation',
        status: 'pending_generation',
        cost: COST_PER_IMAGE,
        project_id: project.id,
        input_data: {
          // Prefix `idea-` so process-queue's byTemplate grouping keeps each
          // idea-derived generation isolated (no leader/sibling logic kicks
          // in — there's only one row per idea-template-id).
          templateId: `idea-${idea.id}`,
          productId,
          // Show the idea headline as the "template name" in the historial
          // card so the user recognises which idea produced the image.
          templateName: idea.headline || 'Idea',
          // No template thumbnail for ideas — they don't reference a visual
          // template. The historial card will skip the thumbnail row.
          templateThumbnail: null,
          templateDims: null,
          templateAspectRatio: aspectRatio,
          productName: product.name,
          productBenefits: product.benefits,
          productImages,
          productImage: productImages[0] || null,
          researchData: product.research_data || null,
          hasResearch: !!product.research_data,
          variationIndex: 1,
          isLeader: true,
          totalVariations: 1,
          // The Nano Banana prompt is the idea's `image_prompt` verbatim —
          // process-queue STEP 4 reads `generatedPrompt` and forwards it.
          generatedPrompt: idea.image_prompt,
          // Origin metadata for the historial / analytics.
          ideaId: idea.id,
          ideaHeadline: idea.headline,
          ideaAwarenessLevel: idea.awareness_level,
        },
      })
      .select()
      .single();

    if (genError) {
      // Refund credits if we couldn't create the row.
      await supabaseAdmin
        .from('user_credits')
        .update({ credits: lastSeenBalance })
        .eq('clerk_user_id', userId);
      return NextResponse.json(
        { error: `Failed to create generation: ${genError.message}` },
        { status: 500 }
      );
    }

    // Fire-and-forget process-queue kickoff (same pattern as clone).
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
      }).catch((err) =>
        console.error('[STATIC_AD_GENERATE_FROM_IDEA] kickoff failed:', err?.message || err)
      );
    }

    return NextResponse.json({
      success: true,
      project,
      generation,
      projectId: project.id,
      generationId: generation.id,
    });
  } catch (error: any) {
    console.error('[STATIC_AD_GENERATE_FROM_IDEA]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
