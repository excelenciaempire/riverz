import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { 
  createKieTask, 
  getKieTaskResult, 
  getKieModelConfig, 
  analyzeWithGemini3Pro,
  analyzeWithClaudeSonnet,
  GeminiMessage, 
  NanoBananaInput 
} from '@/lib/kie-client';
import { getPromptText } from '@/lib/get-ai-prompt';

export const runtime = 'nodejs';
export const maxDuration = 55; // Under 60s for Vercel
export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Static Ads Generation Pipeline
 * 
 * NEW FLOW (4 Steps):
 * 1. pending_analysis → Gemini 3 Pro analyzes template image → pending_prompt
 * 2. pending_prompt → Claude generates image prompt (product + template analysis) → pending_generation
 * 3. pending_generation → Nano Banana Pro creates image → generating
 * 4. generating → Poll Kie.ai for result → completed
 * 
 * Models Used:
 * - Gemini 3 Pro: Multimodal template analysis (sees images)
 * - Claude Sonnet 4.5: Prompt generation (combines product info + template analysis)
 * - Nano Banana Pro: Image generation (max 8 reference images)
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
      .in('status', ['pending_analysis', 'pending_prompt', 'pending_generation', 'generating']);

    if (genError) throw genError;

    const { generationModel } = await getKieModelConfig();

    // Process ONE item per status type to keep request fast (<55s)
    const pendingAnalysis = generations.filter((g: any) => g.status === 'pending_analysis').slice(0, 1);
    const pendingPrompt = generations.filter((g: any) => g.status === 'pending_prompt').slice(0, 1);
    const pendingGeneration = generations.filter((g: any) => g.status === 'pending_generation').slice(0, 1);
    const generating = generations.filter((g: any) => g.status === 'generating').slice(0, 3);

    // ============================================
    // STEP 1: Gemini 3 Pro analyzes template image
    // ============================================
    for (const gen of pendingAnalysis) {
      try {
        // Lock to prevent duplicate processing
        const { data: lockData, error: lockError } = await supabaseAdmin
          .from('generations')
          .update({ 
            status: 'analyzing_template',
            updated_at: new Date().toISOString()
          })
          .eq('id', gen.id)
          .eq('status', 'pending_analysis')
          .select()
          .single();

        if (lockError || !lockData) {
          console.log(`[STEP1] Skipping ${gen.id} - already locked`);
          continue;
        }

        const { templateName, templateThumbnail } = gen.input_data;
        console.log(`[STEP1] Gemini analyzing template: "${templateName}" (${gen.id})`);

        // Get template analysis prompt
        const analysisPrompt = await getPromptText('template_analysis');

        // Build messages for Gemini (multimodal)
        const messages: GeminiMessage[] = [
          { role: 'developer', content: analysisPrompt },
          { 
            role: 'user', 
            content: [
              { type: 'text', text: `Analyze this advertising template image for: ${templateName}` },
              { type: 'image_url', image_url: { url: templateThumbnail } }
            ]
          }
        ];

        // Call Gemini 3 Pro for template analysis
        const templateAnalysis = await analyzeWithGemini3Pro(messages);

        console.log(`[STEP1] Gemini completed. Analysis length: ${templateAnalysis.length}`);

        // Save analysis and move to next step
        await supabaseAdmin.from('generations').update({
          status: 'pending_prompt',
          input_data: { ...gen.input_data, templateAnalysis }
        }).eq('id', gen.id);

      } catch (error: any) {
        console.error('[STEP1] Gemini Error:', error);
        await supabaseAdmin.from('generations').update({
          status: 'failed',
          error_message: `Template analysis failed: ${error.message}`
        }).eq('id', gen.id);
      }
    }

    // ============================================
    // STEP 2: Claude generates image prompt
    // ============================================
    for (const gen of pendingPrompt) {
      try {
        // Lock
        const { data: lockData, error: lockError } = await supabaseAdmin
          .from('generations')
          .update({ 
            status: 'generating_prompt',
            updated_at: new Date().toISOString()
          })
          .eq('id', gen.id)
          .eq('status', 'pending_prompt')
          .select()
          .single();

        if (lockError || !lockData) {
          console.log(`[STEP2] Skipping ${gen.id} - already locked`);
          continue;
        }

        const { 
          productName, 
          productBenefits, 
          productImages, 
          productImage,
          researchData,
          templateName,
          templateAnalysis 
        } = gen.input_data;

        const allProductImages: string[] = productImages || (productImage ? [productImage] : []);

        console.log(`[STEP2] Claude generating prompt for: "${templateName}" + "${productName}" (${gen.id})`);

        // Get prompt generation template
        const promptGenerationTemplate = await getPromptText('static_ads_prompt_generation');

        // Build user message with all context
        const userMessage = `
PRODUCT INFORMATION:
- Name: ${productName}
- Benefits: ${productBenefits || 'Premium quality product'}
- Research Data: ${researchData ? JSON.stringify(researchData).substring(0, 1000) : 'Not available'}

TEMPLATE ANALYSIS:
${templateAnalysis}

Generate a detailed prompt for Nano Banana Pro to create an ad image that combines this product with the template style.
`;

        // Build content with product images (max 3 for Claude context)
        const imageContent: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> = [
          { type: 'text', text: userMessage },
        ];

        // Add product images (max 3)
        for (const imgUrl of allProductImages.slice(0, 3)) {
          if (imgUrl?.startsWith('http')) {
            imageContent.push({ type: 'image_url', image_url: { url: imgUrl } });
          }
        }

        const messages: GeminiMessage[] = [
          { role: 'developer', content: promptGenerationTemplate },
          { role: 'user', content: imageContent }
        ];

        // Call Claude to generate the image prompt
        const generatedPrompt = await analyzeWithClaudeSonnet(messages);

        console.log(`[STEP2] Claude completed. Prompt: ${generatedPrompt.substring(0, 100)}...`);

        // Save prompt and move to next step
        await supabaseAdmin.from('generations').update({
          status: 'pending_generation',
          input_data: { ...gen.input_data, generatedPrompt }
        }).eq('id', gen.id);

      } catch (error: any) {
        console.error('[STEP2] Claude Error:', error);
        await supabaseAdmin.from('generations').update({
          status: 'failed',
          error_message: `Prompt generation failed: ${error.message}`
        }).eq('id', gen.id);
      }
    }

    // ============================================
    // STEP 3: Nano Banana Pro creates image
    // ============================================
    for (const gen of pendingGeneration) {
      try {
        // Lock
        const { error: lockError } = await supabaseAdmin
          .from('generations')
          .update({ 
            status: 'generating',
            updated_at: new Date().toISOString()
          })
          .eq('id', gen.id)
          .eq('status', 'pending_generation');

        if (lockError) continue;

        const { generatedPrompt, productImages, productImage, templateThumbnail } = gen.input_data;
        const allProductImages: string[] = productImages || (productImage ? [productImage] : []);

        console.log(`[STEP3] Nano Banana starting. Prompt: ${generatedPrompt?.substring(0, 80)}...`);

        // Build image inputs (max 8 total for Nano Banana Pro)
        // Priority: 1 template + up to 7 product images
        const imageInputs: string[] = [];
        
        // Add template first (style reference)
        if (templateThumbnail?.startsWith('http')) {
          imageInputs.push(templateThumbnail);
        }
        
        // Add product images (up to 7 more)
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

        console.log(`[STEP3] Nano Banana task created: ${generationTaskId}`);

      } catch (error: any) {
        console.error('[STEP3] Nano Banana Error:', error);
        await supabaseAdmin.from('generations').update({
          status: 'failed',
          error_message: `Image generation failed: ${error.message}`
        }).eq('id', gen.id);
      }
    }

    // ============================================
    // STEP 4: Poll Nano Banana results
    // ============================================
    for (const gen of generating) {
      const taskId = gen.input_data?.generationTaskId;
      if (!taskId) continue;

      try {
        console.log(`[STEP4] Polling Nano Banana: ${taskId}`);
        const result = await getKieTaskResult(taskId);

        if (result.status === 'SUCCESS') {
          // Extract result URL from various possible formats
          let resultUrl = '';
          if (typeof result.result === 'string') {
            resultUrl = result.result;
          } else if (Array.isArray(result.result)) {
            resultUrl = result.result[0];
          } else if (result.result?.url) {
            resultUrl = result.result.url;
          } else if (result.result?.output) {
            resultUrl = Array.isArray(result.result.output) 
              ? result.result.output[0] 
              : result.result.output;
          }

          if (resultUrl) {
            console.log(`[STEP4] SUCCESS! Image: ${resultUrl.substring(0, 60)}...`);
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
        // PENDING/PROCESSING = keep waiting
        
      } catch (error: any) {
        console.error('[STEP4] Polling Error:', error);
      }
    }

    // ============================================
    // Calculate and Return Progress
    // ============================================
    const { data: allGens } = await supabaseAdmin
      .from('generations')
      .select('status')
      .eq('project_id', projectId);

    const counts = { 
      pending_analysis: 0, 
      analyzing_template: 0,
      pending_prompt: 0, 
      generating_prompt: 0,
      pending_generation: 0, 
      generating: 0, 
      completed: 0, 
      failed: 0 
    };
    
    allGens?.forEach((g: any) => {
      if (counts.hasOwnProperty(g.status)) {
        counts[g.status as keyof typeof counts]++;
      }
    });

    const total = allGens?.length || 0;
    const completed = counts.completed;
    const failed = counts.failed;
    const inProgress = total - completed - failed;
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
