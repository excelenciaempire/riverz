import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

export const runtime = 'nodejs';
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

const KIE_API_KEY = process.env.KIE_API_KEY!;
const KIE_ENDPOINT = 'https://api.kie.ai/gemini-3-pro/v1/chat/completions';

export async function POST(req: Request) {
  let brief = '';
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { slot, label, brief: briefParam, angle, hero } = await req.json();
    brief = briefParam || '';

    const userMsg =
      `Write a photorealistic image generation prompt (80-120 words) for:\n` +
      `Slot: ${label}\n` +
      `Base: ${brief}\n` +
      `Brand: Vitalu — Colombian skincare, beef tallow, warm dark editorial aesthetic, Vogue-meets-artisan.\n` +
      `Angle: ${angle || 'natural skincare'}\n` +
      `Headline: ${hero || ''}\n` +
      `Rules: ONLY the prompt text. No text/logos in image. Photorealistic. High-end magazine quality. Warm Colombian soul.`;

    const response = await fetch(KIE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${KIE_API_KEY}`,
      },
      body: JSON.stringify({
        max_tokens: 300,
        stream: false,
        messages: [{ role: 'user', content: [{ type: 'text', text: userMsg }] }],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json({
        prompt: `${brief}, photorealistic, editorial magazine quality, warm Colombian light, luxury skincare aesthetic`,
      });
    }

    const prompt = (data.choices?.[0]?.message?.content ?? '').trim();
    return NextResponse.json({ prompt });
  } catch (e: any) {
    return NextResponse.json({
      prompt: `${brief}, photorealistic, editorial magazine quality, warm Colombian light, luxury skincare aesthetic`,
    });
  }
}
