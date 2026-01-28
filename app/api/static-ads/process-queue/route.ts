import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { createKieTask, getKieTaskResult, getKieModelConfig, analyzeWithGemini3Pro, GeminiMessage, NanoBananaInput, imageUrlToBase64, convertImagesToBase64 } from '@/lib/kie-client';
import { getPromptText } from '@/lib/get-ai-prompt';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return new NextResponse('Unauthorized', { status: 401 });

    const { projectId } = await req.json();
    if (!projectId) return new NextResponse('Missing projectId', { status: 400 });

    // Fetch generations that need processing
    // Status flow: pending_analysis -> analyzing -> generating -> completed/failed
    const { data: generations, error: genError } = await supabaseAdmin
      .from('generations')
      .select('*')
      .eq('project_id', projectId)
      .in('status', ['pending_analysis', 'generating']);

    if (genError) throw genError;

    const { generationModel } = await getKieModelConfig();

    // IMPORTANT: Only process ONE item at a time to avoid duplicate API calls
    // The polling will handle processing additional items
    const pendingAnalysis = generations.filter((g: any) => g.status === 'pending_analysis').slice(0, 1);
    const generating = generations.filter((g: any) => g.status === 'generating');

    // Process Analysis (Gemini 3 Pro) - Generate optimized prompts
    // Process ONE at a time to avoid duplicate requests
    for (const gen of pendingAnalysis) {
        try {
            // STEP 1: LOCK - Mark as "analyzing" BEFORE processing to prevent duplicates
            const { error: lockError } = await supabaseAdmin
                .from('generations')
                .update({ status: 'analyzing' })
                .eq('id', gen.id)
                .eq('status', 'pending_analysis'); // Only update if still pending
            
            if (lockError) {
                console.log(`[STATIC_ADS] Could not lock generation ${gen.id}, skipping (likely already processing)`);
                continue; // Another process grabbed it
            }

            const { 
              productId, 
              productName, 
              productImage, 
              productImages,
              productBenefits, 
              templateName, 
              templateThumbnail, 
              researchData 
            } = gen.input_data;
            
            // Use all product images, fallback to single image
            const allProductImages: string[] = productImages || (productImage ? [productImage] : []);

            console.log(`[STATIC_ADS] Analyzing template "${templateName}" for product "${productName}"`);
            console.log(`[STATIC_ADS] Product images: ${allProductImages.length}, Template: ${templateThumbnail ? 'yes' : 'no'}`);

            // STEP 2: Get the system prompt from database (admin dashboard)
            let systemPrompt = await getPromptText('static_ads_clone');
            
            // Inject product variables into the prompt
            systemPrompt = systemPrompt
                .replace(/\{PRODUCT_NAME\}/g, productName || 'Product')
                .replace(/\{PRODUCT_BENEFITS\}/g, productBenefits || 'Premium quality product')
                .replace(/\{TEMPLATE_NAME\}/g, templateName || 'Template')
                .replace(/\{RESEARCH_DATA\}/g, researchData ? JSON.stringify(researchData, null, 2) : 'No research available');

            // Build user message with complete product information
            const userMessage = `
INFORMACIÓN DEL PRODUCTO:
- Nombre: ${productName}
- Beneficios: ${productBenefits || 'Producto de alta calidad'}

TEMPLATE DE REFERENCIA: ${templateName}

IMÁGENES ADJUNTAS:
- Las primeras ${Math.min(allProductImages.length, 4)} imágenes son del PRODUCTO
- La última imagen es el TEMPLATE de referencia (el estilo a replicar)

Tu tarea: Analiza visualmente las imágenes del producto y el template. Genera un prompt detallado para Nano Banana Pro que:
1. Replique el ESTILO, composición, colores e iluminación del template
2. Coloque el PRODUCTO exacto de las imágenes del producto en la escena
3. Sea adecuado para publicidad en redes sociales

Genera SOLO el prompt, sin explicaciones adicionales. El prompt debe estar en inglés para mejores resultados.
`;

            // Convert images to base64 for Gemini
            console.log(`[STATIC_ADS] Converting images to base64 for Gemini...`);
            
            // Build image content array for Gemini
            const imageContent: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> = [
                { type: 'text', text: userMessage },
            ];
            
            // Add product images as base64 (max 4 for Gemini analysis)
            for (const imgUrl of allProductImages.slice(0, 4)) {
                if (imgUrl && imgUrl.startsWith('http')) {
                    try {
                        const base64Image = await imageUrlToBase64(imgUrl);
                        imageContent.push({ type: 'image_url', image_url: { url: base64Image } });
                        console.log(`[STATIC_ADS] Added product image as base64`);
                    } catch (e) {
                        console.error(`[STATIC_ADS] Failed to convert product image: ${imgUrl}`);
                    }
                }
            }
            
            // Add template image as base64 for style reference
            if (templateThumbnail && templateThumbnail.startsWith('http')) {
                try {
                    const base64Template = await imageUrlToBase64(templateThumbnail);
                    imageContent.push({ type: 'image_url', image_url: { url: base64Template } });
                    console.log(`[STATIC_ADS] Added template image as base64`);
                } catch (e) {
                    console.error(`[STATIC_ADS] Failed to convert template image: ${templateThumbnail}`);
                }
            }
            
            const messages: GeminiMessage[] = [
                {
                    role: 'developer',
                    content: systemPrompt
                },
                {
                    role: 'user',
                    content: imageContent
                }
            ];
            
            console.log(`[STATIC_ADS] Sending to Gemini with ${imageContent.length - 1} images (base64)`);

            // STEP 3: Call Gemini to generate the optimized prompt
            const generatedPrompt = await analyzeWithGemini3Pro(messages);
            
            console.log(`[STATIC_ADS] Gemini generated prompt for "${templateName}":`, generatedPrompt.substring(0, 200) + '...');

            // STEP 4: Build Nano Banana Pro input with base64 images
            // Max 8 images: Template (1) + Product images (up to 7)
            console.log(`[STATIC_ADS] Converting images to base64 for Nano Banana Pro...`);
            
            const imagesToConvert: string[] = [];
            
            // Add template first (style reference - most important)
            if (templateThumbnail && templateThumbnail.startsWith('http')) {
                imagesToConvert.push(templateThumbnail);
            }
            
            // Add product images (content reference)
            for (const imgUrl of allProductImages.slice(0, 7)) {
                if (imgUrl && imgUrl.startsWith('http') && imagesToConvert.length < 8) {
                    imagesToConvert.push(imgUrl);
                }
            }
            
            // Convert all images to base64
            const imageInputsBase64 = await convertImagesToBase64(imagesToConvert);
            
            const nanoBananaInput: NanoBananaInput = {
                prompt: generatedPrompt,
                image_input: imageInputsBase64,
                aspect_ratio: '4:5', // Good for social media ads
                resolution: '2K',
                output_format: 'png'
            };
            
            console.log(`[STATIC_ADS] Sending to Nano Banana Pro with ${imageInputsBase64.length} base64 images`);

            // STEP 5: Start Generation Task with Nano Banana Pro
            const genTaskId = await createKieTask(generationModel, nanoBananaInput);

            // STEP 6: Update status to 'generating' with task ID
            await supabaseAdmin.from('generations').update({
                status: 'generating',
                input_data: { 
                    ...gen.input_data, 
                    generatedPrompt, 
                    generationTaskId: genTaskId,
                    processedAt: new Date().toISOString()
                }
            }).eq('id', gen.id);

            console.log(`[STATIC_ADS] Started generation task ${genTaskId} for template "${templateName}"`);

        } catch (error: any) {
            console.error('[STATIC_ADS] Analysis failed for gen', gen.id, error);
            await supabaseAdmin.from('generations').update({ 
                status: 'failed', 
                error_message: `Analysis failed: ${error.message}` 
            }).eq('id', gen.id);
        }
    }

    // Process Generating (Poll Nano Banana Pro for results)
    // Check up to 5 generating tasks per poll
    for (const gen of generating.slice(0, 5)) {
        const taskId = gen.input_data?.generationTaskId;
        if (!taskId) continue;

        try {
            const taskResult = await getKieTaskResult(taskId);
            console.log(`[STATIC_ADS] Task ${taskId} status: ${taskResult.status}`);

            if (taskResult.status === 'SUCCESS') {
                // Extract result URL - handle different response formats
                let resultUrl = '';
                if (taskResult.result) {
                    if (typeof taskResult.result === 'string') {
                        resultUrl = taskResult.result;
                    } else if (Array.isArray(taskResult.result)) {
                        resultUrl = taskResult.result[0];
                    } else if (taskResult.result.url) {
                        resultUrl = taskResult.result.url;
                    } else if (taskResult.result.output) {
                        resultUrl = Array.isArray(taskResult.result.output) 
                            ? taskResult.result.output[0] 
                            : taskResult.result.output;
                    }
                }
                
                if (resultUrl) {
                    await supabaseAdmin.from('generations').update({
                        status: 'completed',
                        result_url: resultUrl
                    }).eq('id', gen.id);
                    console.log(`[STATIC_ADS] Generation ${gen.id} completed with result: ${resultUrl.substring(0, 50)}...`);
                } else {
                    console.error('[STATIC_ADS] No URL found in result:', taskResult.result);
                    await supabaseAdmin.from('generations').update({ 
                        status: 'failed', 
                        error_message: 'No result URL found in response' 
                    }).eq('id', gen.id);
                }
            } else if (taskResult.status === 'FAILED') {
                await supabaseAdmin.from('generations').update({ 
                    status: 'failed', 
                    error_message: taskResult.error || 'Generation failed at KIE.ai' 
                }).eq('id', gen.id);
            }
            // PENDING and PROCESSING statuses mean we just wait for next poll
        } catch (error: any) {
            console.error('[STATIC_ADS] Polling failed for gen', gen.id, error);
        }
    }

    // Count total statuses for progress reporting
    const { data: allGens } = await supabaseAdmin
      .from('generations')
      .select('status')
      .eq('project_id', projectId);

    const statusCounts = {
      pending_analysis: 0,
      analyzing: 0,
      generating: 0,
      completed: 0,
      failed: 0,
    };

    allGens?.forEach((g: any) => {
      if (statusCounts.hasOwnProperty(g.status)) {
        statusCounts[g.status as keyof typeof statusCounts]++;
      }
    });

    const total = allGens?.length || 0;
    const completed = statusCounts.completed;
    const failed = statusCounts.failed;
    const inProgress = statusCounts.pending_analysis + statusCounts.analyzing + statusCounts.generating;
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

    return NextResponse.json({ 
        success: true, 
        processedAnalysis: pendingAnalysis.length,
        processedPolling: generating.length,
        progress: {
          total,
          completed,
          failed,
          inProgress,
          percentage: progress,
          isComplete: inProgress === 0 && total > 0
        }
    });

  } catch (error: any) {
    console.error('Error processing queue:', error);
    
    // Check if it's a rate limit error
    if (error.message?.includes('429')) {
      return NextResponse.json({ 
        success: false, 
        error: 'Rate limited',
        retryAfter: 10000 // 10 seconds
      }, { status: 429 });
    }
    
    return new NextResponse('Internal Error', { status: 500 });
  }
}
