import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { FALLBACK_PROMPTS } from '@/lib/get-ai-prompt';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Default prompts configuration for Static Ads pipeline (Gemini Pro 3 + Nano Banana)
const DEFAULT_PROMPTS = [
  {
    key: 'product_deep_research',
    name: 'Deep Research de Producto',
    category: 'product_research',
    description: 'Análisis psicológico profundo del buyer persona. Gemini Pro 3.',
    variables: ['PRODUCT_NAME', 'PRODUCT_DESCRIPTION', 'PRODUCT_PRICE', 'PRODUCT_BENEFITS', 'PRODUCT_CATEGORY', 'PRODUCT_WEBSITE'],
    prompt_text: FALLBACK_PROMPTS.product_deep_research,
    is_active: true
  },
  {
    key: 'template_analysis_json',
    name: 'Análisis JSON de Template',
    category: 'template_analysis',
    description: 'Extrae estructura JSON detallada del template. Gemini Pro 3.',
    variables: [],
    prompt_text: FALLBACK_PROMPTS.template_analysis_json,
    is_active: true
  },
  {
    key: 'template_adaptation',
    name: 'Adaptación al Producto',
    category: 'template_adaptation',
    description: 'Adapta el JSON del template al producto específico. Gemini Pro 3.',
    variables: ['TEMPLATE_JSON', 'PRODUCT_NAME', 'PRODUCT_DESCRIPTION', 'PRODUCT_BENEFITS', 'PRODUCT_CATEGORY', 'RESEARCH_JSON'],
    prompt_text: FALLBACK_PROMPTS.template_adaptation,
    is_active: true
  },
  {
    key: 'static_ads_prompt_generation',
    name: 'Generación de Prompt Final',
    category: 'prompt_generation',
    description: 'Convierte JSON adaptado a prompt natural para Nano Banana. Gemini Pro 3.',
    variables: ['ADAPTED_JSON', 'PRODUCT_NAME'],
    prompt_text: FALLBACK_PROMPTS.static_ads_prompt_generation,
    is_active: true
  },
  {
    key: 'static_ads_edit_instructions',
    name: 'Edición con IA',
    category: 'editing',
    description: 'Procesa instrucciones de edición del usuario. Gemini Pro 3.',
    variables: ['ORIGINAL_PROMPT', 'USER_EDIT_INSTRUCTIONS', 'PRODUCT_NAME'],
    prompt_text: FALLBACK_PROMPTS.static_ads_edit_instructions,
    is_active: true
  },
  {
    key: 'template_analysis',
    name: 'Análisis de Plantilla (Legacy)',
    category: 'other',
    description: 'Análisis en texto libre - legacy, no usado en pipeline actual.',
    variables: [],
    prompt_text: FALLBACK_PROMPTS.template_analysis,
    is_active: false
  }
];

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return new NextResponse('Unauthorized', { status: 401 });

    // Skip admin check for now - user is authenticated
    console.log('[SEED-PROMPTS] User:', userId);

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
