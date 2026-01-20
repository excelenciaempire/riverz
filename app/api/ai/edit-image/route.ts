import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const KIE_API_KEY = '174d2ff19987520a25ecd1ed9c3ccc2b';
const KIE_API_URL = 'https://api.kie.ai/api/v1/jobs/createTask';

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { prompt, imageUrl, generationId } = await req.json();

    if (!prompt || !imageUrl) {
      return new NextResponse('Missing prompt or imageUrl', { status: 400 });
    }

    // Call KIE API
    const response = await fetch(KIE_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${KIE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'nano-banana-pro',
        input: {
          prompt: prompt,
          image_input: [imageUrl],
          aspect_ratio: 'auto',
          resolution: '1K',
          output_format: 'png'
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('KIE API Error:', errorText);
      return new NextResponse(`KIE API Error: ${errorText}`, { status: response.status });
    }

    const data = await response.json();

    if (data.code !== 200) {
      return new NextResponse(`KIE Error: ${data.msg}`, { status: 500 });
    }

    return NextResponse.json({ 
      taskId: data.data.taskId,
      generationId // Pass back to help frontend track which item is being edited
    });

  } catch (error) {
    console.error('Error calling AI edit:', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
