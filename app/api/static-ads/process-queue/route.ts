import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@/lib/supabase/server';
import { createKieTask, getKieTaskResult, getKieModelConfig, analyzeWithGemini3Pro, GeminiMessage } from '@/lib/kie-client';
import { getPromptText } from '@/lib/get-ai-prompt';

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return new NextResponse('Unauthorized', { status: 401 });

    const { projectId } = await req.json();
    if (!projectId) return new NextResponse('Missing projectId', { status: 400 });

    const supabase = await createClient();

    // Fetch generations that need processing
    // 1. pending_analysis: Needs Gemini 3 Pro
    // 2. generating: Needs Nano Banana polling
    const { data: generations, error: genError } = await supabase
      .from('generations')
      .select('*')
      .eq('project_id', projectId)
      .in('status', ['pending_analysis', 'generating']);

    if (genError) throw genError;

    const { generationModel } = await getKieModelConfig();
    const updates = [];

    // Limit concurrency to avoid timeouts? 
    // Vercel might handle parallel fetch well, but let's be safe.
    // For 'pending_analysis', calls are synchronous (Gemini), so they take time.
    // If we have 50 items, 50 * 5s = 250s. Too long.
    // We should process a chunk, e.g., 5 items.
    // BUT the frontend polls every 3s. So we can process 3-5 items per poll.
    // We sort by 'updated_at' implicitly? Or random?
    // Let's process max 3 'pending_analysis' items per request to keep it snappy.
    
    const pendingAnalysis = generations.filter((g: any) => g.status === 'pending_analysis').slice(0, 3);
    const generating = generations.filter((g: any) => g.status === 'generating');

    // Process Analysis (Gemini 3 Pro)
    for (const gen of pendingAnalysis) {
        try {
            const { productName, productImage, templateName, templateThumbnail } = gen.input_data;

            // Get dynamic prompt from database
            const systemPrompt = await getPromptText('static_ads_clone');

            const messages: GeminiMessage[] = [
                {
                    role: 'system',
                    content: systemPrompt
                },
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: `Product: ${productName}` },
                        ...(productImage ? [{ type: 'image_url', image_url: { url: productImage } } as const] : []),
                        { type: 'text', text: `Template Style: ${templateName}` },
                        ...(templateThumbnail ? [{ type: 'image_url', image_url: { url: templateThumbnail } } as const] : []),
                    ]
                }
            ];

            const prompt = await analyzeWithGemini3Pro(messages);
            
            // Start Generation Task immediately
            const genTaskId = await createKieTask(generationModel, { prompt });

            updates.push(
                supabase.from('generations').update({
                    status: 'generating', // Skip 'analyzing' intermediate state since we do it sync
                    input_data: { ...gen.input_data, generatedPrompt: prompt, generationTaskId: genTaskId }
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

    // Process Generating (Poll Nano Banana)
    for (const gen of generating) {
        const taskId = gen.input_data.generationTaskId;
        if (!taskId) continue;

        try {
            const taskResult = await getKieTaskResult(taskId);

            if (taskResult.status === 'SUCCESS') {
                const resultUrl = taskResult.result?.url || taskResult.result?.[0] || '';
                
                if (resultUrl) {
                    updates.push(
                        supabase.from('generations').update({
                            status: 'completed',
                            result_url: resultUrl
                        }).eq('id', gen.id)
                    );
                } else {
                     updates.push(supabase.from('generations').update({ status: 'failed', error_message: 'No URL' }).eq('id', gen.id));
                }
            } else if (taskResult.status === 'FAILED') {
                 updates.push(supabase.from('generations').update({ status: 'failed', error_message: 'Gen failed' }).eq('id', gen.id));
            }
        } catch (error) {
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
