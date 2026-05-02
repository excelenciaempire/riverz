import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import {
  createKieTask,
  getKieTaskResult,
  getKieModelConfig,
  downloadImage,
  NanoBananaInput,
} from '@/lib/kie-client';
import { rateLimit, RATE_LIMITS } from '@/lib/security';
import { getUserAiSettings, getDecryptedGeminiKey } from '@/lib/ai-providers/router';
import { GeminiProvider } from '@/lib/ai-providers/gemini-provider';
import { ProviderError } from '@/lib/ai-providers/types';

export const runtime = 'nodejs';
export const maxDuration = 120;
export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Edit a generated static ad with AI
 * 
 * POST /api/static-ads/edit
 * Body: {
 *   generationId: string,
 *   editInstructions: string (in Spanish)
 * }
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return new NextResponse('Unauthorized', { status: 401 });

    const rl = await rateLimit(`static-ads-edit:${userId}`, RATE_LIMITS.generation.limit, RATE_LIMITS.generation.windowMs);
    if (!rl.success) {
      return NextResponse.json({ error: 'Demasiadas solicitudes. Intenta en un momento.' }, { status: 429 });
    }

    const body = await req.json();
    const { generationId, editInstructions } = body;

    if (!generationId) {
      return NextResponse.json({ error: 'Missing generationId' }, { status: 400 });
    }
    if (!editInstructions?.trim()) {
      return NextResponse.json({ error: 'Missing editInstructions' }, { status: 400 });
    }

    console.log(`[EDIT] Starting edit for ${generationId}`);

    // Fetch the original generation
    const { data: generation, error: fetchError } = await supabaseAdmin
      .from('generations')
      .select('*')
      .eq('id', generationId)
      .eq('clerk_user_id', userId)
      .single();

    if (fetchError || !generation) {
      return NextResponse.json({ error: 'Generation not found' }, { status: 404 });
    }

    if (generation.status !== 'completed' || !generation.result_url) {
      return NextResponse.json({ error: 'Can only edit completed generations' }, { status: 400 });
    }

    const { input_data, result_url, project_id } = generation;

    // Provider routing: if user picked Gemini and has a validated key, edit
    // through Gemini directly (sync, 0 credits). Otherwise the existing kie
    // flow is preserved untouched.
    const aiSettings = await getUserAiSettings(userId);
    const useGemini = aiSettings.ai_provider_primary === 'gemini' && aiSettings.has_gemini_key;

    // Check credits
    const { data: userCredits } = await supabaseAdmin
      .from('user_credits')
      .select('credits')
      .eq('clerk_user_id', userId)
      .single();

    const editCost = useGemini ? 0 : 14;
    if (!userCredits || userCredits.credits < editCost) {
      return NextResponse.json({ error: 'Insufficient credits' }, { status: 402 });
    }

    // Deduct credits (no-op when 0)
    if (editCost > 0) {
      await supabaseAdmin
        .from('user_credits')
        .update({ credits: userCredits.credits - editCost })
        .eq('clerk_user_id', userId);
    }

    // Direct image-edit pipeline:
    //   prompt      = the user's raw edit instructions (Spanish OK — Nano
    //                 Banana Pro handles multilingual edit instructions)
    //   image_input = ONLY the current generated result. We deliberately do
    //                 NOT pass the original product photos here — that used
    //                 to contaminate edits ("change background to black"
    //                 would sometimes regenerate the product instead). For a
    //                 targeted edit, the model only needs the canvas it is
    //                 editing.
    //
    // We also dropped the previous Gemini "rewrite the prompt" step. It
    // added 30–60s per edit and frequently lost the user's intent
    // (paraphrased "fondo negro" into a long English brief). Nano Banana
    // Pro is itself an image-editing model; passing the literal user
    // instruction in Spanish is what it expects.
    if (!result_url?.startsWith('http')) {
      return NextResponse.json({ error: 'Generation has no editable result image' }, { status: 400 });
    }

    const editAspect = (input_data?.templateAspectRatio || '1:1') as NanoBananaInput['aspect_ratio'];

    // ---- Gemini direct edit path -----------------------------------------
    // Sync call: build the row up front, call Gemini, save the inline base64
    // to Storage, return result. No polling.
    if (useGemini) {
      const apiKey = await getDecryptedGeminiKey(userId);
      if (!apiKey) {
        return NextResponse.json({ error: 'No Gemini API key on file' }, { status: 400 });
      }
      const provider = new GeminiProvider(apiKey);

      const currentVersion = generation.version || 1;
      const nextVersion = currentVersion + 1;

      const { data: newGen, error: insertErr } = await supabaseAdmin
        .from('generations')
        .insert({
          clerk_user_id: userId,
          type: 'static_ad_generation',
          status: 'generating',
          ai_provider: 'gemini',
          project_id: project_id,
          cost: editCost,
          version: nextVersion,
          parent_id: generationId,
          input_data: {
            ...input_data,
            generatedPrompt: editInstructions,
            editedFrom: generationId,
            editInstructions,
          },
        })
        .select()
        .single();
      if (insertErr || !newGen) {
        console.error('[EDIT-GEMINI] insert failed:', insertErr);
        return NextResponse.json({ error: 'Failed to create edit record' }, { status: 500 });
      }

      try {
        const result = await provider.editImage({
          sourceImageUrl: result_url,
          editInstructions,
          aspectRatio: editAspect as any,
        });
        const buf = Buffer.from(result.imageBase64, 'base64');
        const ext = result.mimeType === 'image/jpeg' ? 'jpg' : 'png';
        const fileName = `${project_id}/${newGen.id}_${Date.now()}.${ext}`;
        const { error: upErr } = await supabaseAdmin.storage
          .from('generations')
          .upload(fileName, buf, { contentType: result.mimeType, upsert: true });
        if (upErr) throw upErr;
        const { data: pub } = supabaseAdmin.storage.from('generations').getPublicUrl(fileName);

        await supabaseAdmin.from('generations').update({
          status: 'completed',
          result_url: pub.publicUrl,
          updated_at: new Date().toISOString(),
        }).eq('id', newGen.id);

        return NextResponse.json({
          success: true,
          newGenerationId: newGen.id,
          resultUrl: pub.publicUrl,
          version: nextVersion,
          prompt: editInstructions,
          provider: 'gemini',
        });
      } catch (err: any) {
        const isProvider = err instanceof ProviderError;
        const userMsg = isProvider ? err.userMessage : (err?.message || 'Gemini edit failed');
        await supabaseAdmin.from('generations').update({
          status: 'failed',
          error_message: userMsg.slice(0, 500),
          updated_at: new Date().toISOString(),
        }).eq('id', newGen.id);
        // editCost=0 on Gemini path, no refund needed
        return NextResponse.json({ error: userMsg }, { status: 500 });
      }
    }

    const { generationModel } = await getKieModelConfig();

    const nanoBananaInput: NanoBananaInput = {
      prompt: editInstructions,
      image_input: [result_url],
      aspect_ratio: editAspect,
      resolution: '2K',
      output_format: 'png',
    };

    console.log(`[EDIT] Sending direct edit to ${generationModel} (aspect=${editAspect}): "${editInstructions.slice(0, 80)}"`);

    const taskId = await createKieTask(generationModel, nanoBananaInput);
    console.log(`[EDIT] Task created: ${taskId}`);

    // Determine next version number
    const currentVersion = generation.version || 1;
    const nextVersion = currentVersion + 1;

    // Create a new generation record for the edit
    const { data: newGeneration, error: insertError } = await supabaseAdmin
      .from('generations')
      .insert({
        clerk_user_id: userId,
        type: 'static_ad_generation',
        status: 'generating',
        ai_provider: 'kie',
        project_id: project_id,
        cost: editCost,
        version: nextVersion,
        parent_id: generationId,
        input_data: {
          ...input_data,
          generatedPrompt: editInstructions,
          generationTaskId: taskId,
          editedFrom: generationId,
          editInstructions: editInstructions,
        },
      })
      .select()
      .single();

    if (insertError) {
      console.error('[EDIT] Failed to create generation record:', insertError);
      // Refund credits
      await supabaseAdmin
        .from('user_credits')
        .update({ credits: userCredits.credits })
        .eq('clerk_user_id', userId);
      return NextResponse.json({ error: 'Failed to create edit record' }, { status: 500 });
    }

    // Poll for result (with timeout)
    console.log(`[EDIT] Polling for result...`);
    const maxAttempts = 60;
    const pollInterval = 3000;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));

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
            // Download and upload to storage
            try {
              const imageBuffer = await downloadImage(resultUrl);
              const fileName = `${project_id}/${newGeneration.id}_${Date.now()}.png`;
              
              await supabaseAdmin.storage
                .from('generations')
                .upload(fileName, imageBuffer, { contentType: 'image/png', upsert: true });

              const { data: urlData } = supabaseAdmin.storage
                .from('generations')
                .getPublicUrl(fileName);

              resultUrl = urlData.publicUrl;
            } catch (e) {
              console.log(`[EDIT] Storage upload failed, using kie.ai URL: ${e}`);
            }

            // Update generation with result
            await supabaseAdmin.from('generations').update({
              status: 'completed',
              result_url: resultUrl,
              updated_at: new Date().toISOString()
            }).eq('id', newGeneration.id);

            console.log(`[EDIT] SUCCESS! Result: ${resultUrl}`);
            return NextResponse.json({
              success: true,
              newGenerationId: newGeneration.id,
              resultUrl,
              version: nextVersion,
              prompt: editInstructions,
            });
          }
        } else if (result.status === 'FAILED') {
          await supabaseAdmin.from('generations').update({
            status: 'failed',
            error_message: result.error || 'Generation failed',
            updated_at: new Date().toISOString()
          }).eq('id', newGeneration.id);

          // Refund credits on failure
          await supabaseAdmin
            .from('user_credits')
            .update({ credits: userCredits.credits })
            .eq('clerk_user_id', userId);

          return NextResponse.json({ 
            error: result.error || 'Generation failed' 
          }, { status: 500 });
        }
        // PENDING/PROCESSING - continue polling
      } catch (pollError: any) {
        console.error(`[EDIT] Poll error:`, pollError.message);
      }
    }

    // Timeout - mark as failed
    await supabaseAdmin.from('generations').update({
      status: 'failed',
      error_message: 'Generation timed out',
      updated_at: new Date().toISOString()
    }).eq('id', newGeneration.id);

    return NextResponse.json({ error: 'Generation timed out' }, { status: 504 });

  } catch (error: any) {
    console.error('[EDIT] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
