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

const COST_PER_IMAGE = 14;
const MAX_IDEAS_PER_BATCH = 25;

/**
 * Multi-select variant of /generate-from-idea. Takes an array of ideaIds
 * and creates one project + N generations in a single transaction. The
 * user is charged 14 × N credits up front; we refund per-row only if the
 * row insert itself fails (rare). Per-image runtime failures inside the
 * pipeline use the existing soft-retry loop in process-queue.
 *
 * Body:
 *   {
 *     ideaIds:    string[]          // 1..MAX
 *     productId:  string
 *     projectName?: string
 *   }
 *
 * Response:
 *   { projectId, generationIds[], inserted, failed }
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return new NextResponse('Unauthorized', { status: 401 });

    const rl = await rateLimit(
      `generate-from-ideas:${userId}`,
      RATE_LIMITS.generation.limit,
      RATE_LIMITS.generation.windowMs
    );
    if (!rl.success) {
      return NextResponse.json(
        { error: 'Demasiadas solicitudes. Intenta en un momento.' },
        { status: 429 }
      );
    }

    const { ideaIds, productId, projectName } = await req.json();

    if (!Array.isArray(ideaIds) || ideaIds.length === 0) {
      return NextResponse.json({ error: 'Missing ideaIds[]' }, { status: 400 });
    }
    if (ideaIds.length > MAX_IDEAS_PER_BATCH) {
      return NextResponse.json(
        { error: `Máximo ${MAX_IDEAS_PER_BATCH} ideas por generación` },
        { status: 400 }
      );
    }
    if (!productId) {
      return NextResponse.json({ error: 'Missing productId' }, { status: 400 });
    }

    // Ownership: product must belong to this user.
    const { data: product, error: prodErr } = await supabaseAdmin
      .from('products')
      .select('*')
      .eq('id', productId)
      .eq('clerk_user_id', userId)
      .single();
    if (prodErr || !product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const productImages: string[] = (product.images || []).slice(0, 7);
    if (productImages.length === 0) {
      return NextResponse.json(
        { error: 'Este producto no tiene imágenes cargadas' },
        { status: 400 }
      );
    }

    // Fetch all ideas in one query, validate they all belong to this product
    // and have an image_prompt populated.
    const { data: ideas, error: ideasErr } = await supabaseAdmin
      .from('ad_concepts')
      .select('*')
      .in('id', ideaIds);
    if (ideasErr || !ideas) {
      return NextResponse.json({ error: 'Failed to load ideas' }, { status: 500 });
    }
    if (ideas.length !== ideaIds.length) {
      return NextResponse.json(
        { error: 'Algunas ideas no se encontraron', missing: ideaIds.length - ideas.length },
        { status: 404 }
      );
    }
    const wrongProduct = ideas.find((i) => i.product_id !== productId);
    if (wrongProduct) {
      return NextResponse.json(
        { error: 'Una o más ideas no pertenecen a este producto' },
        { status: 400 }
      );
    }
    const missingPrompts = ideas.filter((i) => !i.image_prompt?.trim());
    if (missingPrompts.length > 0) {
      return NextResponse.json(
        {
          error: `${missingPrompts.length} idea(s) aún no tienen prompt de imagen asignado. Espera a que el sistema termine.`,
          code: 'MISSING_IMAGE_PROMPT',
          missingHeadlines: missingPrompts.map((i) => i.headline).slice(0, 5),
        },
        { status: 422 }
      );
    }

    // Atomic credit deduction (CAS retry loop, same pattern as clone).
    const totalCost = ideas.length * COST_PER_IMAGE;
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
      if (userData.credits < totalCost) {
        return NextResponse.json(
          {
            error: 'Créditos insuficientes',
            required: totalCost,
            available: userData.credits,
            perImage: COST_PER_IMAGE,
            ideas: ideas.length,
          },
          { status: 402 }
        );
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

    // Create project. Default name is "Lote ideas — {primera idea}…" so the
    // historial card hints at what's inside without needing the user to
    // type a name.
    const firstHeadline = ideas[0]?.headline || 'ideas';
    const resolvedName = (
      projectName?.trim() ||
      `${ideas.length} ideas · ${firstHeadline}`
    ).slice(0, 200);

    const { data: project, error: projectErr } = await supabaseAdmin
      .from('projects')
      .insert({
        clerk_user_id: userId,
        name: resolvedName,
        type: 'static_ads',
        status: 'processing',
      })
      .select()
      .single();
    if (projectErr || !project) {
      // Refund and bail.
      await supabaseAdmin
        .from('user_credits')
        .update({ credits: lastSeenBalance })
        .eq('clerk_user_id', userId);
      return NextResponse.json(
        { error: `Failed to create project: ${projectErr?.message}` },
        { status: 500 }
      );
    }

    // Insert all generation rows. We do them in a single .insert([...]) so
    // either they all land or none do — keeping the cost/row count consistent.
    const aspectRatio = '4:5';
    const rows = ideas.map((idea: any) => ({
      clerk_user_id: userId,
      type: 'static_ad_generation',
      status: 'pending_generation',
      cost: COST_PER_IMAGE,
      project_id: project.id,
      input_data: {
        templateId: `idea-${idea.id}`,
        productId,
        templateName: idea.headline || 'Idea',
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
        generatedPrompt: idea.image_prompt,
        ideaId: idea.id,
        ideaHeadline: idea.headline,
        ideaAwarenessLevel: idea.awareness_level,
      },
    }));

    const { data: generations, error: genErr } = await supabaseAdmin
      .from('generations')
      .insert(rows)
      .select('id');
    if (genErr || !generations) {
      // Refund full amount; project row is harmless cleanup.
      await supabaseAdmin
        .from('user_credits')
        .update({ credits: lastSeenBalance })
        .eq('clerk_user_id', userId);
      await supabaseAdmin.from('projects').delete().eq('id', project.id);
      return NextResponse.json(
        { error: `Failed to create generations: ${genErr?.message}` },
        { status: 500 }
      );
    }

    // Kick off process-queue immediately so the first kie.ai task starts
    // before the next polling tick.
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
        console.error('[GENERATE_FROM_IDEAS] kickoff failed:', err?.message || err)
      );
    }

    return NextResponse.json({
      success: true,
      project,
      projectId: project.id,
      generationIds: generations.map((g) => g.id),
      inserted: generations.length,
      totalCreditsDeducted: totalCost,
    });
  } catch (error: any) {
    console.error('[GENERATE_FROM_IDEAS]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
