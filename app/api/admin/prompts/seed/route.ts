import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { FALLBACK_PROMPTS } from '@/lib/get-ai-prompt';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Default prompts configuration for Static Ads pipeline
const DEFAULT_PROMPTS = [
  {
    key: 'product_deep_research',
    name: 'Deep Research de Producto',
    category: 'product_research',
    description: 'Análisis psicológico profundo del buyer persona basado en el producto. Usado por Claude Sonnet 4.5.',
    variables: ['PRODUCT_NAME', 'PRODUCT_DESCRIPTION', 'PRODUCT_PRICE', 'PRODUCT_BENEFITS', 'PRODUCT_CATEGORY', 'PRODUCT_WEBSITE'],
    prompt_text: FALLBACK_PROMPTS.product_deep_research,
    is_active: true
  },
  {
    key: 'template_analysis',
    name: 'Análisis de Plantilla',
    category: 'template_analysis',
    description: 'Análisis detallado del estilo visual de plantillas publicitarias. Usado por Gemini Flash 2.0.',
    variables: [],
    prompt_text: FALLBACK_PROMPTS.template_analysis,
    is_active: true
  },
  {
    key: 'static_ads_prompt_generation',
    name: 'Generación de Prompt para Imagen',
    category: 'prompt_generation',
    description: 'Genera instrucciones ultra-específicas para Nano Banana Pro combinando research, análisis de plantilla e info del producto. Usado por Claude Sonnet 4.5.',
    variables: ['PRODUCT_NAME', 'PRODUCT_DESCRIPTION', 'PRODUCT_BENEFITS', 'PRODUCT_PRICE', 'PRODUCT_CATEGORY', 'DEEP_RESEARCH_JSON', 'GEMINI_ANALYSIS_TEXT', 'TEMPLATE_NAME'],
    prompt_text: FALLBACK_PROMPTS.static_ads_prompt_generation,
    is_active: true
  },
  {
    key: 'static_ads_edit_instructions',
    name: 'Edición de Imágenes',
    category: 'prompt_generation',
    description: 'Procesa instrucciones de edición del usuario y genera un nuevo prompt modificado para Nano Banana Pro. Usado por Claude Sonnet 4.5.',
    variables: ['ORIGINAL_PROMPT', 'USER_EDIT_INSTRUCTIONS', 'PRODUCT_NAME', 'TEMPLATE_NAME'],
    prompt_text: FALLBACK_PROMPTS.static_ads_edit_instructions,
    is_active: true
  }
];

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return new NextResponse('Unauthorized', { status: 401 });

    // Check if user is admin
    const { data: user } = await supabase
      .from('users')
      .select('role')
      .eq('clerk_id', userId)
      .single();

    if (user?.role !== 'admin') {
      return new NextResponse('Forbidden', { status: 403 });
    }

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
