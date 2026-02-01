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
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Static Ads Pipeline - Each template processes through ALL steps sequentially
 * Multiple templates process in PARALLEL
 * 
 * Flow per template: pending_analysis → analyzing → adapting → generating_prompt → pending_generation → generating → completed
 */

// Parse JSON from Gemini response
function parseJsonFromResponse(response: string): any {
  let jsonStr = response.trim();
  if (jsonStr.startsWith('```json')) jsonStr = jsonStr.slice(7);
  else if (jsonStr.startsWith('```')) jsonStr = jsonStr.slice(3);
  if (jsonStr.endsWith('```')) jsonStr = jsonStr.slice(0, -3);
  return JSON.parse(jsonStr.trim());
}

// Update status
async function updateGeneration(id: string, updates: any) {
  await supabaseAdmin.from('generations').update({
    ...updates,
    updated_at: new Date().toISOString()
  }).eq('id', id);
}

// Fail generation
async function failGeneration(id: string, error: string) {
  await updateGeneration(id, { status: 'failed', error_message: error });
}

// Save result to storage
async function saveResult(id: string, kieUrl: string, projectId: string) {
  try {
    const imageBuffer = await downloadImage(kieUrl);
    const fileName = `${projectId}/${id}_${Date.now()}.png`;
    
    const { error } = await supabaseAdmin.storage
      .from('generations')
      .upload(fileName, imageBuffer, { contentType: 'image/png', upsert: true });

    if (error) {
      await updateGeneration(id, { status: 'completed', result_url: kieUrl });
      return;
    }

    const { data } = supabaseAdmin.storage.from('generations').getPublicUrl(fileName);
    await updateGeneration(id, { status: 'completed', result_url: data.publicUrl });
  } catch (e) {
    await updateGeneration(id, { status: 'completed', result_url: kieUrl });
  }
}

// Process a SINGLE generation through its ENTIRE remaining pipeline
async function processGeneration(gen: any, generationModel: string, projectId: string): Promise<void> {
  const id = gen.id;
  let inputData = { ...gen.input_data };
  let currentStatus = gen.status;
  
  console.log(`[GEN ${id.slice(0,8)}] Starting from status: ${currentStatus}`);

  try {
    // STEP 1: Template Analysis (if pending)
    if (currentStatus === 'pending_analysis') {
      console.log(`[GEN ${id.slice(0,8)}] Step 1: Analyzing template...`);
      await updateGeneration(id, { status: 'analyzing' });
      
      const { templateName, templateThumbnail } = inputData;
      if (!templateThumbnail) throw new Error('Missing templateThumbnail');

      const templateBase64 = await imageUrlToBase64(templateThumbnail);
      const analysisPrompt = await getPromptText('template_analysis_json');

      const messages: GeminiMessage[] = [
        { role: 'developer', content: analysisPrompt },
        { role: 'user', content: [
          { type: 'text', text: `Analyze this template: ${templateName}` },
          { type: 'image_url', image_url: { url: templateBase64 } }
        ]}
      ];

      const response = await analyzeWithGemini3Pro(messages, { temperature: 0.3, maxTokens: 3000 });
      inputData.templateAnalysisJson = parseJsonFromResponse(response);
      
      await updateGeneration(id, { input_data: inputData });
      currentStatus = 'analyzing';
      console.log(`[GEN ${id.slice(0,8)}] Step 1 complete`);
    }

    // STEP 2: Adaptation (if analyzing with JSON)
    if (currentStatus === 'analyzing' && inputData.templateAnalysisJson) {
      console.log(`[GEN ${id.slice(0,8)}] Step 2: Adapting to product...`);
      await updateGeneration(id, { status: 'adapting' });

      const adaptationPrompt = await getPromptWithVariables('template_adaptation', {
        TEMPLATE_JSON: JSON.stringify(inputData.templateAnalysisJson, null, 2),
        PRODUCT_NAME: inputData.productName || 'Product',
        PRODUCT_DESCRIPTION: inputData.productDescription || '',
        PRODUCT_BENEFITS: inputData.productBenefits || '',
        PRODUCT_CATEGORY: inputData.productCategory || 'General',
        RESEARCH_JSON: inputData.researchData ? JSON.stringify(inputData.researchData, null, 2) : 'Not available'
      });

      const messages: GeminiMessage[] = [
        { role: 'developer', content: adaptationPrompt },
        { role: 'user', content: 'Generate the adapted JSON.' }
      ];

      const response = await analyzeWithGemini3Pro(messages, { temperature: 0.4, maxTokens: 3000 });
      inputData.adaptedJson = parseJsonFromResponse(response);
      
      await updateGeneration(id, { input_data: inputData });
      currentStatus = 'adapting';
      console.log(`[GEN ${id.slice(0,8)}] Step 2 complete`);
    }

    // STEP 3: Generate Prompt (if adapting with adapted JSON)
    if (currentStatus === 'adapting' && inputData.adaptedJson) {
      console.log(`[GEN ${id.slice(0,8)}] Step 3: Generating prompt...`);
      await updateGeneration(id, { status: 'generating_prompt' });

      const promptTemplate = await getPromptWithVariables('static_ads_prompt_generation', {
        ADAPTED_JSON: JSON.stringify(inputData.adaptedJson, null, 2),
        PRODUCT_NAME: inputData.productName || 'Product'
      });

      const messages: GeminiMessage[] = [
        { role: 'developer', content: promptTemplate },
        { role: 'user', content: 'Generate the image prompt.' }
      ];

      const response = await analyzeWithGemini3Pro(messages, { temperature: 0.5, maxTokens: 500 });
      inputData.generatedPrompt = response.trim();
      
      await updateGeneration(id, { status: 'pending_generation', input_data: inputData });
      currentStatus = 'pending_generation';
      console.log(`[GEN ${id.slice(0,8)}] Step 3 complete. Prompt: ${inputData.generatedPrompt.slice(0,60)}...`);
    }

    // STEP 4: Create Nano Banana Task (if pending_generation with prompt)
    if (currentStatus === 'pending_generation' && inputData.generatedPrompt && !inputData.generationTaskId) {
      console.log(`[GEN ${id.slice(0,8)}] Step 4: Creating Nano Banana task...`);
      await updateGeneration(id, { status: 'generating' });

      const allImages: string[] = inputData.productImages || (inputData.productImage ? [inputData.productImage] : []);
      const imageInputs = allImages.slice(0, 8).filter((url: string) => url?.startsWith('http'));

            const nanoBananaInput: NanoBananaInput = {
              prompt: inputData.generatedPrompt,
              image_input: imageInputs,
              aspect_ratio: '3:4',
              resolution: '2K',
              output_format: 'png'
            };

      const taskId = await createKieTask(generationModel, nanoBananaInput);
      inputData.generationTaskId = taskId;
      
      await updateGeneration(id, { input_data: inputData });
      currentStatus = 'generating';
      console.log(`[GEN ${id.slice(0,8)}] Step 4 complete. TaskId: ${taskId}`);
    }

    // STEP 5: Poll for result (if generating with taskId)
    if (currentStatus === 'generating' && inputData.generationTaskId) {
      console.log(`[GEN ${id.slice(0,8)}] Step 5: Polling Nano Banana...`);
      
      const result = await getKieTaskResult(inputData.generationTaskId);

      if (result.status === 'SUCCESS') {
        let resultUrl = '';
        if (typeof result.result === 'string') resultUrl = result.result;
        else if (Array.isArray(result.result)) resultUrl = result.result[0];
        else if (result.result?.url) resultUrl = result.result.url;
        else if (result.result?.output) {
          resultUrl = Array.isArray(result.result.output) ? result.result.output[0] : result.result.output;
        }

        if (resultUrl) {
          console.log(`[GEN ${id.slice(0,8)}] SUCCESS! Saving...`);
          await saveResult(id, resultUrl, projectId);
        } else {
          throw new Error('No result URL');
        }
      } else if (result.status === 'FAILED') {
        throw new Error(result.error || 'Generation failed');
      }
      // PENDING/PROCESSING = will be checked on next poll
    }

  } catch (error: any) {
    console.error(`[GEN ${id.slice(0,8)}] Error:`, error.message);
    await failGeneration(id, error.message);
  }
}

export async function POST(req: Request) {
  try {
    console.log('[PROCESS-QUEUE] Starting...');
    
    const { userId } = await auth();
    if (!userId) return new NextResponse('Unauthorized', { status: 401 });

    const body = await req.json();
    const { projectId } = body;
    if (!projectId) return new NextResponse('Missing projectId', { status: 400 });

    // Reset stuck generations (older than 2 min)
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    await supabaseAdmin.from('generations')
      .update({ status: 'pending_analysis', updated_at: new Date().toISOString() })
      .eq('project_id', projectId)
      .in('status', ['analyzing', 'adapting', 'generating_prompt'])
      .lt('updated_at', twoMinutesAgo);

    // Fetch all non-terminal generations
    const { data: generations, error } = await supabaseAdmin
      .from('generations')
      .select('*')
      .eq('project_id', projectId)
      .in('status', ['pending_analysis', 'analyzing', 'adapting', 'generating_prompt', 'pending_generation', 'generating']);

    if (error) throw error;
    
    console.log(`[PROCESS-QUEUE] Found ${generations?.length || 0} generations to process`);
    
    if (!generations || generations.length === 0) {
      return await returnProgress(projectId);
    }

    console.log(`[PROCESS-QUEUE] Generation statuses: ${generations.map(g => g.status).join(', ')}`);

    const { generationModel } = await getKieModelConfig();

    // Process ALL generations in parallel - each one goes through its full pipeline
    const results = await Promise.allSettled(
      generations.map((gen) => processGeneration(gen, generationModel, projectId))
    );

    // Log any failures
    results.forEach((result, idx) => {
      if (result.status === 'rejected') {
        console.error(`[PROCESS-QUEUE] Generation ${generations[idx].id.slice(0,8)} failed:`, result.reason);
      }
    });

    return await returnProgress(projectId);

  } catch (error: any) {
    console.error('[PROCESS-QUEUE] Error:', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}

async function returnProgress(projectId: string) {
  const { data: allGens } = await supabaseAdmin
    .from('generations')
    .select('status')
    .eq('project_id', projectId);

  const counts: Record<string, number> = { 
    pending_analysis: 0, analyzing: 0, adapting: 0, generating_prompt: 0,
    pending_generation: 0, generating: 0, completed: 0, failed: 0 
  };
  
  allGens?.forEach((g: any) => { if (g.status in counts) counts[g.status]++; });

  const total = allGens?.length || 0;
  const completed = counts.completed;
  const failed = counts.failed;
  const inProgress = total - completed - failed;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  return NextResponse.json({
    success: true,
    progress: { total, completed, failed, inProgress, percentage, isComplete: inProgress === 0 && total > 0, details: counts }
  });
}
