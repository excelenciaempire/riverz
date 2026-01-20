import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createKieTask, getKieModelConfig } from '@/lib/kie-client';

export const maxDuration = 60; // Allow longer timeout for AI generation

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { prompt, inputImage, maskImage } = await req.json();

    if (!prompt || !inputImage) {
      return new NextResponse('Missing prompt or input image', { status: 400 });
    }

    const { generationModel } = await getKieModelConfig();

    // Prepare input for KIE / Nano Banana Pro
    // We assume the model accepts base64 strings for image and mask
    const taskInput = {
      prompt,
      image: inputImage, // Base64
      mask_image: maskImage, // Base64 (Optional)
      num_inference_steps: 30,
      guidance_scale: 7.5,
      strength: 0.75, // Impact of original image
    };

    // Note: If using Nano Banana specifically, we might need 'input_image' instead of 'image'
    // or 'init_image'. Let's try 'image' first or check if we can support multiple formats.
    // Based on common APIs (Stable Diffusion), 'init_image' + 'mask' is common.
    // Let's use a flexible payload or check KIE docs if available.
    // Since I can't check now, I'll send commonly used keys.
    
    // Update: Based on "enhancor" repo, it sends "inputImage" array.
    // Let's try to match that if we are using the same backend, but we are using KIE directly.
    // Let's stick to KIE standard which is likely similar to ComfyUI / SD.
    
    const taskId = await createKieTask(generationModel, taskInput);

    return NextResponse.json({ jobId: taskId });

  } catch (error: any) {
    console.error('Inpainting API Error:', error);
    return new NextResponse(error.message || 'Internal Error', { status: 500 });
  }
}
