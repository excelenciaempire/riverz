import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { estimateBulkTime } from '@/lib/rate-limiter';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return new NextResponse('Unauthorized', { status: 401 });

    const { templateCount } = await req.json();

    if (!templateCount || templateCount < 1) {
      return NextResponse.json({ error: 'Invalid template count' }, { status: 400 });
    }

    // Pricing: 14 credits per Nano Banana image × 5 variations per template.
    const COST_PER_IMAGE = 14;
    const VARIATIONS_PER_TEMPLATE = 5;
    const totalImages = templateCount * VARIATIONS_PER_TEMPLATE;
    const totalCredits = totalImages * COST_PER_IMAGE;

    // Use the existing rate-limiter estimate as a baseline but scale up for 5x images.
    const baseline = estimateBulkTime(totalImages);
    const estimatedMinutes = baseline.estimatedMinutes;
    const batches = baseline.batches;

    const { data: userData } = await supabaseAdmin
      .from('user_credits')
      .select('credits')
      .eq('clerk_user_id', userId)
      .single();

    const currentBalance = userData?.credits || 0;
    const hasEnough = currentBalance >= totalCredits;

    return NextResponse.json({
      templateCount,
      variationsPerTemplate: VARIATIONS_PER_TEMPLATE,
      totalImages,
      totalCredits,
      costPerImage: COST_PER_IMAGE,
      costPerTemplate: COST_PER_IMAGE * VARIATIONS_PER_TEMPLATE,
      currentBalance,
      hasEnough,
      estimatedMinutes,
      batches,
      message: !hasEnough
        ? `Créditos insuficientes (tienes ${currentBalance}, necesitas ${totalCredits} para ${totalImages} imágenes)`
        : totalImages <= 25
          ? `Generación rápida — ${totalImages} imágenes (~${estimatedMinutes} min)`
          : totalImages <= 100
            ? `Generación en lotes — ${totalImages} imágenes (~${estimatedMinutes} min)`
            : `Generación masiva — ${totalImages} imágenes (~${estimatedMinutes} min). Puedes cerrar y volver después.`,
    });

  } catch (error) {
    console.error('Error estimating:', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
