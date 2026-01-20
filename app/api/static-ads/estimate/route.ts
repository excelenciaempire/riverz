import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { estimateBulkTime } from '@/lib/rate-limiter';

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

    const estimate = estimateBulkTime(templateCount);
    const COST_PER_AD = 50; // Internal Riverz credits
    const totalCredits = templateCount * COST_PER_AD;
    
    // Get user's current balance
    const { data: userData } = await supabaseAdmin
      .from('user_credits')
      .select('credits')
      .eq('clerk_user_id', userId)
      .single();

    const currentBalance = userData?.credits || 0;
    const hasEnough = currentBalance >= totalCredits;

    return NextResponse.json({
      templateCount,
      totalCredits,
      currentBalance,
      hasEnough,
      estimatedMinutes: estimate.estimatedMinutes,
      batches: estimate.batches,
      message: !hasEnough 
        ? `Créditos insuficientes (tienes ${currentBalance}, necesitas ${totalCredits})`
        : templateCount <= 10 
          ? 'Generación rápida (~1-2 min)'
          : templateCount <= 50
            ? `Generación en lotes (~${estimate.estimatedMinutes} min)`
            : `Generación masiva (~${estimate.estimatedMinutes} min). Puedes cerrar y volver después.`
    });

  } catch (error) {
    console.error('Error estimating:', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
