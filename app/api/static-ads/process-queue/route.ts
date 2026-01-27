import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@/lib/supabase/server';
import { createKieTask, getKieTaskResult, getKieModelConfig, analyzeWithGemini3Pro, GeminiMessage, NanoBananaInput } from '@/lib/kie-client';
import { getPromptText } from '@/lib/get-ai-prompt';
import { withRateLimit, getRecommendedBatchSize, checkRateLimit } from '@/lib/rate-limiter';

export const maxDuration = 60; // Allow longer processing time

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return new NextResponse('Unauthorized', { status: 401 });

    const { projectId } = await req.json();
    if (!projectId) return new NextResponse('Missing projectId', { status: 400 });

    const supabase = await createClient();

    // Fetch generations that need processing
    // 1. pending_analysis: Needs Gemini 3 Pro to generate prompt
    // 2. generating: Needs Nano Banana polling
    const { data: generations, error: genError } = await supabase
      .from('generations')
      .select('*')
      .eq('project_id', projectId)
      .in('status', ['pending_analysis', 'generating']);

    if (genError) throw genError;

    const { generationModel } = await getKieModelConfig();
    const updates = [];

    // Check rate limit and adjust batch size dynamically
    const recommendedBatch = Math.min(getRecommendedBatchSize(), 5); // Max 5 per request for stability
    
    // Process 'pending_analysis' items based on rate limit
    const pendingAnalysis = generations.filter((g: any) => g.status === 'pending_analysis').slice(0, recommendedBatch || 2);
    const generating = generations.filter((g: any) => g.status === 'generating');

    // Process Analysis (Gemini 3 Pro) - Generate optimized prompts
    for (const gen of pendingAnalysis) {
        try {
            const { 
              productId, 
              productName, 
              productImage, 
              productImages, // Array of all product images
              productBenefits, 
              templateName, 
              templateThumbnail, 
              researchData 
            } = gen.input_data;
            
            // Use all product images, fallback to single image for backwards compat
            const allProductImages: string[] = productImages || (productImage ? [productImage] : []);

            // Determine which prompt to use based on whether we have research data
            let systemPrompt: string;
            let userContent: string;

            if (researchData && Object.keys(researchData).length > 0) {
                // Use the enhanced prompt with research data
                systemPrompt = await getPromptText('static_ads_clone_with_research');
                
                // Replace variables in the prompt
                systemPrompt = systemPrompt
                    .replace('{RESEARCH_DATA}', JSON.stringify(researchData, null, 2))
                    .replace('{PRODUCT_NAME}', productName || '')
                    .replace('{PRODUCT_BENEFITS}', productBenefits || '')
                    .replace('{TEMPLATE_NAME}', templateName || '');

                userContent = `Genera el prompt de imagen para Nano Banana Pro. 
Producto: ${productName}
Template de referencia: ${templateName}
Usa el research para crear un ad que conecte emocionalmente.`;

            } else {
                // Fallback to basic prompt without research
                systemPrompt = await getPromptText('static_ads_clone');
                userContent = `Product: ${productName}\nTemplate Style: ${templateName}`;
            }

            // Build image content for Gemini (include multiple product images for better context)
            const imageContent: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> = [
                { type: 'text', text: userContent },
            ];
            
            // Add product images (max 4 for Gemini analysis to keep context manageable)
            const productImagesForAnalysis = allProductImages.slice(0, 4);
            for (const imgUrl of productImagesForAnalysis) {
                if (imgUrl) {
                    imageContent.push({ type: 'image_url', image_url: { url: imgUrl } });
                }
            }
            
            // Add template image for style reference
            if (templateThumbnail) {
                imageContent.push({ type: 'image_url', image_url: { url: templateThumbnail } });
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

            // Generate the optimized prompt using Gemini 3 Pro (with rate limiting)
            const generatedPrompt = await withRateLimit(
                () => analyzeWithGemini3Pro(messages),
                3 // Max 3 retries
            );
            
            // Build Nano Banana Pro input with image references
            // IMPORTANT: Nano Banana Pro supports MAX 8 images per request
            // Priority: 1. Template (style reference), 2. Product images (content reference)
            const imageInputs: string[] = [];
            
            // Add template first (most important for style)
            if (templateThumbnail) {
                imageInputs.push(templateThumbnail);
            }
            
            // Add product images (up to remaining slots, max 7 product images)
            const maxProductImages = 8 - imageInputs.length;
            for (const imgUrl of allProductImages.slice(0, maxProductImages)) {
                if (imgUrl && imageInputs.length < 8) {
                    imageInputs.push(imgUrl);
                }
            }
            
            const nanoBananaInput: NanoBananaInput = {
                prompt: generatedPrompt,
                // Include template + product images for image-to-image generation (max 8)
                image_input: imageInputs.filter(Boolean),
                aspect_ratio: '4:5', // Good for social media static ads
                resolution: '2K',
                output_format: 'png'
            };
            
            console.log(`[STATIC_ADS] Processing template ${templateName} with ${imageInputs.length} reference images`);

            // Start Generation Task with Nano Banana Pro (with rate limiting)
            const genTaskId = await withRateLimit(
                () => createKieTask(generationModel, nanoBananaInput),
                3 // Max 3 retries
            );

            updates.push(
                supabase.from('generations').update({
                    status: 'generating',
                    input_data: { 
                        ...gen.input_data, 
                        generatedPrompt, 
                        generationTaskId: genTaskId,
                        usedResearch: !!researchData
                    }
                }).eq('id', gen.id)
            );

        } catch (error: any) {
            console.error('Analysis failed for gen', gen.id, error);
            updates.push(supabase.from('generations').update({ 
                status: 'failed', 
                error_message: `Analysis failed: ${error.message}` 
            }).eq('id', gen.id));
        }
    }

    // Process Generating (Poll Nano Banana Pro for results)
    for (const gen of generating) {
        const taskId = gen.input_data.generationTaskId;
        if (!taskId) continue;

        try {
            const taskResult = await getKieTaskResult(taskId);

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
                    updates.push(
                        supabase.from('generations').update({
                            status: 'completed',
                            result_url: resultUrl
                        }).eq('id', gen.id)
                    );
                } else {
                    console.error('No URL found in result:', taskResult.result);
                    updates.push(supabase.from('generations').update({ 
                        status: 'failed', 
                        error_message: 'No result URL found' 
                    }).eq('id', gen.id));
                }
            } else if (taskResult.status === 'FAILED') {
                updates.push(supabase.from('generations').update({ 
                    status: 'failed', 
                    error_message: taskResult.error || 'Generation failed' 
                }).eq('id', gen.id));
            }
            // PENDING and PROCESSING statuses mean we just wait for next poll
        } catch (error: any) {
            console.error('Polling failed for gen', gen.id, error);
        }
    }

    await Promise.all(updates);

    // Count total statuses for better progress reporting
    const { data: allGens } = await supabase
      .from('generations')
      .select('status')
      .eq('project_id', projectId);

    const statusCounts = {
      pending_analysis: 0,
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
    const inProgress = statusCounts.pending_analysis + statusCounts.generating;
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Check rate limit status
    const rateLimitStatus = checkRateLimit();

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
        },
        rateLimit: {
          canProceed: rateLimitStatus.canProceed,
          waitMs: rateLimitStatus.waitMs
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
