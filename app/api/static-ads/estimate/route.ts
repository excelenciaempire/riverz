import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
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

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return new NextResponse('Unauthorized', { status: 401 });

    const { templateCount } = await req.json();

    if (!templateCount || templateCount < 1) {
      return NextResponse.json({ error: 'Invalid template count' }, { status: 400 });
    }

    const estimate = estimateBulkTime(templateCount);
    const COST_PER_AD = 5; // ~5 Kie.ai credits per static ad
    const totalCredits = templateCount * COST_PER_AD;
    
    // Get current balance
    const currentBalance = await getKieBalance();
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
