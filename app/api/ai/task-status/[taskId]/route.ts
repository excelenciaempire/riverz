import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const KIE_API_KEY = '174d2ff19987520a25ecd1ed9c3ccc2b';
const KIE_API_URL = 'https://api.kie.ai/api/v1/jobs/getTaskDetail';

export async function GET(req: Request, { params }: { params: { taskId: string } }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { taskId } = await params;

    const response = await fetch(`${KIE_API_URL}?taskId=${taskId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${KIE_API_KEY}`,
      },
    });

    if (!response.ok) {
        // Try fallback endpoint if getTaskDetail doesn't work as expected or requires POST
        console.warn('Failed to get task detail, check endpoint', response.status);
        return new NextResponse('Failed to fetch task status', { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Error fetching task status:', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
