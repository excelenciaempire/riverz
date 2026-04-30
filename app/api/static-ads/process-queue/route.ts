import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import {
  createKieTask,
  getKieTaskResult,
  getKieModelConfig,
  analyzeWithFallback,
  imageUrlToBase64,
  downloadImage,
  GeminiMessage,
  NanoBananaInput,
} from '@/lib/kie-client';
import { getPromptText, getPromptWithVariables } from '@/lib/get-ai-prompt';
import { getImageDimensions, pickClosestNanoBananaAspect } from '@/lib/image-dims';

export const runtime = 'nodejs';
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Static Ads Pipeline (1 image per selected template).
 *
 * For each selected template the system creates one generation row. The row
 * runs the shared analysis steps and then generates a single Nano Banana
 * image. Bump VARIATIONS_PER_TEMPLATE if you ever want fan-out again — the
 * leader/sibling distribution code below still supports it.
 *
 * Steps (per template, in order):
 *   1. Template Analysis  (Gemini 3 Pro vision) → templateAnalysisJson
 *   2. Adapt to Product   (Gemini 3 Pro vision) → adaptedJson
 *   3. Generate 1 Prompt  (Gemini 3 Pro)        → variationPrompts[1]
 *      Leader writes templateAnalysisJson + adaptedJson + the assigned prompt
 *      back into its own row and flips its status to 'pending_generation'.
 *   4. Create Nano Banana task → generationTaskId
 *   5. Poll for result on each process-queue tick
 */

const VARIATIONS_PER_TEMPLATE = 1;

// --- Helpers ------------------------------------------------------------

function parseJsonFromResponse(response: string): any {
  let s = response.trim();
  if (s.startsWith('```json')) s = s.slice(7);
  else if (s.startsWith('```')) s = s.slice(3);
  if (s.endsWith('```')) s = s.slice(0, -3);
  return JSON.parse(s.trim());
}

async function updateGeneration(id: string, updates: any) {
  await supabaseAdmin
    .from('generations')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);
}

async function failGeneration(id: string, error: string) {
  await updateGeneration(id, { status: 'failed', error_message: error });
}

async function saveResult(id: string, kieUrl: string, projectId: string) {
  // Always try to mirror the rendered image into Supabase Storage so the
  // public URL we return is on a host the browser CSP allows. Fallback to
  // the kie/aiquickdraw URL only if BOTH the download and upload fail —
  // and even then, log loudly so we know.
  try {
    const imageBuffer = await downloadImage(kieUrl);
    const fileName = `${projectId}/${id}_${Date.now()}.png`;

    const { error } = await supabaseAdmin.storage
      .from('generations')
      .upload(fileName, imageBuffer, { contentType: 'image/png', upsert: true });

    if (error) {
      console.error(`[GEN ${id.slice(0, 8)}] saveResult: storage upload failed, falling back to source URL`, error);
      await updateGeneration(id, { status: 'completed', result_url: kieUrl });
      return;
    }

    const { data } = supabaseAdmin.storage.from('generations').getPublicUrl(fileName);
    console.log(`[GEN ${id.slice(0, 8)}] saveResult: stored at ${data.publicUrl}`);
    await updateGeneration(id, { status: 'completed', result_url: data.publicUrl });
  } catch (err: any) {
    console.error(`[GEN ${id.slice(0, 8)}] saveResult: download failed, falling back to source URL (${kieUrl}):`, err?.message || err);
    await updateGeneration(id, { status: 'completed', result_url: kieUrl });
  }
}

// --- Shared analysis steps (run once per template) ---------------------

/**
 * Steps 1-3 for a template. Runs on the leader generation (variation_index=1)
 * and writes the resulting JSONs + assigned prompt into ALL siblings.
 */
async function runSharedAnalysisForTemplate(
  leader: any,
  siblings: any[],
  analysisModel: string
): Promise<void> {
  const id = leader.id;
  let inputData = { ...leader.input_data };
  const templateId = inputData.templateId;
  const allRows = [leader, ...siblings];

  const log = (msg: string) => console.log(`[TEMPLATE ${templateId?.slice(0, 8)}] ${msg}`);

  // STEP 1 — Template analysis with vision -------------------------------
  if (!inputData.templateAnalysisJson) {
    // Atomic claim: only the tick that flips status from pending_analysis →
    // analyzing actually proceeds. Concurrent ticks (the historial page polls
    // every 2s) lose the CAS and bail out, so we don't hammer Gemini with
    // duplicate calls for the same row.
    const { data: claim } = await supabaseAdmin
      .from('generations')
      .update({ status: 'analyzing', updated_at: new Date().toISOString() })
      .eq('id', leader.id)
      .eq('status', 'pending_analysis')
      .select('id')
      .maybeSingle();
    if (!claim) {
      log('Step 1: skipped — already in flight on another tick');
      return;
    }
    log('Step 1: claimed → Analyzing template (Gemini 3 Pro vision)...');
    // Mirror the analyzing status onto siblings so the UI shows progress.
    await Promise.all(siblings.map((r) => updateGeneration(r.id, { status: 'analyzing' })));

    if (!inputData.templateThumbnail) throw new Error('Missing templateThumbnail');

    // Always inline the template image as a base64 data URI. The Gemini
    // gateway on kie.ai accepts both URLs and data URIs, but URLs require an
    // outbound fetch from kie.ai's side that sometimes silently fails on
    // private-bucket Supabase URLs — base64 guarantees the model sees the
    // actual pixels.
    let templateBase64: string;
    try {
      templateBase64 = await imageUrlToBase64(inputData.templateThumbnail);
    } catch (err: any) {
      throw new Error(`Failed to download template thumbnail (${inputData.templateThumbnail}): ${err.message}`);
    }

    // Resolve the template's true aspect ratio so the Nano Banana output
    // matches its framing (square template → square ad, story → 9:16, etc).
    // Order of preference:
    //   1. Use templateDims already attached by /api/static-ads/clone (which
    //      pulls width/height from the templates row when the admin recorded
    //      them at upload time).
    //   2. Fall back to probing the base64 buffer we just downloaded.
    //   3. Hard fallback to 3:4 (legacy default) if everything else fails.
    let templateAspectRatio: string = inputData.templateAspectRatio || '3:4';
    let templateDims: { width: number; height: number } | null = inputData.templateDims || null;
    if (!inputData.templateAspectRatio) {
      if (templateDims?.width && templateDims?.height) {
        templateAspectRatio = pickClosestNanoBananaAspect(templateDims.width, templateDims.height);
        log(`Step 1: aspect ${templateAspectRatio} from stored dims ${templateDims.width}×${templateDims.height}`);
      } else {
        try {
          const base64 = templateBase64.split(',')[1] || templateBase64;
          const buf = Buffer.from(base64, 'base64');
          const dims = getImageDimensions(buf);
          templateDims = { width: dims.width, height: dims.height };
          templateAspectRatio = pickClosestNanoBananaAspect(dims.width, dims.height);
          log(`Step 1: aspect ${templateAspectRatio} from probed dims ${dims.width}×${dims.height} (${dims.format})`);
        } catch (err: any) {
          log(`Step 1: aspect detection failed (${err.message}) — using fallback 3:4`);
        }
      }
    }
    inputData.templateAspectRatio = templateAspectRatio;
    if (templateDims) inputData.templateDims = templateDims;

    const analysisPrompt = await getPromptText('template_analysis_json');

    const messages: GeminiMessage[] = [
      { role: 'developer', content: analysisPrompt },
      {
        role: 'user',
        content: [
          { type: 'text', text: `This is the template image to analyse (name: ${inputData.templateName || 'Unnamed'}). Extract everything you see — composition, colors, lighting, every text element with its exact wording, and any decorative elements — into the requested JSON.` },
          { type: 'image_url', image_url: { url: templateBase64 } },
        ],
      },
    ];

    log(`Step 1: sending 1 template image (${Math.round(templateBase64.length / 1024)}KB base64) to ${analysisModel}`);

    const { text, modelUsed, fellBack } = await analyzeWithFallback(analysisModel, messages, {
      temperature: 0.3,
      maxTokens: 4000,
    });
    if (fellBack) log(`Step 1 fell back to ${modelUsed}`);

    inputData.templateAnalysisJson = parseJsonFromResponse(text);
    inputData.modelUsedAnalysis = modelUsed;

    // Persist immediately so a concurrent tick (or a future restart) sees
    // the analysis JSON and skips re-running step 1. Without this, inputData
    // changes only land at the end of the function — meaning if step 2
    // crashes, we'd retry step 1 from scratch on the next tick.
    await updateGeneration(leader.id, {
      input_data: {
        ...leader.input_data,
        templateAnalysisJson: inputData.templateAnalysisJson,
        modelUsedAnalysis: inputData.modelUsedAnalysis,
        templateAspectRatio: inputData.templateAspectRatio,
        templateDims: inputData.templateDims,
      },
    });
  }

  // STEP 2 — Adapt to product (vision: product photos) ------------------
  if (!inputData.adaptedJson) {
    // Atomic claim: same idea as Step 1. Only the tick that flips analyzing
    // → adapting proceeds. Note we accept either 'analyzing' (just finished
    // step 1) or 'pending_analysis' (rare: a row that was already in DB
    // with templateAnalysisJson set but never advanced) as valid claim
    // origins.
    const { data: claim2 } = await supabaseAdmin
      .from('generations')
      .update({ status: 'adapting', updated_at: new Date().toISOString() })
      .eq('id', leader.id)
      .in('status', ['analyzing', 'pending_analysis'])
      .select('id')
      .maybeSingle();
    if (!claim2) {
      log('Step 2: skipped — already in flight on another tick');
      return;
    }
    log('Step 2: claimed → Adapting to product (Gemini 3 Pro vision)...');
    await Promise.all(siblings.map((r) => updateGeneration(r.id, { status: 'adapting' })));

    const adaptationSystemPrompt = await getPromptWithVariables('template_adaptation', {
      TEMPLATE_JSON: JSON.stringify(inputData.templateAnalysisJson, null, 2),
      PRODUCT_NAME: inputData.productName || 'Product',
      PRODUCT_DESCRIPTION: inputData.productDescription || '',
      PRODUCT_BENEFITS: inputData.productBenefits || '',
      PRODUCT_CATEGORY: inputData.productCategory || 'General',
      RESEARCH_JSON: inputData.researchData ? JSON.stringify(inputData.researchData, null, 2) : 'Not available',
    });

    const rawProductUrls: string[] = (inputData.productImages || [])
      .slice(0, 4)
      .filter((u: any) => typeof u === 'string' && u.startsWith('http'));

    if (rawProductUrls.length === 0) {
      log(`Step 2 WARNING: no productImages on this generation row — Gemini will adapt blind.`);
    }

    // Inline each product photo as base64 (same reasoning as Step 1: removes
    // any chance the kie.ai side silently fails to fetch a Supabase URL).
    // Failures here are not fatal — we drop the bad image and keep going so
    // a single bad URL doesn't kill the whole generation.
    const productImageBlocks: Array<{ type: 'image_url'; image_url: { url: string } }> = [];
    for (const url of rawProductUrls) {
      try {
        const dataUri = await imageUrlToBase64(url);
        productImageBlocks.push({ type: 'image_url', image_url: { url: dataUri } });
      } catch (err: any) {
        log(`Step 2: skipping product image (fetch failed: ${err.message}) — ${url}`);
      }
    }

    log(`Step 2: sending ${productImageBlocks.length}/${rawProductUrls.length} product images to ${analysisModel}`);

    const userContent: any[] = [
      {
        type: 'text',
        text: productImageBlocks.length > 0
          ? `Attached are ${productImageBlocks.length} photo(s) of the user's product. Use them to describe the product's actual shape, packaging, color and label in the adapted JSON. Return ONLY the adapted JSON.`
          : 'No product photos were available for this run — adapt the template JSON using only the product info text below.',
      },
      ...productImageBlocks,
    ];

    const messages: GeminiMessage[] = [
      { role: 'developer', content: adaptationSystemPrompt },
      { role: 'user', content: userContent },
    ];

    const { text, modelUsed, fellBack } = await analyzeWithFallback(analysisModel, messages, {
      temperature: 0.4,
      maxTokens: 4000,
    });
    if (fellBack) log(`Step 2 fell back to ${modelUsed}`);

    inputData.adaptedJson = parseJsonFromResponse(text);

    // Persist step-2 progress so concurrent ticks skip and so the
    // distribution loop at the end is no longer the only persistence point.
    await updateGeneration(leader.id, {
      input_data: {
        ...leader.input_data,
        templateAnalysisJson: inputData.templateAnalysisJson,
        adaptedJson: inputData.adaptedJson,
        modelUsedAnalysis: inputData.modelUsedAnalysis,
        templateAspectRatio: inputData.templateAspectRatio,
        templateDims: inputData.templateDims,
      },
    });
  }

  // STEP 3 — The Nano Banana prompt IS the adapted JSON, verbatim.
  // No wrapping text, no instructions — Gemini already structured every
  // visual decision in step 2 and the user wants Nano Banana to receive
  // the JSON unmodified. Aspect ratio + image_input are passed via the
  // request body in step 4, not as text in the prompt.
  if (!inputData.variationPrompts || inputData.variationPrompts.length < VARIATIONS_PER_TEMPLATE) {
    log('Step 3: Nano Banana prompt = adapted JSON (raw)');
    const adaptedJsonString = JSON.stringify(inputData.adaptedJson, null, 2);
    inputData.variationPrompts = Array.from({ length: VARIATIONS_PER_TEMPLATE }, (_, i) => ({
      angle: `VARIATION_${i + 1}`,
      title: inputData.productName || 'Product ad',
      prompt: adaptedJsonString,
    }));
  }

  // Persist shared results into all sibling rows (including leader).
  // Each row gets only ITS variation prompt under generatedPrompt for downstream code.
  log(`Step 3 complete. Distributing prompts to ${allRows.length} variation rows...`);
  await Promise.all(
    allRows.map((row) => {
      const idx = (row.input_data?.variationIndex || 1) - 1;
      const variation = inputData.variationPrompts[idx] || inputData.variationPrompts[0];
      return updateGeneration(row.id, {
        status: 'pending_generation',
        input_data: {
          ...row.input_data,
          templateAnalysisJson: inputData.templateAnalysisJson,
          adaptedJson: inputData.adaptedJson,
          variationPrompts: inputData.variationPrompts,
          variationAngle: variation?.angle || `VARIATION_${idx + 1}`,
          variationTitle: variation?.title || '',
          generatedPrompt: variation?.prompt || '',
          modelUsedAnalysis: inputData.modelUsedAnalysis || analysisModel,
          templateAspectRatio: inputData.templateAspectRatio,
          templateDims: inputData.templateDims,
        },
      });
    })
  );
}

// --- Per-variation generation (steps 4 & 5) ---------------------------

async function processVariationGeneration(gen: any, generationModel: string, projectId: string): Promise<void> {
  const id = gen.id;
  let inputData = { ...gen.input_data };
  const log = (m: string) => console.log(`[GEN ${id.slice(0, 8)} v${inputData.variationIndex}] ${m}`);

  try {
    // STEP 4 — Create Nano Banana task -----------------------------------
    // INVARIANT: image_input is the USER'S product photos, NEVER the template
    // thumbnail. The template's visual style was already encoded into the
    // adapted JSON in step 2; sending the template image here would confuse
    // Nano Banana into reproducing the template's product instead of the
    // user's. Only `productImages` (or the legacy `productImage` fallback)
    // should ever flow into image_input.
    if (gen.status === 'pending_generation' && inputData.generatedPrompt && !inputData.generationTaskId) {
      // Atomic claim — same pattern as the Gemini steps. Without this, two
      // overlapping ticks each see status=pending_generation + no task ID and
      // both call createKieTask, ending up with two Nano Banana jobs (one of
      // which becomes orphaned).
      const { data: claim4 } = await supabaseAdmin
        .from('generations')
        .update({ status: 'generating', updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('status', 'pending_generation')
        .select('id')
        .maybeSingle();
      if (!claim4) {
        log('Step 4: skipped — already claimed by another tick');
        return;
      }
      log('Step 4: claimed → Creating Nano Banana task...');

      const allImages: string[] = inputData.productImages || (inputData.productImage ? [inputData.productImage] : []);
      const imageInputs = allImages.slice(0, 8).filter((url: string) => typeof url === 'string' && url.startsWith('http'));

      // Aspect ratio is detected from the template thumbnail in step 1 and
      // propagated to every sibling row, so each generated image matches the
      // original template's framing instead of being hard-coded to 3:4.
      const aspectRatio = (inputData.templateAspectRatio || '3:4') as NanoBananaInput['aspect_ratio'];
      log(`Step 4: aspect=${aspectRatio} (template ${inputData.templateDims?.width || '?'}×${inputData.templateDims?.height || '?'})`);

      const nanoBananaInput: NanoBananaInput = {
        prompt: inputData.generatedPrompt,
        image_input: imageInputs,
        aspect_ratio: aspectRatio,
        resolution: '2K',
        output_format: 'png',
      };

      const taskId = await createKieTask(generationModel, nanoBananaInput);
      inputData.generationTaskId = taskId;
      await updateGeneration(id, { input_data: inputData });
      log(`Step 4 done. taskId=${taskId}`);
      return; // poll on next tick
    }

    // STEP 5 — Poll for result -------------------------------------------
    if (gen.status === 'generating' && inputData.generationTaskId) {
      log('Step 5: Polling kie.ai for result...');
      const result = await getKieTaskResult(inputData.generationTaskId);

      if (result.status === 'SUCCESS') {
        let resultUrl = '';
        if (typeof result.result === 'string') resultUrl = result.result;
        else if (Array.isArray(result.result)) resultUrl = result.result[0];
        else if (result.result?.url) resultUrl = result.result.url;
        else if (result.result?.output) {
          resultUrl = Array.isArray(result.result.output) ? result.result.output[0] : result.result.output;
        }
        if (!resultUrl) throw new Error('No result URL in kie.ai response');
        log('SUCCESS — saving image...');
        await saveResult(id, resultUrl, projectId);
      } else if (result.status === 'FAILED') {
        throw new Error(result.error || 'Generation failed in kie.ai');
      }
      // PENDING/PROCESSING — handled on next tick
    }
  } catch (error: any) {
    console.error(`[GEN ${id.slice(0, 8)}] Error:`, error.message);
    await failGeneration(id, error.message);
  }
}

// --- Orchestrator ------------------------------------------------------

export async function POST(req: Request) {
  try {
    console.log('[PROCESS-QUEUE] Tick start');

    const cronSecret = process.env.CRON_SECRET;
    const isCron = !!cronSecret && req.headers.get('authorization') === `Bearer ${cronSecret}`;

    if (!isCron) {
      const { userId } = await auth();
      if (!userId) return new NextResponse('Unauthorized', { status: 401 });
    }

    const { projectId } = await req.json();
    if (!projectId) return new NextResponse('Missing projectId', { status: 400 });

    // Reset rows that are stuck in a transient analysis state for >2 min.
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    await supabaseAdmin
      .from('generations')
      .update({ status: 'pending_analysis', updated_at: new Date().toISOString() })
      .eq('project_id', projectId)
      .in('status', ['analyzing', 'adapting', 'generating_prompt'])
      .lt('updated_at', twoMinutesAgo);

    // Fetch every non-terminal row in this project.
    const { data: generations, error } = await supabaseAdmin
      .from('generations')
      .select('*')
      .eq('project_id', projectId)
      .in('status', [
        'pending_analysis',
        'pending_variation',
        'analyzing',
        'adapting',
        'generating_prompt',
        'pending_generation',
        'generating',
      ]);

    if (error) throw error;
    if (!generations || generations.length === 0) {
      return await returnProgress(projectId);
    }

    console.log(`[PROCESS-QUEUE] ${generations.length} active rows, statuses=${[...new Set(generations.map((g: any) => g.status))].join(',')}`);

    const { analysisModel, generationModel } = await getKieModelConfig();
    console.log(`[PROCESS-QUEUE] models: analysis=${analysisModel}, generation=${generationModel}`);

    // Group by templateId so the leader can run the shared analysis steps.
    const byTemplate = new Map<string, any[]>();
    for (const gen of generations as any[]) {
      const tid = gen.input_data?.templateId || 'unknown';
      if (!byTemplate.has(tid)) byTemplate.set(tid, []);
      byTemplate.get(tid)!.push(gen);
    }

    // Phase A — for each template that hasn't finished shared analysis yet,
    // run the leader's shared steps. Templates run in parallel.
    const sharedTasks: Promise<any>[] = [];
    for (const [, rows] of byTemplate) {
      const leader = rows.find((r) => (r.input_data?.variationIndex || 1) === 1) || rows[0];
      const siblings = rows.filter((r) => r.id !== leader.id);
      const sharedDone =
        leader.input_data?.variationPrompts &&
        Array.isArray(leader.input_data.variationPrompts) &&
        leader.input_data.variationPrompts.length >= VARIATIONS_PER_TEMPLATE;

      if (!sharedDone && ['pending_analysis', 'analyzing', 'adapting', 'generating_prompt'].includes(leader.status)) {
        sharedTasks.push(
          runSharedAnalysisForTemplate(leader, siblings, analysisModel).catch((err) => {
            console.error(`[PROCESS-QUEUE] Shared analysis failed for template ${leader.input_data?.templateId}:`, err.message);
            // Mark every row of this template as failed so the user sees the error.
            return Promise.all([leader, ...siblings].map((r) => failGeneration(r.id, `Shared analysis failed: ${err.message}`)));
          })
        );
      }
    }
    if (sharedTasks.length > 0) {
      await Promise.allSettled(sharedTasks);
    }

    // Phase B — every row that is pending_generation or generating proceeds independently.
    // Refetch after Phase A so we pick up newly-distributed prompts.
    const { data: refreshed } = await supabaseAdmin
      .from('generations')
      .select('*')
      .eq('project_id', projectId)
      .in('status', ['pending_generation', 'generating']);

    if (refreshed && refreshed.length > 0) {
      // Concurrency-limited fan-out: max 10 parallel tasks against kie.ai per tick.
      const MAX_PARALLEL = 10;
      for (let i = 0; i < refreshed.length; i += MAX_PARALLEL) {
        const batch = refreshed.slice(i, i + MAX_PARALLEL);
        await Promise.allSettled(batch.map((g: any) => processVariationGeneration(g, generationModel, projectId)));
      }
    }

    return await returnProgress(projectId);
  } catch (error: any) {
    console.error('[PROCESS-QUEUE] Fatal:', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}

async function returnProgress(projectId: string) {
  const { data: allGens } = await supabaseAdmin
    .from('generations')
    .select('status')
    .eq('project_id', projectId);

  const counts: Record<string, number> = {
    pending_analysis: 0,
    pending_variation: 0,
    analyzing: 0,
    adapting: 0,
    generating_prompt: 0,
    pending_generation: 0,
    generating: 0,
    completed: 0,
    failed: 0,
  };
  allGens?.forEach((g: any) => {
    if (g.status in counts) counts[g.status]++;
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
      details: counts,
    },
  });
}
