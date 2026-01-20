import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { estimateBulkTime } from '@/lib/rate-limiter';

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return new NextResponse('Unauthorized', { status: 401 });

    const { templateCount } = await req.json();

    if (!templateCount || templateCount < 1) {
      return NextResponse.json({ error: 'Invalid template count' }, { status: 400 });
    }

    const estimate = estimateBulkTime(templateCount);
    const COST_PER_AD = 50;

    return NextResponse.json({
      templateCount,
      totalCredits: templateCount * COST_PER_AD,
      estimatedMinutes: estimate.estimatedMinutes,
      batches: estimate.batches,
      // Add user-friendly messages
      message: templateCount <= 10 
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
