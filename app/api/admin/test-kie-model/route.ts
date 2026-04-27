import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createKieTask, analyzeWithModel, GeminiMessage } from '@/lib/kie-client';

/**
 * Verifies a kie.ai model from the admin panel.
 *
 * Body: { model: string, type: 'analysis' | 'generation' | 'vision' }
 *  - 'analysis'  → sends a tiny text prompt through analyzeWithModel
 *  - 'vision'    → sends a tiny prompt + a public test image to verify multimodal works
 *  - 'generation'→ creates a tiny Nano Banana task; if a taskId is returned the model is valid
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return new NextResponse('Unauthorized', { status: 401 });

    const { model, type } = await req.json();
    if (!model) return new NextResponse('Missing model', { status: 400 });

    if (type === 'analysis' || type === 'vision') {
      const useVision = type === 'vision';
      const messages: GeminiMessage[] = [
        { role: 'developer', content: 'You are a connection-test assistant. Reply with the single word OK.' },
        useVision
          ? {
              role: 'user',
              content: [
                { type: 'text', text: 'Confirm you can see the image and reply OK.' },
                { type: 'image_url', image_url: { url: 'https://placehold.co/64x64.png' } },
              ],
            }
          : { role: 'user', content: 'Reply with OK.' },
      ];

      try {
        const text = await analyzeWithModel(model, messages, { temperature: 0, maxTokens: 50 });
        return NextResponse.json({
          success: true,
          model,
          type,
          sample: text.slice(0, 200),
        });
      } catch (error: any) {
        return NextResponse.json({ success: false, model, type, error: error.message });
      }
    }

    // type === 'generation' — Nano Banana / image model
    try {
      const taskId = await createKieTask(model, {
        prompt: 'A small test photograph of a single red apple on a white background.',
        aspect_ratio: '1:1',
        resolution: '1K',
        output_format: 'png',
      });
      return NextResponse.json({ success: true, model, type, taskId });
    } catch (error: any) {
      return NextResponse.json({ success: false, model, type, error: error.message });
    }
  } catch (error: any) {
    console.error('[TEST-KIE-MODEL] Error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal error' }, { status: 500 });
  }
}
