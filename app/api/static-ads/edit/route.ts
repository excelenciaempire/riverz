import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { 
  createKieTask, 
  getKieTaskResult,
  analyzeWithClaudeSonnet,
  imageUrlToBase64,
  stripBase64Prefix,
  downloadImage,
  pollKieTaskUntilComplete,
  GeminiMessage,
  NanoBananaInput
} from '@/lib/kie-client';
import { getPromptWithVariables } from '@/lib/get-ai-prompt';

export const runtime = 'nodejs';
export const maxDuration = 180; // 3 minutes for edit process
export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Edit an existing generated image
 * 
 * Flow:
 * 1. User provides edit instructions (in Spanish)
 * 2. Claude creates a modified prompt based on original + instructions
 * 3. Nano Banana Pro generates a new image
 * 4. Save as new version
 */

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return new NextResponse('Unauthorized', { status: 401 });

    const { generationId, editInstructions } = await req.json();
    
    if (!generationId) {
      return new NextResponse('Missing generationId', { status: 400 });
    }
    if (!editInstructions || editInstructions.trim().length === 0) {
      return new NextResponse('Missing editInstructions', { status: 400 });
    }

    // 1. Fetch the original generation
    const { data: generation, error: genError } = await supabaseAdmin
      .from('generations')
      .select('*')
      .eq('id', generationId)
      .single();

    if (genError || !generation) {
      return new NextResponse('Generation not found', { status: 404 });
    }

    // 2. Get original data
    const {
      generatedPrompt,
      productName,
      productImages,
      productImage,
      templateName
    } = generation.input_data || {};

    const currentImageUrl = generation.result_url;
    
    if (!currentImageUrl) {
      return new NextResponse('Original image not found', { status: 400 });
    }

    if (!generatedPrompt) {
      return new NextResponse('Original prompt not found', { status: 400 });
    }

    console.log(`[EDIT] Starting edit for generation ${generationId}`);
    console.log(`[EDIT] Instructions: ${editInstructions}`);

    // 3. Get the edit prompt template
    const editPromptTemplate = await getPromptWithVariables('static_ads_edit_instructions', {
      ORIGINAL_PROMPT: generatedPrompt,
      USER_EDIT_INSTRUCTIONS: editInstructions,
      PRODUCT_NAME: productName || 'Product',
      TEMPLATE_NAME: templateName || 'Template'
    });

    // 4. Convert current image to base64
    const currentImageBase64 = await imageUrlToBase64(currentImageUrl);

    // 5. Build Claude messages
    const messages: GeminiMessage[] = [
      { role: 'developer', content: editPromptTemplate },
      { 
        role: 'user', 
        content: [
          { type: 'text', text: 'Based on the original prompt and edit instructions, generate the modified prompt.' },
          { type: 'image_url', image_url: { url: currentImageBase64 } }
        ]
      }
    ];

    // 6. Call Claude to generate modified prompt
    console.log('[EDIT] Calling Claude for modified prompt...');
    const modifiedPrompt = await analyzeWithClaudeSonnet(messages, {
      temperature: 0.7,
      maxTokens: 4096
    });

    console.log(`[EDIT] Modified prompt: ${modifiedPrompt.substring(0, 100)}...`);

    // 7. Prepare images for Nano Banana (current image + product images)
    const allProductImages: string[] = productImages || (productImage ? [productImage] : []);
    const imageInputs: string[] = [];

    // Add current image first (main reference)
    imageInputs.push(stripBase64Prefix(currentImageBase64));

    // Add product images (max 7 more)
    for (const imgUrl of allProductImages.slice(0, 7)) {
      if (imgUrl?.startsWith('http') && imageInputs.length < 8) {
        try {
          const dataUri = await imageUrlToBase64(imgUrl);
          imageInputs.push(stripBase64Prefix(dataUri));
        } catch (e) {
          console.log(`[EDIT] Could not convert product image: ${e}`);
        }
      }
    }

    // 8. Create Nano Banana task
    console.log('[EDIT] Creating Nano Banana task...');
    const nanoBananaInput: NanoBananaInput = {
      prompt: modifiedPrompt,
      image_input: imageInputs,
      aspect_ratio: '1:1',
      resolution: '2K',
      output_format: 'png'
    };

    const taskId = await createKieTask('nano-banana-pro', nanoBananaInput);
    console.log(`[EDIT] Task created: ${taskId}`);

    // 9. Poll for result
    const result = await pollKieTaskUntilComplete(taskId, {
      intervalMs: 5000,
      maxAttempts: 36, // 3 minutes max
      onProgress: (status, attempt) => {
        console.log(`[EDIT] Polling ${taskId}: ${status} (attempt ${attempt})`);
      }
    });

    if (result.status !== 'SUCCESS') {
      console.error('[EDIT] Generation failed:', result.error);
      return NextResponse.json({
        success: false,
        error: result.error || 'Image generation failed'
      }, { status: 500 });
    }

    // 10. Extract result URL
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

    if (!resultUrl) {
      return NextResponse.json({
        success: false,
        error: 'No result URL in response'
      }, { status: 500 });
    }

    // 11. Download and upload to our storage
    console.log('[EDIT] Downloading and uploading to storage...');
    const imageBuffer = await downloadImage(resultUrl);
    
    const fileName = `${generation.project_id}/${generationId}_edit_${Date.now()}.png`;
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('generations')
      .upload(fileName, imageBuffer, {
        contentType: 'image/png',
        upsert: true
      });

    let finalUrl = resultUrl;
    if (!uploadError && uploadData) {
      const { data: urlData } = supabaseAdmin.storage
        .from('generations')
        .getPublicUrl(fileName);
      finalUrl = urlData.publicUrl;
    }

    // 12. Get current version number
    const currentVersion = generation.version || 1;

    // 13. Create new generation record for the edited version
    const { data: newGeneration, error: insertError } = await supabaseAdmin
      .from('generations')
      .insert({
        project_id: generation.project_id,
        user_id: generation.user_id,
        type: 'static_ad',
        status: 'completed',
        result_url: finalUrl,
        parent_id: generationId, // Link to original
        version: currentVersion + 1,
        input_data: {
          ...generation.input_data,
          generatedPrompt: modifiedPrompt,
          editInstructions,
          previousVersionId: generationId
        }
      })
      .select()
      .single();

    if (insertError) {
      console.error('[EDIT] Failed to save new version:', insertError);
      // Still return success with the URL
      return NextResponse.json({
        success: true,
        resultUrl: finalUrl,
        modifiedPrompt,
        warning: 'Image created but version tracking failed'
      });
    }

    console.log(`[EDIT] Edit complete! New version ${currentVersion + 1}: ${finalUrl}`);

    return NextResponse.json({
      success: true,
      newGenerationId: newGeneration.id,
      resultUrl: finalUrl,
      modifiedPrompt,
      version: currentVersion + 1
    });

  } catch (error: any) {
    console.error('[EDIT] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Internal error'
    }, { status: 500 });
  }
}
