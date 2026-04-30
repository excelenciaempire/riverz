import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { FALLBACK_PROMPTS } from '@/lib/get-ai-prompt';
import { requireAdmin } from '@/lib/admin-auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Default prompts for the Static Ads pipeline.
// Active analysis model: Gemini 3 Pro (multimodal). Fallback: Gemini Flash 2.0.
// Each prompt is editable in the Admin Dashboard → Prompts IA tab.
//
// NOTE on the `variables` array: it's documentation-only. Text variables are
// substituted via {VAR_NAME} replacement before send. "Image variables"
// (prefixed with @ here, e.g. `@TEMPLATE_IMAGE`) are NOT substituted in the
// prompt text — they're attached as separate `image_url` content blocks in
// the same kie.ai request. The UI renders them with a different colour so
// admins can see at a glance what the model receives.
const DEFAULT_PROMPTS = [
  {
    key: 'product_deep_research',
    name: 'Deep Research de Producto',
    category: 'product_research',
    description: 'Paso 0 — Análisis psicológico profundo del buyer persona. Modelo: Gemini 3 Pro.',
    variables: ['PRODUCT_NAME', 'PRODUCT_DESCRIPTION', 'PRODUCT_PRICE', 'PRODUCT_BENEFITS', 'PRODUCT_CATEGORY', 'PRODUCT_WEBSITE', '@PRODUCT_IMAGES'],
    prompt_text: FALLBACK_PROMPTS.product_deep_research,
    is_active: true
  },
  {
    key: 'template_analysis_json',
    name: 'Static Ads · Paso 1 — Análisis JSON del Template',
    category: 'static_ads',
    description: 'Pipeline Static Ads. Paso 1: extrae el estilo visual + texto del template como JSON. Recibe la imagen del template adjunta. Modelo: Gemini 3 Pro con visión.',
    variables: ['@TEMPLATE_IMAGE'],
    prompt_text: FALLBACK_PROMPTS.template_analysis_json,
    is_active: true
  },
  {
    key: 'template_adaptation',
    name: 'Static Ads · Paso 2 — Adaptación al Producto',
    category: 'static_ads',
    description: 'Pipeline Static Ads. Paso 2: adapta el JSON del template al producto. Recibe el TEMPLATE_JSON, info del producto, research opcional, y las fotos del producto adjuntas como imágenes. Modelo: Gemini 3 Pro con visión.',
    variables: ['TEMPLATE_JSON', 'PRODUCT_NAME', 'PRODUCT_DESCRIPTION', 'PRODUCT_BENEFITS', 'PRODUCT_CATEGORY', 'RESEARCH_JSON', '@PRODUCT_IMAGES'],
    prompt_text: FALLBACK_PROMPTS.template_adaptation,
    is_active: true
  },
  {
    key: 'static_ads_5_variations_prompts',
    name: 'Static Ads · Generar 5 Prompts (Legacy)',
    category: 'static_ads',
    description: 'Versión antigua del Paso 3. El pipeline actual ya no llama a Gemini en este paso — el JSON adaptado se envía directo a Nano Banana. Mantenido sólo como referencia.',
    variables: ['ADAPTED_JSON', 'PRODUCT_NAME', 'RESEARCH_JSON'],
    prompt_text: FALLBACK_PROMPTS.static_ads_5_variations_prompts,
    is_active: false
  },
  {
    key: 'static_ads_prompt_generation',
    name: 'Static Ads · Generar Prompt Único (Legacy)',
    category: 'static_ads',
    description: 'Versión antigua que generaba 1 solo prompt a partir del JSON adaptado. Reemplazado por envío directo del JSON a Nano Banana.',
    variables: ['ADAPTED_JSON', 'PRODUCT_NAME'],
    prompt_text: FALLBACK_PROMPTS.static_ads_prompt_generation,
    is_active: false
  },
  {
    key: 'static_ads_edit_instructions',
    name: 'Static Ads · Edición con IA',
    category: 'static_ads',
    description: 'Aplica instrucciones de edición del usuario sobre una variación ya generada y produce un nuevo prompt para Nano Banana. Recibe la imagen original adjunta. Modelo: Gemini 3 Pro con visión.',
    variables: ['ORIGINAL_PROMPT', 'USER_EDIT_INSTRUCTIONS', 'PRODUCT_NAME', '@ORIGINAL_IMAGE'],
    prompt_text: FALLBACK_PROMPTS.static_ads_edit_instructions,
    is_active: true
  },
  {
    key: 'stealer_scene_prompt_generation',
    name: 'STEALER · Prompt por Escena',
    category: 'stealer',
    description: 'Pipeline STEALER. Por cada escena del video original, genera el prompt JSON para Veo 3.1 a partir del keyframe + transcripción. Modelo: Gemini 3 Pro con visión.',
    variables: ['SCENE_INDEX', 'SCENE_TYPE', 'SCENE_DURATION_SEC', 'SCENE_AUDIO_TEXT', 'PRODUCT_NAME', '@SCENE_KEYFRAME'],
    prompt_text: FALLBACK_PROMPTS.stealer_scene_prompt_generation,
    is_active: true
  },
  {
    key: 'template_analysis',
    name: 'Análisis de Plantilla (Legacy texto libre)',
    category: 'other',
    description: 'Versión vieja del análisis en texto libre — desactivada por defecto.',
    variables: ['@TEMPLATE_IMAGE'],
    prompt_text: FALLBACK_PROMPTS.template_analysis,
    is_active: false
  }
];

export async function POST(req: Request) {
  try {
    const guard = await requireAdmin();
    if (!guard.ok) {
      const status = guard.reason === 'unauthenticated' ? 401 : 403;
      return new NextResponse(guard.reason || 'Forbidden', { status });
    }
    console.log('[SEED-PROMPTS] admin:', guard.email);

    const results = {
      created: [] as string[],
      updated: [] as string[],
      errors: [] as string[]
    };

    for (const prompt of DEFAULT_PROMPTS) {
      // Check if prompt exists
      const { data: existing } = await supabase
        .from('ai_prompts')
        .select('id')
        .eq('key', prompt.key)
        .single();

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from('ai_prompts')
          .update({
            name: prompt.name,
            category: prompt.category,
            description: prompt.description,
            variables: prompt.variables,
            prompt_text: prompt.prompt_text,
            is_active: prompt.is_active,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id);

        if (error) {
          results.errors.push(`${prompt.key}: ${error.message}`);
        } else {
          results.updated.push(prompt.key);
        }
      } else {
        // Create new
        const { error } = await supabase
          .from('ai_prompts')
          .insert(prompt);

        if (error) {
          results.errors.push(`${prompt.key}: ${error.message}`);
        } else {
          results.created.push(prompt.key);
        }
      }
    }

    return NextResponse.json({
      success: true,
      results,
      message: `Creados: ${results.created.length}, Actualizados: ${results.updated.length}, Errores: ${results.errors.length}`
    });

  } catch (error: any) {
    console.error('[SEED-PROMPTS] Error:', error);
    return new NextResponse(error.message || 'Internal Error', { status: 500 });
  }
}
