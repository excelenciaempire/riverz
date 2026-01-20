import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@/lib/supabase/server';
import { createKieTask, getKieTaskResult, getKieModelConfig, analyzeWithGemini3Pro, GeminiMessage, NanoBananaInput } from '@/lib/kie-client';
import { getPromptText } from '@/lib/get-ai-prompt';

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

    // Process max 3 'pending_analysis' items per request to keep it within timeout
    const pendingAnalysis = generations.filter((g: any) => g.status === 'pending_analysis').slice(0, 3);
    const generating = generations.filter((g: any) => g.status === 'generating');

    // Process Analysis (Gemini 3 Pro) - Generate optimized prompts
    for (const gen of pendingAnalysis) {
        try {
            const { productId, productName, productImage, productBenefits, templateName, templateThumbnail, researchData } = gen.input_data;

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

            const messages: GeminiMessage[] = [
                {
                    role: 'developer',
                    content: systemPrompt
                },
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: userContent },
                        // Include product image for visual reference
                        ...(productImage ? [{ type: 'image_url', image_url: { url: productImage } } as const] : []),
                        // Include template image for style reference
                        ...(templateThumbnail ? [{ type: 'image_url', image_url: { url: templateThumbnail } } as const] : []),
                    ]
                }
            ];

            // Generate the optimized prompt using Gemini 3 Pro
            const generatedPrompt = await analyzeWithGemini3Pro(messages);
            
            // Build Nano Banana Pro input with image references
            const nanoBananaInput: NanoBananaInput = {
                prompt: generatedPrompt,
                // Include both product and template images for image-to-image generation
                image_input: [
                    ...(productImage ? [productImage] : []),
                    ...(templateThumbnail ? [templateThumbnail] : [])
                ].filter(Boolean),
                aspect_ratio: '4:5', // Good for social media static ads
                resolution: '2K',
                output_format: 'png'
            };

            // Start Generation Task with Nano Banana Pro
            const genTaskId = await createKieTask(generationModel, nanoBananaInput);

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

    return NextResponse.json({ 
        success: true, 
        processedAnalysis: pendingAnalysis.length,
        processedPolling: generating.length,
        remainingPending: generations.length - pendingAnalysis.length - generating.length
    });

  } catch (error) {
    console.error('Error processing queue:', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
