import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
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

/**
 * Tolerant JSON extractor for Gemini responses.
 *
 * The system prompt says "Return ONLY the JSON object — no markdown fences,
 * no commentary, no surrounding text" but Gemini (especially in Spanish mode)
 * sometimes ignores it and prepends "Aquí tiene el JSON solicitado:" or wraps
 * the response in ```json ... ``` fences anyway. This parser strips both
 * preamble and postamble, finds the outermost `{...}` or `[...]` block by
 * brace-balancing, and parses that.
 */
function parseJsonFromResponse(response: string): any {
  let s = response.trim();

  // Strip markdown fences if present.
  if (s.startsWith('```json')) s = s.slice(7).trim();
  else if (s.startsWith('```')) s = s.slice(3).trim();
  if (s.endsWith('```')) s = s.slice(0, -3).trim();

  // If the model still added a preamble before the JSON, jump to the first
  // `{` or `[`. Track which one to find the matching closer.
  const firstBraceIdx = s.search(/[{[]/);
  if (firstBraceIdx < 0) {
    // No JSON-looking content at all — let JSON.parse throw the usual error.
    return JSON.parse(s);
  }
  s = s.slice(firstBraceIdx);

  // Walk the string to find the matching close brace, ignoring quoted
  // strings. This also strips any trailing chatter after the JSON.
  const opening = s[0];
  const closing = opening === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  let escape = false;
  let end = -1;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (escape) { escape = false; continue; }
    if (c === '\\') { escape = true; continue; }
    if (c === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (c === opening) depth++;
    else if (c === closing) {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }
  if (end > 0) s = s.slice(0, end + 1);

  return JSON.parse(s);
}

async function updateGeneration(id: string, updates: any) {
  await supabaseAdmin
    .from('generations')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);
}

// --- Per-step audit log -------------------------------------------------
//
// Each entry captures EXACTLY what kie.ai received in a given step so the
// admin dashboard can verify visually + cryptographically that the right
// prompt and the right images were sent. Entries live inside input_data
// under the `stepLogs` array so no schema migration is needed.
//
// Why hashes? The base64 payloads sent to kie.ai are too big to log raw,
// but a sha256 + byte length uniquely identifies the bytes that left the
// server. The admin can compare with the hash of the source image in
// Supabase Storage to confirm no corruption / wrong image leak.
type StepImageLog = { url: string; sha256?: string; bytes?: number };
type StepLogEntry = {
  step: number;
  status: 'ok' | 'error';
  startedAt: string;
  completedAt: string;
  model: string;
  promptSent: string;
  imagesSent: StepImageLog[];
  outputPreview?: string;
  errorMessage?: string;
};

function hashFromBase64(dataUri: string): { sha256: string; bytes: number } {
  const raw = dataUri.split(',')[1] || dataUri;
  const buf = Buffer.from(raw, 'base64');
  return { sha256: createHash('sha256').update(buf).digest('hex'), bytes: buf.length };
}

/**
 * Append a step audit entry to a generation row's input_data.stepLogs.
 *
 * Mutates the in-memory `mutableInputData` so subsequent persistence calls
 * in the same flow carry the entry forward, AND immediately writes the
 * full input_data to the DB so the entry survives even if a later step
 * crashes before its own persistence point.
 */
async function appendStepLog(rowId: string, mutableInputData: any, entry: StepLogEntry): Promise<void> {
  if (!Array.isArray(mutableInputData.stepLogs)) mutableInputData.stepLogs = [];
  // Cap large fields so input_data stays bounded per row.
  const capped: StepLogEntry = {
    ...entry,
    promptSent: (entry.promptSent || '').slice(0, 20000),
    outputPreview: entry.outputPreview ? entry.outputPreview.slice(0, 2000) : undefined,
  };
  mutableInputData.stepLogs.push(capped);
  await supabaseAdmin
    .from('generations')
    .update({ input_data: mutableInputData, updated_at: new Date().toISOString() })
    .eq('id', rowId);
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

// Max retries before a step is considered terminally failed. Each step
// keeps its own counter on input_data (step1Retries / step2Retries /
// step4Retries) so a transient LLM hiccup on Step 2 only consumes the
// Step 2 budget — Step 1's success is preserved.
const MAX_STEP_RETRIES = 4;

/**
 * Soft-fail helper for the shared analysis steps. If a step fails AFTER
 * earlier steps already succeeded, we don't blanket-fail the row — we
 * revert it to a retryable status with an incremented retry counter so the
 * next process-queue tick can re-attempt JUST that step (potentially with
 * a different LLM via the fallback chain) WITHOUT re-running the steps
 * that already succeeded. The work is preserved in input_data.
 *
 * Only after MAX_STEP_RETRIES does the row get marked as terminally failed.
 */
async function softRetryOrFail(opts: {
  rowId: string;
  currentInputData: any;
  retryKey: 'step1Retries' | 'step2Retries' | 'step4Retries';
  retryStatus: 'pending_analysis' | 'pending_generation';
  errorMessage: string;
  log: (msg: string) => void;
}): Promise<void> {
  const { rowId, currentInputData, retryKey, retryStatus, errorMessage, log } = opts;
  const retries = (currentInputData[retryKey] || 0) + 1;
  if (retries > MAX_STEP_RETRIES) {
    log(`${retryKey}: ${retries - 1} retries exhausted, marking failed: ${errorMessage}`);
    await failGeneration(rowId, `${retryKey} exhausted: ${errorMessage}`);
    return;
  }
  log(`${retryKey}: attempt ${retries}/${MAX_STEP_RETRIES} failed (${errorMessage}), will retry on next tick`);
  await supabaseAdmin
    .from('generations')
    .update({
      status: retryStatus,
      error_message: `Retry ${retries}/${MAX_STEP_RETRIES}: ${errorMessage}`.slice(0, 500),
      input_data: { ...currentInputData, [retryKey]: retries },
      updated_at: new Date().toISOString(),
    })
    .eq('id', rowId);
}

/**
 * Steps 1-3 for a template. Runs on the leader generation (variation_index=1)
 * and writes the resulting JSONs + assigned prompt into ALL siblings.
 *
 * Failure semantics (per the owner's spec): each step is independent. If
 * Step 2 fails after Step 1 succeeded, the row stays in a retryable state
 * with Step 1's analysis JSON preserved — the next tick re-attempts ONLY
 * Step 2 (with the LLM fallback chain) using Step 1's existing output.
 * Same for Step 4.
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

    try {
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

    // Only the admin-edited system prompt + the template image. No extra
    // user-role hint — the system prompt is self-contained and any extra
    // text was just duplicating instructions.
    const messages: GeminiMessage[] = [
      { role: 'developer', content: analysisPrompt },
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: templateBase64 } },
        ],
      },
    ];

    log(`Step 1: sending 1 template image (${Math.round(templateBase64.length / 1024)}KB base64) to ${analysisModel}`);

    const step1StartedAt = new Date().toISOString();
    const step1ImagesSent: StepImageLog[] = [
      { url: inputData.templateThumbnail, ...hashFromBase64(templateBase64) },
    ];

    let step1Text = '';
    let step1ModelUsed = analysisModel;
    try {
      const { text, modelUsed, fellBack } = await analyzeWithFallback(analysisModel, messages, {
        temperature: 0.3,
        maxTokens: 4000,
      });
      if (fellBack) log(`Step 1 fell back to ${modelUsed}`);
      step1Text = text;
      step1ModelUsed = modelUsed;
    } catch (err: any) {
      await appendStepLog(leader.id, leader.input_data, {
        step: 1,
        status: 'error',
        startedAt: step1StartedAt,
        completedAt: new Date().toISOString(),
        model: analysisModel,
        promptSent: analysisPrompt,
        imagesSent: step1ImagesSent,
        errorMessage: err?.message || String(err),
      });
      throw err;
    }

    inputData.templateAnalysisJson = parseJsonFromResponse(step1Text);
    inputData.modelUsedAnalysis = step1ModelUsed;

    await appendStepLog(leader.id, leader.input_data, {
      step: 1,
      status: 'ok',
      startedAt: step1StartedAt,
      completedAt: new Date().toISOString(),
      model: step1ModelUsed,
      promptSent: analysisPrompt,
      imagesSent: step1ImagesSent,
      outputPreview: step1Text,
    });

    // Persist immediately so a concurrent tick (or a future restart) sees
    // the analysis JSON and skips re-running step 1. Without this, inputData
    // changes only land at the end of the function — meaning if step 2
    // crashes, we'd retry step 1 from scratch on the next tick.
    leader.input_data = {
      ...leader.input_data,
      templateAnalysisJson: inputData.templateAnalysisJson,
      modelUsedAnalysis: inputData.modelUsedAnalysis,
      templateAspectRatio: inputData.templateAspectRatio,
      templateDims: inputData.templateDims,
    };
    await updateGeneration(leader.id, { input_data: leader.input_data });
    } catch (err: any) {
      // Step 1 specifically failed. Soft-retry: revert to pending_analysis
      // with the Step 1 retry counter bumped. Step 1 hasn't produced
      // templateAnalysisJson yet, so on the next tick this branch re-enters
      // and re-runs the analysis from scratch with the LLM fallback chain.
      await softRetryOrFail({
        rowId: leader.id,
        currentInputData: leader.input_data,
        retryKey: 'step1Retries',
        retryStatus: 'pending_analysis',
        errorMessage: err?.message || 'Step 1 failed',
        log,
      });
      return;
    }
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

    try {
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
    const step2ImagesSent: StepImageLog[] = [];
    for (const url of rawProductUrls) {
      try {
        const dataUri = await imageUrlToBase64(url);
        productImageBlocks.push({ type: 'image_url', image_url: { url: dataUri } });
        step2ImagesSent.push({ url, ...hashFromBase64(dataUri) });
      } catch (err: any) {
        log(`Step 2: skipping product image (fetch failed: ${err.message}) — ${url}`);
      }
    }

    log(`Step 2: sending ${productImageBlocks.length}/${rawProductUrls.length} product images to ${analysisModel}`);

    // Only the admin-edited system prompt + the product images. No extra
    // user-role text — the system prompt already includes everything
    // (TEMPLATE_JSON, PRODUCT_NAME/DESC/BENEFITS/CATEGORY, RESEARCH_JSON
    // injected via {VAR} substitution) and any extra hint just duplicated
    // what's already there.
    const messages: GeminiMessage[] = [
      { role: 'developer', content: adaptationSystemPrompt },
      { role: 'user', content: productImageBlocks },
    ];

    const step2StartedAt = new Date().toISOString();
    let step2Text = '';
    let step2ModelUsed = analysisModel;
    try {
      const { text, modelUsed, fellBack } = await analyzeWithFallback(analysisModel, messages, {
        temperature: 0.4,
        maxTokens: 4000,
      });
      if (fellBack) log(`Step 2 fell back to ${modelUsed}`);
      step2Text = text;
      step2ModelUsed = modelUsed;
    } catch (err: any) {
      await appendStepLog(leader.id, leader.input_data, {
        step: 2,
        status: 'error',
        startedAt: step2StartedAt,
        completedAt: new Date().toISOString(),
        model: analysisModel,
        promptSent: adaptationSystemPrompt,
        imagesSent: step2ImagesSent,
        errorMessage: err?.message || String(err),
      });
      throw err;
    }

    inputData.adaptedJson = parseJsonFromResponse(step2Text);

    await appendStepLog(leader.id, leader.input_data, {
      step: 2,
      status: 'ok',
      startedAt: step2StartedAt,
      completedAt: new Date().toISOString(),
      model: step2ModelUsed,
      promptSent: adaptationSystemPrompt,
      imagesSent: step2ImagesSent,
      outputPreview: step2Text,
    });

    // Persist step-2 progress so concurrent ticks skip and so the
    // distribution loop at the end is no longer the only persistence point.
    leader.input_data = {
      ...leader.input_data,
      templateAnalysisJson: inputData.templateAnalysisJson,
      adaptedJson: inputData.adaptedJson,
      modelUsedAnalysis: inputData.modelUsedAnalysis,
      templateAspectRatio: inputData.templateAspectRatio,
      templateDims: inputData.templateDims,
    };
    await updateGeneration(leader.id, { input_data: leader.input_data });
    } catch (err: any) {
      // Step 2 failed but Step 1's templateAnalysisJson is preserved on the
      // row. Soft-retry: revert to pending_analysis (Step 1 will short-circuit
      // because templateAnalysisJson is set) so the next tick re-attempts
      // ONLY Step 2 with the existing analysis JSON, going through the LLM
      // fallback chain again.
      await softRetryOrFail({
        rowId: leader.id,
        currentInputData: leader.input_data,
        retryKey: 'step2Retries',
        retryStatus: 'pending_analysis',
        errorMessage: err?.message || 'Step 2 failed',
        log,
      });
      return;
    }
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
          // Steps 1+2 ran on the leader; copy its audit trail to siblings so
          // the admin can inspect any row and see what was actually sent.
          stepLogs: leader.input_data?.stepLogs || [],
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

      // Nano Banana receives URLs (not base64), so we log URL identity only.
      // The hash on steps 1-2 already proved which bytes left the server;
      // here, the same Supabase URLs flow straight through to kie.ai.
      const step4StartedAt = new Date().toISOString();
      const step4ImagesSent: StepImageLog[] = imageInputs.map((url: string) => ({ url }));

      try {
        const taskId = await createKieTask(generationModel, nanoBananaInput);
        inputData.generationTaskId = taskId;
        await appendStepLog(id, inputData, {
          step: 4,
          status: 'ok',
          startedAt: step4StartedAt,
          completedAt: new Date().toISOString(),
          model: generationModel,
          promptSent: nanoBananaInput.prompt,
          imagesSent: step4ImagesSent,
          outputPreview: `taskId=${taskId} aspect_ratio=${aspectRatio} resolution=2K`,
        });
        log(`Step 4 done. taskId=${taskId}`);
        return; // poll on next tick
      } catch (err: any) {
        // Step 4 failed (kie.ai task-creation hiccup, rate limit, etc.).
        // Soft-retry: the row keeps its `generatedPrompt` (which is the
        // adapted JSON from Step 2), so the next tick re-attempts ONLY
        // Step 4 by claiming pending_generation again. Steps 1-3 are
        // preserved.
        await appendStepLog(id, inputData, {
          step: 4,
          status: 'error',
          startedAt: step4StartedAt,
          completedAt: new Date().toISOString(),
          model: generationModel,
          promptSent: nanoBananaInput.prompt,
          imagesSent: step4ImagesSent,
          errorMessage: err?.message || 'Step 4 (Nano Banana) failed',
        });
        await softRetryOrFail({
          rowId: id,
          currentInputData: inputData,
          retryKey: 'step4Retries',
          retryStatus: 'pending_generation',
          errorMessage: err?.message || 'Step 4 (Nano Banana) failed',
          log,
        });
        return;
      }
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
        // kie.ai task itself failed terminally — no LLM swap helps. We
        // could re-create the task (Step 4 retry), so soft-retry instead
        // of marking failed. Drop the dead task ID so Step 4 re-claim
        // creates a fresh one.
        await softRetryOrFail({
          rowId: id,
          currentInputData: { ...inputData, generationTaskId: undefined },
          retryKey: 'step4Retries',
          retryStatus: 'pending_generation',
          errorMessage: result.error || 'kie.ai task FAILED',
          log,
        });
      }
      // PENDING/PROCESSING — handled on next tick
    }
  } catch (error: any) {
    // Outer safety net. Inner steps already self-retry via softRetryOrFail;
    // anything that bubbles up here is unexpected (DB outage, etc).
    console.error(`[GEN ${id.slice(0, 8)}] Unexpected error:`, error.message);
    await failGeneration(id, `Unexpected: ${error.message}`);
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
            // Inner steps already self-retry via softRetryOrFail. Anything
            // landing here is unexpected (DB outage / coding bug). Don't
            // blanket-fail rows — log and let the next tick try again.
            console.error(`[PROCESS-QUEUE] Unexpected error in shared analysis for template ${leader.input_data?.templateId}:`, err.message);
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
  const isComplete = inProgress === 0 && total > 0;

  // Sync the project's own status with the aggregate of its generations so
  // the historial list page shows "completed" instead of staying on "processing"
  // forever. Only flip when the run is fully done — don't overwrite a 'cancelled'
  // status mid-run.
  if (isComplete) {
    const projectStatus = failed > 0 && completed === 0 ? 'failed' : 'completed';
    await supabaseAdmin
      .from('projects')
      .update({ status: projectStatus })
      .eq('id', projectId)
      .neq('status', 'cancelled');
  }

  return NextResponse.json({
    success: true,
    progress: {
      total,
      completed,
      failed,
      inProgress,
      percentage,
      isComplete,
      details: counts,
    },
  });
}
