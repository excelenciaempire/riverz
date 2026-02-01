import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { 
  createKieTask, 
  getKieTaskResult, 
  getKieModelConfig, 
  analyzeWithGemini3Pro,
  analyzeWithClaudeSonnet,
  imageUrlToBase64,
  stripBase64Prefix,
  downloadImage,
  GeminiMessage, 
  NanoBananaInput 
} from '@/lib/kie-client';
import { getPromptWithVariables, getPromptText } from '@/lib/get-ai-prompt';

export const runtime = 'nodejs';
export const maxDuration = 300; // Render Starter supports up to 400s
export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Concurrency limits - Optimized for Render Starter (400s timeout)
const PARALLEL_GEMINI = 3;   // 3 Gemini analyses in parallel
const PARALLEL_CLAUDE = 2;   // 2 Claude prompts in parallel
const PARALLEL_NANO = 5;     // 5 Nano Banana tasks
const PARALLEL_POLL = 10;    // 10 polling operations

/**
 * Static Ads Generation Pipeline - PARALLEL PROCESSING
 * 
 * Status Flow:
 * pending_analysis → analyzing (Step 1: Gemini analyzes template) →
 * pending_generation (Step 2: Claude generates prompt) → 
 * generating (Step 3: Nano Banana creates image) → completed/failed
 * 
 * Models Used:
 * - Gemini 3 Pro: Template analysis (kie.ai)
 * - Claude Sonnet 4.5: Prompt generation (kie.ai)
 * - Nano Banana Pro: Image generation (kie.ai)
 */

// Helper: Lock a generation to prevent duplicate processing
async function lockGeneration(id: string, fromStatus: string, toStatus: string): Promise<boolean> {
  console.log(`[LOCK] Attempting ${id}: ${fromStatus} → ${toStatus}`);
  const startTime = Date.now();
  
  try {
    const { data, error } = await supabaseAdmin
      .from('generations')
      .update({ 
        status: toStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('status', fromStatus)
      .select()
      .single();
    
    const duration = Date.now() - startTime;
    
    if (error) {
      console.log(`[LOCK] Failed ${id} (${duration}ms): ${error.message}`);
      return false;
    }
    
    if (!data) {
      console.log(`[LOCK] No data ${id} (${duration}ms) - status was not ${fromStatus}`);
      return false;
    }
    
    console.log(`[LOCK] Success ${id} (${duration}ms)`);
    return true;
  } catch (err: any) {
    console.error(`[LOCK] Exception ${id}:`, err.message);
    return false;
  }
}

// Helper: Update generation status with error
async function failGeneration(id: string, errorMessage: string) {
  await supabaseAdmin.from('generations').update({
    status: 'failed',
    error_message: errorMessage,
    updated_at: new Date().toISOString()
  }).eq('id', id);
}

// Helper: Save generation result and upload to storage
async function saveGenerationResult(id: string, kieUrl: string, projectId: string) {
  try {
    // Download image from kie.ai
    const imageBuffer = await downloadImage(kieUrl);
    
    // Upload to Supabase Storage
    const fileName = `${projectId}/${id}_${Date.now()}.png`;
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('generations')
      .upload(fileName, imageBuffer, {
        contentType: 'image/png',
        upsert: true
      });

    if (uploadError) {
      console.error(`[STORAGE] Upload failed for ${id}:`, uploadError);
      // Fall back to kie.ai URL if upload fails
      await supabaseAdmin.from('generations').update({
        status: 'completed',
        result_url: kieUrl,
        updated_at: new Date().toISOString()
      }).eq('id', id);
      return;
    }

    // Get public URL
    const { data: urlData } = supabaseAdmin.storage
      .from('generations')
      .getPublicUrl(fileName);

    await supabaseAdmin.from('generations').update({
      status: 'completed',
      result_url: urlData.publicUrl,
      updated_at: new Date().toISOString()
    }).eq('id', id);

    console.log(`[STORAGE] Saved to: ${urlData.publicUrl}`);
  } catch (error) {
    console.error(`[STORAGE] Error saving ${id}:`, error);
    // Fall back to kie.ai URL
    await supabaseAdmin.from('generations').update({
      status: 'completed',
      result_url: kieUrl,
      updated_at: new Date().toISOString()
    }).eq('id', id);
  }
}

export async function POST(req: Request) {
  try {
    console.log('[PROCESS-QUEUE] Starting...');
    
    const { userId } = await auth();
    console.log('[PROCESS-QUEUE] Auth userId:', userId ? 'present' : 'missing');
    if (!userId) return new NextResponse('Unauthorized', { status: 401 });

    const body = await req.json();
    const { projectId } = body;
    console.log('[PROCESS-QUEUE] Project ID:', projectId);
    if (!projectId) return new NextResponse('Missing projectId', { status: 400 });

    // CLEANUP: Reset stuck generations (older than 2 minutes in intermediate states)
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    
    // Reset analyzing → pending_analysis (Step 1 stuck)
    await supabaseAdmin.from('generations')
      .update({ status: 'pending_analysis', updated_at: new Date().toISOString() })
      .eq('project_id', projectId)
      .eq('status', 'analyzing')
      .lt('updated_at', twoMinutesAgo);

    // Note: 'generating' with taskId should continue polling

    // Fetch all generations that need processing
    const { data: generations, error: genError } = await supabaseAdmin
      .from('generations')
      .select('*')
      .eq('project_id', projectId)
      .in('status', [
        'pending_analysis', 'analyzing',
        'pending_generation', 'generating'
      ]);

    if (genError) {
      console.error('[PROCESS-QUEUE] Error fetching generations:', genError);
      throw genError;
    }
    
    console.log(`[PROCESS-QUEUE] Found ${generations?.length || 0} generations to process`);
    
    if (!generations || generations.length === 0) {
      console.log('[PROCESS-QUEUE] Nothing to process, returning current progress');
      return await returnProgress(projectId);
    }

    const { generationModel } = await getKieModelConfig();
    console.log('[PROCESS-QUEUE] Using generation model:', generationModel);

    // Group by status for parallel processing
    const pendingAnalysis = generations.filter((g: any) => g.status === 'pending_analysis').slice(0, PARALLEL_GEMINI);
    const needsPrompt = generations.filter((g: any) => 
      g.status === 'analyzing' && g.input_data?.templateAnalysis
    ).slice(0, PARALLEL_CLAUDE);
    const pendingGeneration = generations.filter((g: any) => g.status === 'pending_generation').slice(0, PARALLEL_NANO);
    const generating = generations.filter((g: any) => g.status === 'generating' && g.input_data?.generationTaskId).slice(0, PARALLEL_POLL);

    // ============================================
    // STEP 1: Gemini Flash 2.0 analyzes templates (PARALLEL)
    // ============================================
    if (pendingAnalysis.length > 0) {
      console.log(`[STEP1] Processing ${pendingAnalysis.length} templates with Gemini 3 Pro (kie.ai)...`);
      
      await Promise.all(
        pendingAnalysis.map(async (gen: any) => {
          try {
            // Lock
            console.log(`[STEP1] Attempting lock for ${gen.id}...`);
            const locked = await lockGeneration(gen.id, 'pending_analysis', 'analyzing');
            if (!locked) {
              console.log(`[STEP1] Skipping ${gen.id} - already locked`);
              return;
            }
            console.log(`[STEP1] Lock acquired for ${gen.id}`);

            const inputData = gen.input_data;
            console.log(`[STEP1] Input data keys:`, Object.keys(inputData || {}));
            
            const { templateName, templateThumbnail } = inputData || {};
            console.log(`[STEP1] Analyzing: "${templateName}" thumbnail: ${templateThumbnail?.substring(0, 50)}...`);
            
            if (!templateThumbnail) {
              throw new Error('Missing templateThumbnail in input_data');
            }

            // Convert template image to base64 with timeout
            console.log(`[STEP1] Converting image to base64...`);
            const imageStartTime = Date.now();
            const templateBase64 = await Promise.race([
              imageUrlToBase64(templateThumbnail),
              new Promise<string>((_, reject) => 
                setTimeout(() => reject(new Error('Image conversion timeout (30s)')), 30000)
              )
            ]);
            console.log(`[STEP1] Image converted in ${Date.now() - imageStartTime}ms, size: ${templateBase64.length} chars`);

            // Get template analysis prompt
            const analysisPrompt = await getPromptText('template_analysis');

            // Build messages for Gemini Flash 2.0 (multimodal)
            const messages: GeminiMessage[] = [
              { role: 'developer', content: analysisPrompt },
              { 
                role: 'user', 
                content: [
                  { type: 'text', text: `Analyze this advertising template image for: ${templateName}` },
                  { type: 'image_url', image_url: { url: templateBase64 } }
                ]
              }
            ];

            // Call Gemini 3 Pro via kie.ai (same as research) with timeout
            console.log(`[STEP1] Calling Gemini 3 Pro (kie.ai) for ${gen.id}...`);
            const geminiStartTime = Date.now();
            const templateAnalysis = await Promise.race([
              analyzeWithGemini3Pro(messages, { temperature: 0.4, maxTokens: 2000 }),
              new Promise<string>((_, reject) => 
                setTimeout(() => reject(new Error('Gemini 3 Pro timeout (90s)')), 90000)
              )
            ]);
            console.log(`[STEP1] Gemini 3 Pro completed for ${gen.id} in ${Date.now() - geminiStartTime}ms. Analysis: ${templateAnalysis.length} chars`);

            // Save analysis - keep status 'analyzing' so Step 2 can pick it up
            await supabaseAdmin.from('generations').update({
              input_data: { ...gen.input_data, templateAnalysis },
              updated_at: new Date().toISOString()
            }).eq('id', gen.id);

          } catch (error: any) {
            console.error(`[STEP1] Error for ${gen.id}:`, error.message);
            await failGeneration(gen.id, `Template analysis failed: ${error.message}`);
          }
        })
      );
    }

    // ============================================
    // STEP 2: Claude generates image prompts (PARALLEL)
    // ============================================
    if (needsPrompt.length > 0) {
      console.log(`[STEP2] Processing ${needsPrompt.length} prompts with Claude Sonnet 4.5...`);
      
      await Promise.all(
        needsPrompt.map(async (gen: any) => {
          try {
            // Lock: analyzing (with templateAnalysis) → pending_generation
            const locked = await lockGeneration(gen.id, 'analyzing', 'pending_generation');
            if (!locked) {
              console.log(`[STEP2] Skipping ${gen.id} - already processing`);
              return;
            }

            const { 
              productName,
              productDescription,
              productBenefits,
              productPrice,
              productCategory,
              productImages, 
              productImage,
              researchData,
              templateName,
              templateThumbnail,
              templateAnalysis 
            } = gen.input_data;

            const allProductImages: string[] = productImages || (productImage ? [productImage] : []);

            console.log(`[STEP2] Generating prompt for: "${productName}" + "${templateName}" (${gen.id})`);

            // Get prompt generation template with variables
            const promptGenerationTemplate = await getPromptWithVariables('static_ads_prompt_generation', {
              PRODUCT_NAME: productName || 'Product',
              PRODUCT_DESCRIPTION: productDescription || '',
              PRODUCT_BENEFITS: productBenefits || 'Premium quality',
              PRODUCT_PRICE: productPrice || 'Not specified',
              PRODUCT_CATEGORY: productCategory || 'General',
              DEEP_RESEARCH_JSON: researchData ? JSON.stringify(researchData) : 'Not available',
              GEMINI_ANALYSIS_TEXT: templateAnalysis || 'Analysis not available',
              TEMPLATE_NAME: templateName || 'Template'
            });

            // Build content with images
            const imageContent: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> = [
              { type: 'text', text: 'Based on the product information and template analysis provided in the system prompt, generate the image prompt.' }
            ];

            // Add template image first
            if (templateThumbnail?.startsWith('http')) {
              try {
                const templateBase64 = await imageUrlToBase64(templateThumbnail);
                imageContent.push({ type: 'image_url', image_url: { url: templateBase64 } });
              } catch (e) {
                console.log(`[STEP2] Could not add template image: ${e}`);
              }
            }

            // Add product images (max 3 for context efficiency)
            for (const imgUrl of allProductImages.slice(0, 3)) {
              if (imgUrl?.startsWith('http')) {
                try {
                  const imgBase64 = await imageUrlToBase64(imgUrl);
                  imageContent.push({ type: 'image_url', image_url: { url: imgBase64 } });
                } catch (e) {
                  console.log(`[STEP2] Could not add product image: ${e}`);
                }
              }
            }

            const messages: GeminiMessage[] = [
              { role: 'developer', content: promptGenerationTemplate },
              { role: 'user', content: imageContent }
            ];

            // Call Claude Sonnet 4.5 - reduced tokens for faster response
            const generatedPrompt = await analyzeWithClaudeSonnet(messages, {
              temperature: 0.6,
              maxTokens: 1500
            });

            console.log(`[STEP2] Claude completed for ${gen.id}. Prompt: ${generatedPrompt.substring(0, 80)}...`);

            // Save prompt and move to next step
            await supabaseAdmin.from('generations').update({
              status: 'pending_generation',
              input_data: { ...gen.input_data, generatedPrompt },
              updated_at: new Date().toISOString()
            }).eq('id', gen.id);

          } catch (error: any) {
            console.error(`[STEP2] Error for ${gen.id}:`, error.message);
            await failGeneration(gen.id, `Prompt generation failed: ${error.message}`);
          }
        })
      );
    }

    // ============================================
    // STEP 3: Nano Banana Pro creates images (PARALLEL)
    // ============================================
    if (pendingGeneration.length > 0) {
      console.log(`[STEP3] Starting ${pendingGeneration.length} Nano Banana Pro generations...`);
      
      await Promise.all(
        pendingGeneration.map(async (gen: any) => {
          try {
            // Lock
            const locked = await lockGeneration(gen.id, 'pending_generation', 'generating');
            if (!locked) {
              console.log(`[STEP3] Skipping ${gen.id} - already locked`);
              return;
            }

            const { generatedPrompt, productImages, productImage } = gen.input_data;
            const allProductImages: string[] = productImages || (productImage ? [productImage] : []);

            console.log(`[STEP3] Starting Nano Banana for ${gen.id}`);

            // Convert product images to base64 (max 8)
            const imageInputs: string[] = [];
            
            for (const imgUrl of allProductImages.slice(0, 8)) {
              if (imgUrl?.startsWith('http')) {
                try {
                  const dataUri = await imageUrlToBase64(imgUrl);
                  const cleanBase64 = stripBase64Prefix(dataUri);
                  imageInputs.push(cleanBase64);
                } catch (e) {
                  console.log(`[STEP3] Could not convert image: ${e}`);
                }
              }
              if (imageInputs.length >= 8) break;
            }

            const nanoBananaInput: NanoBananaInput = {
              prompt: generatedPrompt,
              image_input: imageInputs,
              aspect_ratio: '1:1',
              resolution: '2K',
              output_format: 'png'
            };

            const generationTaskId = await createKieTask(generationModel, nanoBananaInput);

            await supabaseAdmin.from('generations').update({
              input_data: { ...gen.input_data, generationTaskId },
              updated_at: new Date().toISOString()
            }).eq('id', gen.id);

            console.log(`[STEP3] Task created for ${gen.id}: ${generationTaskId}`);

          } catch (error: any) {
            console.error(`[STEP3] Error for ${gen.id}:`, error.message);
            await failGeneration(gen.id, `Image generation failed: ${error.message}`);
          }
        })
      );
    }

    // ============================================
    // STEP 4: Poll Nano Banana results (PARALLEL)
    // ============================================
    if (generating.length > 0) {
      console.log(`[STEP4] Polling ${generating.length} Nano Banana tasks...`);
      
      await Promise.all(
        generating.map(async (gen: any) => {
          const taskId = gen.input_data?.generationTaskId;
          if (!taskId) return;

          try {
            const result = await getKieTaskResult(taskId);

            if (result.status === 'SUCCESS') {
              // Extract result URL
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
                console.log(`[STEP4] SUCCESS for ${gen.id}! Saving to storage...`);
                // Download from kie.ai and upload to our storage
                await saveGenerationResult(gen.id, resultUrl, projectId);
              } else {
                await failGeneration(gen.id, 'No result URL in response');
              }

            } else if (result.status === 'FAILED') {
              await failGeneration(gen.id, result.error || 'Generation failed');
            }
            // PENDING/PROCESSING = keep waiting
            
          } catch (error: any) {
            console.error(`[STEP4] Polling error for ${gen.id}:`, error.message);
          }
        })
      );
    }

    // Return current progress
    return await returnProgress(projectId);

  } catch (error: any) {
    console.error('Error processing queue:', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}

// Helper: Calculate and return progress
async function returnProgress(projectId: string) {
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
}
