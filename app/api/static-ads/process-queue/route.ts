import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { createKieTask, getKieTaskResult, getKieModelConfig, analyzeWithClaudeSonnet, GeminiMessage, NanoBananaInput, imageUrlToBase64 } from '@/lib/kie-client';
import { getPromptText } from '@/lib/get-ai-prompt';

export const runtime = 'nodejs';
export const maxDuration = 55; // Under 60s for Vercel free tier
export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Async Pipeline for Static Ads Generation
 * 
 * Status Flow (each step < 60 seconds):
 * 1. pending_analysis → Lock to 'analyzing' → Process with Claude Sonnet 4.5 (multimodal) → pending_generation
 * 2. pending_generation → Lock to 'generating' → Start Nano Banana task
 * 3. generating → Poll Nano Banana result
 * 4. completed → Done!
 * 
 * Note: Claude Sonnet 4.5 supports image analysis (multimodal), unlike Gemini on Kie.ai
 * Locks prevent duplicate processing when multiple polling requests occur
 */

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return new NextResponse('Unauthorized', { status: 401 });

    const { projectId } = await req.json();
    if (!projectId) return new NextResponse('Missing projectId', { status: 400 });

    // Fetch all generations that need processing
    const { data: generations, error: genError } = await supabaseAdmin
      .from('generations')
      .select('*')
      .eq('project_id', projectId)
      .in('status', ['pending_analysis', 'analyzing', 'pending_generation', 'generating']);

    if (genError) throw genError;

    const { generationModel } = await getKieModelConfig();

    // Process ONE item per status type to keep request fast
    const pendingAnalysis = generations.filter((g: any) => g.status === 'pending_analysis').slice(0, 1);
    const pendingGeneration = generations.filter((g: any) => g.status === 'pending_generation').slice(0, 1);
    const generating = generations.filter((g: any) => g.status === 'generating').slice(0, 3);

    // ============================================
    // STEP 1: Process Claude Sonnet Analysis (Direct/Sync with Images)
    // ============================================
    for (const gen of pendingAnalysis) {
      try {
        // Lock the generation FIRST to prevent duplicate processing
        const { data: lockData, error: lockError } = await supabaseAdmin
          .from('generations')
          .update({ 
            status: 'analyzing',
            updated_at: new Date().toISOString()
          })
          .eq('id', gen.id)
          .eq('status', 'pending_analysis')
          .select()
          .single();

        // If lock failed, skip (another process is handling it)
        if (lockError || !lockData) {
          console.log(`[STEP1] Skipping ${gen.id} - already locked or not found`);
          continue;
        }

        const { productName, productImages, productImage, productBenefits, templateName, templateThumbnail } = gen.input_data;
        const allProductImages: string[] = productImages || (productImage ? [productImage] : []);

        console.log(`[STEP1] Starting Claude Sonnet analysis for "${templateName}" (${gen.id})`);

        // Get system prompt
        let systemPrompt = await getPromptText('static_ads_clone');
        systemPrompt = systemPrompt
          .replace(/\{PRODUCT_NAME\}/g, productName || 'Product')
          .replace(/\{PRODUCT_BENEFITS\}/g, productBenefits || 'Premium quality')
          .replace(/\{TEMPLATE_NAME\}/g, templateName || 'Template');

        // Build user message
        const userMessage = `
PRODUCTO: ${productName}
BENEFICIOS: ${productBenefits || 'Producto de alta calidad'}
TEMPLATE: ${templateName}

Analiza las imágenes del producto y el template. Genera un prompt detallado para Nano Banana Pro.
`;

        // Build content with images as URLs (Claude accepts URLs in OpenAI format)
        const imageContent: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> = [
          { type: 'text', text: userMessage },
        ];

        // Add product images (max 3)
        for (const imgUrl of allProductImages.slice(0, 3)) {
          if (imgUrl?.startsWith('http')) {
            imageContent.push({ type: 'image_url', image_url: { url: imgUrl } });
          }
        }

        // Add template thumbnail
        if (templateThumbnail?.startsWith('http')) {
          imageContent.push({ type: 'image_url', image_url: { url: templateThumbnail } });
        }

        const messages: GeminiMessage[] = [
          { role: 'developer', content: systemPrompt },
          { role: 'user', content: imageContent }
        ];

        // Call Claude Sonnet directly (synchronous, supports multimodal)
        const generatedPrompt = await analyzeWithClaudeSonnet(messages);

        console.log(`[STEP1] Claude Sonnet completed: ${generatedPrompt.substring(0, 100)}...`);

        // Update to pending_generation
        await supabaseAdmin.from('generations').update({
          status: 'pending_generation',
          input_data: { ...gen.input_data, generatedPrompt }
        }).eq('id', gen.id);

      } catch (error: any) {
        console.error('[STEP1] Claude Sonnet Error:', error);
        await supabaseAdmin.from('generations').update({
          status: 'failed',
          error_message: `Claude analysis failed: ${error.message}`
        }).eq('id', gen.id);
      }
    }

    // ============================================
    // STEP 2: Start Nano Banana Generation (async)
    // ============================================
    for (const gen of pendingGeneration) {
      try {
        // Lock
        const { error: lockError } = await supabaseAdmin
          .from('generations')
          .update({ status: 'generating' })
          .eq('id', gen.id)
          .eq('status', 'pending_generation');

        if (lockError) continue;

        const { generatedPrompt, productImages, productImage, templateThumbnail } = gen.input_data;
        const allProductImages: string[] = productImages || (productImage ? [productImage] : []);

        console.log(`[STEP2] Starting Nano Banana with prompt: ${generatedPrompt?.substring(0, 80)}...`);

        // Build image inputs (URLs for Nano Banana)
        const imageInputs: string[] = [];
        if (templateThumbnail?.startsWith('http')) {
          imageInputs.push(templateThumbnail);
        }
        for (const imgUrl of allProductImages.slice(0, 7)) {
          if (imgUrl?.startsWith('http') && imageInputs.length < 8) {
            imageInputs.push(imgUrl);
          }
        }

        const nanoBananaInput: NanoBananaInput = {
          prompt: generatedPrompt,
          image_input: imageInputs,
          aspect_ratio: '4:5',
          resolution: '2K',
          output_format: 'png'
        };

        const generationTaskId = await createKieTask(generationModel, nanoBananaInput);

        await supabaseAdmin.from('generations').update({
          input_data: { ...gen.input_data, generationTaskId }
        }).eq('id', gen.id);

        console.log(`[STEP2] Nano Banana task started: ${generationTaskId}`);

      } catch (error: any) {
        console.error('[STEP2] Error:', error);
        await supabaseAdmin.from('generations').update({
          status: 'failed',
          error_message: `Generation start failed: ${error.message}`
        }).eq('id', gen.id);
      }
    }

    // ============================================
    // STEP 3: Poll Nano Banana Results
    // ============================================
    for (const gen of generating) {
      const taskId = gen.input_data?.generationTaskId;
      if (!taskId) continue;

      try {
        console.log(`[STEP3] Polling Nano Banana: ${taskId}`);
        const result = await getKieTaskResult(taskId);

        if (result.status === 'SUCCESS') {
          let resultUrl = '';
          if (typeof result.result === 'string') {
            resultUrl = result.result;
          } else if (Array.isArray(result.result)) {
            resultUrl = result.result[0];
          } else if (result.result?.url) {
            resultUrl = result.result.url;
          } else if (result.result?.output) {
            resultUrl = Array.isArray(result.result.output) ? result.result.output[0] : result.result.output;
          }

          if (resultUrl) {
            console.log(`[STEP3] Generation completed: ${resultUrl.substring(0, 60)}...`);
            await supabaseAdmin.from('generations').update({
              status: 'completed',
              result_url: resultUrl
            }).eq('id', gen.id);
          } else {
            await supabaseAdmin.from('generations').update({
              status: 'failed',
              error_message: 'No result URL in response'
            }).eq('id', gen.id);
          }

        } else if (result.status === 'FAILED') {
          await supabaseAdmin.from('generations').update({
            status: 'failed',
            error_message: result.error || 'Generation failed'
          }).eq('id', gen.id);
        }
      } catch (error: any) {
        console.error('[STEP3] Error:', error);
      }
    }

    // ============================================
    // Return Progress
    // ============================================
    const { data: allGens } = await supabaseAdmin
      .from('generations')
      .select('status')
      .eq('project_id', projectId);

    const counts = { pending_analysis: 0, analyzing: 0, pending_generation: 0, generating: 0, completed: 0, failed: 0 };
    allGens?.forEach((g: any) => {
      if (counts.hasOwnProperty(g.status)) {
        counts[g.status as keyof typeof counts]++;
      }
    });

    const total = allGens?.length || 0;
    const completed = counts.completed;
    const failed = counts.failed;
    const inProgress = counts.pending_analysis + counts.analyzing + counts.pending_generation + counts.generating;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    return NextResponse.json({
      success: true,
      progress: {
        total,
        completed,
        failed,
        inProgress,
        percentage,
        isComplete: inProgress === 0 && total > 0,
        details: counts
      }
    });

  } catch (error: any) {
    console.error('Error processing queue:', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
