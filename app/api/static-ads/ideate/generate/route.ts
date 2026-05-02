import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit, RATE_LIMITS } from '@/lib/security';
import { runIdeationForProduct } from '@/lib/ideation-pipeline';

export const runtime = 'nodejs';
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

/**
 * Trigger a fresh ideation batch for a product. Heavy: runs N concept
 * generations + N image-prompt generations through kie.ai. Wall-clock is
 * typically 30–90s for batches of 9–30, so the route uses maxDuration=300
 * and the UI shows a "Generando ideas..." spinner.
 *
 * Body: { productId, count?: number }   — count defaults to admin_config.ideas_per_batch
 *
 * Each call APPENDS to ad_concepts (does not replace). The UI offers a
 * "Generar más ideas" button on subsequent runs that just reuses this
 * endpoint with the same product.
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const rl = await rateLimit(
      `ideate-generate:${userId}`,
      RATE_LIMITS.generation.limit,
      RATE_LIMITS.generation.windowMs
    );
    if (!rl.success) {
      return NextResponse.json(
        { error: 'Demasiadas solicitudes. Intenta en un momento.' },
        { status: 429 }
      );
    }

    const { productId, count } = await req.json();
    if (!productId) return NextResponse.json({ error: 'Missing productId' }, { status: 400 });

    // Ownership check.
    const { data: product, error: prodErr } = await supabaseAdmin
      .from('products')
      .select('id, name')
      .eq('id', productId)
      .eq('clerk_user_id', userId)
      .single();
    if (prodErr || !product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const requested = typeof count === 'number' ? Math.max(3, Math.min(60, count)) : undefined;

    let result: { inserted: number; failed: number };
    try {
      result = await runIdeationForProduct({ productId, count: requested });
    } catch (err: any) {
      const msg = err?.message || 'Ideation pipeline failed';
      // The most common cause is the admin not having edited the placeholder
      // prompts yet (`ideation_concept_generation` / `ideation_image_prompt`).
      // Surface a clear actionable error so the owner knows what to do.
      const isPromptIssue =
        msg.includes('No prompt found') ||
        msg.includes('PLACEHOLDER') ||
        msg.includes('invalid JSON');
      console.error('[IDEATE_GENERATE] failed:', msg);
      return NextResponse.json(
        {
          error: isPromptIssue
            ? 'Los prompts del sistema interno de ideación aún no están configurados o están devolviendo formato inválido. Edítalos en /admin → Prompts IA → Static Ads · Ideación.'
            : msg,
        },
        { status: 500 }
      );
    }

    // Refetch the freshly-inserted concepts grouped, so the UI can re-render
    // immediately without a separate fetch round-trip.
    const { data: concepts } = await supabaseAdmin
      .from('ad_concepts')
      .select('*')
      .eq('product_id', productId)
      .order('created_at', { ascending: false });

    const grouped = {
      unaware: (concepts || []).filter((c) => c.awareness_level === 'unaware'),
      problem_aware: (concepts || []).filter((c) => c.awareness_level === 'problem_aware'),
      solution_aware: (concepts || []).filter((c) => c.awareness_level === 'solution_aware'),
    };

    return NextResponse.json({
      success: true,
      inserted: result.inserted,
      promptFailures: result.failed,
      concepts: grouped,
      total: concepts?.length || 0,
    });
  } catch (error: any) {
    console.error('[IDEATE_GENERATE]', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate ideas' },
      { status: 500 }
    );
  }
}
