import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
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
 * List ad concepts for a product. **Read-only** — never generates new ones.
 * The user explicitly triggers a fresh batch via /api/static-ads/ideate/generate.
 *
 * The Ideación tab calls this on mount to populate cards. If there are zero
 * concepts the UI shows the empty state with a "Generar ideas" CTA.
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { productId } = await req.json();
    if (!productId) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
    }

    // Authorize: product must belong to this user.
    const { data: product, error: productError } = await supabaseAdmin
      .from('products')
      .select('id')
      .eq('id', productId)
      .eq('clerk_user_id', userId)
      .single();
    if (productError || !product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const { data: existingConcepts } = await supabaseAdmin
      .from('ad_concepts')
      .select('*')
      .eq('product_id', productId)
      .order('created_at', { ascending: false });

    const concepts = existingConcepts || [];
    const grouped = {
      unaware: concepts.filter((c) => c.awareness_level === 'unaware'),
      problem_aware: concepts.filter((c) => c.awareness_level === 'problem_aware'),
      solution_aware: concepts.filter((c) => c.awareness_level === 'solution_aware'),
    };

    return NextResponse.json({
      success: true,
      concepts: grouped,
      total: concepts.length,
      cached: true,
    });
  } catch (error: any) {
    console.error('[IDEATE]', error);
    return NextResponse.json(
      { error: error.message || 'Failed to list ad concepts' },
      { status: 500 }
    );
  }
}
