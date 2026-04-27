import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const KIE_API_KEY = process.env.KIE_API_KEY!;
const KIE_API_URL = 'https://api.kie.ai/api/v1/jobs/getTaskDetail';

export async function GET(
  req: Request, 
  { params }: { params: Promise<{ taskId: string }> }
) {
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
      console.warn('Failed to get task detail:', response.status);
      return NextResponse.json({ error: 'Failed to fetch task status' }, { status: response.status });
    }

    const data = await response.json();
    
    // Parse and normalize the response
    let normalizedResponse = {
      code: data.code,
      data: {
        taskId: taskId,
        status: 'PROCESSING',
        result: null as string | null
      }
    };
    
    if (data.data) {
      // Map KIE status codes to our status
      // 0: Queue, 1: Processing, 2: Success, 3: Failed
      const statusMap: Record<number, string> = {
        0: 'PENDING',
        1: 'PROCESSING',
        2: 'SUCCESS',
        3: 'FAILED',
        4: 'FAILED'
      };
      
      normalizedResponse.data.status = statusMap[data.data.status] || 'PROCESSING';
      
      // Extract result URL
      if (data.data.result) {
        if (typeof data.data.result === 'string') {
          normalizedResponse.data.result = data.data.result;
        } else if (Array.isArray(data.data.result)) {
          normalizedResponse.data.result = data.data.result[0];
        } else if (data.data.result.url) {
          normalizedResponse.data.result = data.data.result.url;
        } else if (data.data.result.output) {
          normalizedResponse.data.result = Array.isArray(data.data.result.output)
            ? data.data.result.output[0]
            : data.data.result.output;
        }
      }
    }
    
    return NextResponse.json(normalizedResponse);

  } catch (error: any) {
    console.error('Error fetching task status:', error);
    return NextResponse.json({ error: error.message || 'Internal Error' }, { status: 500 });
  }
}
