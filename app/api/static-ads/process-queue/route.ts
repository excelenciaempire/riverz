import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { 
  createKieTask, 
  getKieTaskResult, 
  getKieModelConfig, 
  analyzeWithGemini3Pro,
  imageUrlToBase64,
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

// Concurrency limits - Optimized for Render Starter
const PARALLEL_STEP1 = 3;  // Template analysis (Gemini)
const PARALLEL_STEP2 = 3;  // Adaptation (Gemini)
const PARALLEL_STEP3 = 3;  // Prompt generation (Gemini)
const PARALLEL_STEP4 = 5;  // Nano Banana tasks
const PARALLEL_POLL = 10;  // Polling operations

/**
 * Static Ads Generation Pipeline - NEW ARCHITECTURE
 * 
 * Status Flow:
 * pending_analysis → analyzing (Step 1: Gemini analyzes template to JSON) →
 * adapting (Step 2: Gemini adapts JSON to product) →
 * generating_prompt (Step 3: Gemini generates final prompt) →
 * pending_generation (Step 4: Nano Banana creates image) →
 * generating → completed/failed
 * 
 * ALL AI calls use Gemini Pro 3 + Nano Banana Pro
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
    const imageBuffer = await downloadImage(kieUrl);
    
    const fileName = `${projectId}/${id}_${Date.now()}.png`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from('generations')
      .upload(fileName, imageBuffer, {
        contentType: 'image/png',
        upsert: true
      });

    if (uploadError) {
      console.error(`[STORAGE] Upload failed for ${id}:`, uploadError);
      // Fall back to kie.ai URL
      await supabaseAdmin.from('generations').update({
        status: 'completed',
        result_url: kieUrl,
        updated_at: new Date().toISOString()
      }).eq('id', id);
      return;
    }

    const { data: urlData } = supabaseAdmin.storage
      .from('generations')
      .getPublicUrl(fileName);

    await supabaseAdmin.from('generations').update({
      status: 'completed',
      result_url: urlData.publicUrl,
      updated_at: new Date().toISOString()
    }).eq('id', id);

    console.log(`[STORAGE] Saved: ${urlData.publicUrl}`);
  } catch (error) {
    console.error(`[STORAGE] Error saving ${id}:`, error);
    await supabaseAdmin.from('generations').update({
      status: 'completed',
      result_url: kieUrl,
      updated_at: new Date().toISOString()
    }).eq('id', id);
  }
}

// Helper: Parse JSON from Gemini response (handles markdown code blocks)
function parseJsonFromResponse(response: string): any {
  let jsonStr = response.trim();
  
  // Remove markdown code blocks if present
  if (jsonStr.startsWith('```json')) {
    jsonStr = jsonStr.slice(7);
  } else if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.slice(3);
  }
  if (jsonStr.endsWith('```')) {
    jsonStr = jsonStr.slice(0, -3);
  }
  
  return JSON.parse(jsonStr.trim());
}

export async function POST(req: Request) {
  try {
    console.log('[PROCESS-QUEUE] Starting new pipeline...');
    
    const { userId } = await auth();
    if (!userId) return new NextResponse('Unauthorized', { status: 401 });

    const body = await req.json();
    const { projectId } = body;
    if (!projectId) return new NextResponse('Missing projectId', { status: 400 });

    // CLEANUP: Reset stuck generations (older than 3 minutes)
    const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000).toISOString();
    
    await supabaseAdmin.from('generations')
      .update({ status: 'pending_analysis', updated_at: new Date().toISOString() })
      .eq('project_id', projectId)
      .in('status', ['analyzing', 'adapting', 'generating_prompt'])
      .lt('updated_at', threeMinutesAgo);

    // Fetch all generations that need processing
    const { data: generations, error: genError } = await supabaseAdmin
      .from('generations')
      .select('*')
      .eq('project_id', projectId)
      .in('status', [
        'pending_analysis', 'analyzing', 'adapting', 'generating_prompt',
        'pending_generation', 'generating'
      ]);

    if (genError) throw genError;
    
    console.log(`[PROCESS-QUEUE] Found ${generations?.length || 0} generations`);
    
    if (!generations || generations.length === 0) {
      return await returnProgress(projectId);
    }

    const { generationModel } = await getKieModelConfig();

    // Group by status for parallel processing
    const step1Queue = generations.filter((g: any) => g.status === 'pending_analysis').slice(0, PARALLEL_STEP1);
    const step2Queue = generations.filter((g: any) => g.status === 'analyzing' && g.input_data?.templateAnalysisJson).slice(0, PARALLEL_STEP2);
    const step3Queue = generations.filter((g: any) => g.status === 'adapting' && g.input_data?.adaptedJson).slice(0, PARALLEL_STEP3);
    const step4Queue = generations.filter((g: any) => g.status === 'generating_prompt' && g.input_data?.generatedPrompt).slice(0, PARALLEL_STEP4);
    const step5Queue = generations.filter((g: any) => g.status === 'generating' && g.input_data?.generationTaskId).slice(0, PARALLEL_POLL);

    // ============================================
    // STEP 1: Template Analysis to JSON (Gemini Pro 3)
    // ============================================
    if (step1Queue.length > 0) {
      console.log(`[STEP1] Analyzing ${step1Queue.length} templates with Gemini Pro 3...`);
      
      await Promise.all(
        step1Queue.map(async (gen: any) => {
          try {
            const locked = await lockGeneration(gen.id, 'pending_analysis', 'analyzing');
            if (!locked) return;

            const { templateName, templateThumbnail } = gen.input_data || {};
            console.log(`[STEP1] Processing: "${templateName}" (${gen.id})`);
            
            if (!templateThumbnail) throw new Error('Missing templateThumbnail');

            // Convert template image to base64
            const templateBase64 = await Promise.race([
              imageUrlToBase64(templateThumbnail),
              new Promise<string>((_, reject) => 
                setTimeout(() => reject(new Error('Image timeout')), 30000)
              )
            ]);

            // Get JSON analysis prompt
            const analysisPrompt = await getPromptText('template_analysis_json');

            const messages: GeminiMessage[] = [
              { role: 'developer', content: analysisPrompt },
              { 
                role: 'user', 
                content: [
                  { type: 'text', text: `Analyze this template: ${templateName}` },
                  { type: 'image_url', image_url: { url: templateBase64 } }
                ]
              }
            ];

            // Call Gemini Pro 3
            const response = await Promise.race([
              analyzeWithGemini3Pro(messages, { temperature: 0.3, maxTokens: 3000 }),
              new Promise<string>((_, reject) => 
                setTimeout(() => reject(new Error('Gemini timeout')), 90000)
              )
            ]);

            // Parse JSON response
            const templateAnalysisJson = parseJsonFromResponse(response);
            console.log(`[STEP1] Completed ${gen.id}. JSON keys: ${Object.keys(templateAnalysisJson).join(', ')}`);

            // Save and keep status as 'analyzing' for Step 2 to pick up
            await supabaseAdmin.from('generations').update({
              input_data: { ...gen.input_data, templateAnalysisJson },
              updated_at: new Date().toISOString()
            }).eq('id', gen.id);

          } catch (error: any) {
            console.error(`[STEP1] Error ${gen.id}:`, error.message);
            await failGeneration(gen.id, `Template analysis failed: ${error.message}`);
          }
        })
      );
    }

    // ============================================
    // STEP 2: Adapt JSON to Product (Gemini Pro 3)
    // ============================================
    if (step2Queue.length > 0) {
      console.log(`[STEP2] Adapting ${step2Queue.length} templates to products...`);
      
      await Promise.all(
        step2Queue.map(async (gen: any) => {
          try {
            const locked = await lockGeneration(gen.id, 'analyzing', 'adapting');
            if (!locked) return;

            const { 
              productName, productDescription, productBenefits, productCategory,
              researchData, templateAnalysisJson 
            } = gen.input_data;

            console.log(`[STEP2] Adapting for: "${productName}" (${gen.id})`);

            // Get adaptation prompt with variables
            const adaptationPrompt = await getPromptWithVariables('template_adaptation', {
              TEMPLATE_JSON: JSON.stringify(templateAnalysisJson, null, 2),
              PRODUCT_NAME: productName || 'Product',
              PRODUCT_DESCRIPTION: productDescription || '',
              PRODUCT_BENEFITS: productBenefits || '',
              PRODUCT_CATEGORY: productCategory || 'General',
              RESEARCH_JSON: researchData ? JSON.stringify(researchData, null, 2) : 'Not available'
            });

            const messages: GeminiMessage[] = [
              { role: 'developer', content: adaptationPrompt },
              { role: 'user', content: 'Generate the adapted JSON for this product based on the template analysis and research provided.' }
            ];

            const response = await Promise.race([
              analyzeWithGemini3Pro(messages, { temperature: 0.4, maxTokens: 3000 }),
              new Promise<string>((_, reject) => 
                setTimeout(() => reject(new Error('Gemini timeout')), 90000)
              )
            ]);

            const adaptedJson = parseJsonFromResponse(response);
            console.log(`[STEP2] Completed ${gen.id}. Adapted keys: ${Object.keys(adaptedJson).join(', ')}`);

            await supabaseAdmin.from('generations').update({
              input_data: { ...gen.input_data, adaptedJson },
              updated_at: new Date().toISOString()
            }).eq('id', gen.id);

          } catch (error: any) {
            console.error(`[STEP2] Error ${gen.id}:`, error.message);
            await failGeneration(gen.id, `Adaptation failed: ${error.message}`);
          }
        })
      );
    }

    // ============================================
    // STEP 3: Generate Final Prompt (Gemini Pro 3)
    // ============================================
    if (step3Queue.length > 0) {
      console.log(`[STEP3] Generating ${step3Queue.length} prompts...`);
      
      await Promise.all(
        step3Queue.map(async (gen: any) => {
          try {
            const locked = await lockGeneration(gen.id, 'adapting', 'generating_prompt');
            if (!locked) return;

            const { productName, adaptedJson } = gen.input_data;
            console.log(`[STEP3] Generating prompt for: "${productName}" (${gen.id})`);

            const promptTemplate = await getPromptWithVariables('static_ads_prompt_generation', {
              ADAPTED_JSON: JSON.stringify(adaptedJson, null, 2),
              PRODUCT_NAME: productName || 'Product'
            });

            const messages: GeminiMessage[] = [
              { role: 'developer', content: promptTemplate },
              { role: 'user', content: 'Generate the image prompt based on the adapted JSON specification.' }
            ];

            const generatedPrompt = await Promise.race([
              analyzeWithGemini3Pro(messages, { temperature: 0.5, maxTokens: 500 }),
              new Promise<string>((_, reject) => 
                setTimeout(() => reject(new Error('Gemini timeout')), 60000)
              )
            ]);

            console.log(`[STEP3] Completed ${gen.id}. Prompt: ${generatedPrompt.substring(0, 80)}...`);

            // Move to pending_generation for Step 4
            await supabaseAdmin.from('generations').update({
              status: 'pending_generation',
              input_data: { ...gen.input_data, generatedPrompt },
              updated_at: new Date().toISOString()
            }).eq('id', gen.id);

          } catch (error: any) {
            console.error(`[STEP3] Error ${gen.id}:`, error.message);
            await failGeneration(gen.id, `Prompt generation failed: ${error.message}`);
          }
        })
      );
    }

    // ============================================
    // STEP 4: Create Nano Banana Tasks
    // ============================================
    if (step4Queue.length > 0) {
      console.log(`[STEP4] Creating ${step4Queue.length} Nano Banana tasks...`);
      
      await Promise.all(
        step4Queue.map(async (gen: any) => {
          try {
            const locked = await lockGeneration(gen.id, 'pending_generation', 'generating');
            if (!locked) return;

            const { generatedPrompt, productImages, productImage } = gen.input_data;
            
            if (!generatedPrompt?.trim()) {
              // Release lock if prompt not ready
              await supabaseAdmin.from('generations').update({
                status: 'pending_generation',
                updated_at: new Date().toISOString()
              }).eq('id', gen.id);
              return;
            }

            const allImages: string[] = productImages || (productImage ? [productImage] : []);
            const imageInputs = allImages.slice(0, 8).filter(url => url?.startsWith('http'));

            console.log(`[STEP4] Creating task ${gen.id} with ${imageInputs.length}/8 images`);

            const nanoBananaInput: NanoBananaInput = {
              prompt: generatedPrompt,
              image_input: imageInputs,
              aspect_ratio: '1:1',
              resolution: '2K',
              output_format: 'png'
            };

            const generationTaskId = await createKieTask(generationModel, nanoBananaInput);
            console.log(`[STEP4] Task created: ${generationTaskId}`);

            await supabaseAdmin.from('generations').update({
              input_data: { ...gen.input_data, generationTaskId },
              updated_at: new Date().toISOString()
            }).eq('id', gen.id);

          } catch (error: any) {
            console.error(`[STEP4] Error ${gen.id}:`, error.message);
            await failGeneration(gen.id, `Image generation failed: ${error.message}`);
          }
        })
      );
    }

    // ============================================
    // STEP 5: Poll Nano Banana Results
    // ============================================
    if (step5Queue.length > 0) {
      console.log(`[STEP5] Polling ${step5Queue.length} tasks...`);
      
      await Promise.all(
        step5Queue.map(async (gen: any) => {
          const taskId = gen.input_data?.generationTaskId;
          if (!taskId) return;

          try {
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
                resultUrl = Array.isArray(result.result.output) 
                  ? result.result.output[0] 
                  : result.result.output;
              }

              if (resultUrl) {
                console.log(`[STEP5] SUCCESS ${gen.id}! Saving...`);
                await saveGenerationResult(gen.id, resultUrl, projectId);
              } else {
                await failGeneration(gen.id, 'No result URL');
              }

            } else if (result.status === 'FAILED') {
              await failGeneration(gen.id, result.error || 'Generation failed');
            }
            // PENDING/PROCESSING = keep waiting
            
          } catch (error: any) {
            console.error(`[STEP5] Poll error ${gen.id}:`, error.message);
          }
        })
      );
    }

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

  const counts: Record<string, number> = { 
    pending_analysis: 0, 
    analyzing: 0,
    adapting: 0, 
    generating_prompt: 0,
    pending_generation: 0, 
    generating: 0, 
    completed: 0, 
    failed: 0 
  };
  
  allGens?.forEach((g: any) => {
    if (g.status in counts) {
      counts[g.status]++;
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
