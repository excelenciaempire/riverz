import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

export const runtime = 'nodejs';
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

const KIE_API_KEY = process.env.KIE_API_KEY!;
const KIE_BASE = 'https://api.kie.ai';

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { prompt, aspect_ratio, resolution } = await req.json();

    const response = await fetch(`${KIE_BASE}/api/v1/jobs/createTask`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${KIE_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'nano-banana-pro',
        input: {
          prompt,
          aspect_ratio: aspect_ratio || '1:1',
          resolution: resolution || '2K',
          output_format: 'jpg',
          negative_prompt: 'low quality, blurry, distorted, watermark, text overlay, logo',
        },
      }),
    });

    const data = await response.json();

    if (data.code !== 200) {
      return NextResponse.json({ error: data.msg || 'Failed to create task' }, { status: 400 });
    }

    const taskId = data.data?.taskId ?? data.data?.task_id ?? data.data?.id ?? '';
    return NextResponse.json({ taskId });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 });
  }
}
