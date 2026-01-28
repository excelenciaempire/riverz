import { createClient } from '@/lib/supabase/server';

/**
 * Fetches an AI prompt from the database by key
 * @param key - Unique identifier for the prompt
 * @returns The prompt configuration or null if not found
 */
export async function getAIPrompt(key: string) {
  try {
    const supabase = await createClient();
    
    const { data: prompt, error } = await supabase
      .from('ai_prompts')
      .select('*')
      .eq('key', key)
      .eq('is_active', true)
      .single();

    if (error) {
      console.error(`[GET_AI_PROMPT] Error fetching prompt "${key}":`, error);
      return null;
    }

    return prompt;
  } catch (error) {
    console.error(`[GET_AI_PROMPT] Unexpected error for key "${key}":`, error);
    return null;
  }
}

/**
 * Fallback prompts if database is unavailable
 * These are the ONLY prompts used by the system - edit in Admin Dashboard to modify
 */
export const FALLBACK_PROMPTS = {
  // STATIC ADS - Main prompt for cloning templates with products
  static_ads_clone: `You are an expert AI image prompt engineer for e-commerce advertising. Your specialty is creating detailed prompts for the Nano Banana Pro image generation model.

TASK: Create a single, highly detailed image generation prompt.

CONTEXT:
- Product: {PRODUCT_NAME}
- Benefits: {PRODUCT_BENEFITS}
- Template style: {TEMPLATE_NAME}

You will receive product images and a template image. Your job is to:

1. ANALYZE the template image carefully:
   - Note the composition (layout, product placement, angles)
   - Study the lighting (direction, intensity, shadows)
   - Observe the color palette and mood
   - Identify the background style and elements

2. ANALYZE the product images:
   - Understand the exact product appearance
   - Note its colors, shape, textures, and details

3. CREATE a prompt that:
   - Recreates the EXACT style and composition of the template
   - Places the SPECIFIC product from the product images in the scene
   - Uses professional photography terminology
   - Includes technical details (8K, studio lighting, professional product photography)
   - Does NOT include any text or typography

OUTPUT FORMAT:
Write a single paragraph prompt in English, starting with the main subject and including all visual details. Be specific about lighting, angles, background, and product placement.

Example structure: "Professional product photography of [product] in [setting], [composition details], [lighting details], [background], [style], 8K resolution, commercial advertising quality"

OUTPUT ONLY THE PROMPT TEXT, nothing else.`
};

/**
 * Gets a prompt by key, with automatic fallback
 * @param key - Unique identifier for the prompt
 * @returns The prompt text
 */
export async function getPromptText(key: string): Promise<string> {
  const prompt = await getAIPrompt(key);
  
  if (prompt?.prompt_text) {
    return prompt.prompt_text;
  }
  
  // Fallback to hardcoded prompts
  const fallback = FALLBACK_PROMPTS[key as keyof typeof FALLBACK_PROMPTS];
  if (fallback) {
    console.warn(`[GET_PROMPT_TEXT] Using fallback prompt for key "${key}"`);
    return fallback;
  }
  
  throw new Error(`No prompt found for key "${key}" and no fallback available`);
}
