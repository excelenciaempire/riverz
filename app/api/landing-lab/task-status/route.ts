import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

export const runtime = 'nodejs';
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

const KIE_API_KEY = process.env.KIE_API_KEY!;
const KIE_BASE = 'https://api.kie.ai';

function mapStatus(code: number): string {
  switch (code) {
    case 0: return 'PENDING';
    case 1: return 'PROCESSING';
    case 2: return 'SUCCESS';
    case 3: return 'FAILED';
    case 4: return 'FAILED';
    default: return 'PENDING';
  }
}

function extractImageUrl(result: any): string | null {
  if (!result) return null;
  // Try direct string
  if (typeof result === 'string') return result;
  // Try array
  if (Array.isArray(result) && result.length > 0) {
    const first = result[0];
    if (typeof first === 'string') return first;
    if (first?.url) return first.url;
    if (first?.output) return first.output;
  }
  // Try object properties
  if (result.url) return result.url;
  if (result.output) return result.output;
  return null;
}

export async function GET(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const taskId = searchParams.get('taskId');

    if (!taskId) {
      return NextResponse.json({ error: 'Missing taskId' }, { status: 400 });
    }

    const response = await fetch(
      `${KIE_BASE}/api/v1/jobs/getTaskDetail?taskId=${taskId}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${KIE_API_KEY}`,
        },
      }
    );

    const data = await response.json();

    const taskData = data.data ?? data;
    const statusCode = taskData?.status ?? taskData?.taskStatus ?? 0;
    const status = mapStatus(Number(statusCode));
    const imageUrl = extractImageUrl(taskData?.result ?? taskData?.output ?? taskData?.images);

    return NextResponse.json({ status, imageUrl });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 });
  }
}
