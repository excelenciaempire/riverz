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
 */
export const FALLBACK_PROMPTS = {
  static_ads_clone: `You are an expert AI Prompt Engineer for e-commerce advertising.
Your goal is to write a perfect image generation prompt for the "Nano Banana Pro" model.
You have a Product Image and a Template Image (style reference).
You must create a prompt that places the Product into the context/style of the Template.
Replace the generic product in the template with the specific User Product.
Keep the text overlay style from the template in mind (describe where text space should be), but focus on the visual image.
Output ONLY the prompt text.`,

  product_analysis: `Act as an expert advertising copywriter and AI prompt engineer.
Analyze the provided product information and image.
Generate a highly detailed, professional image generation prompt optimized for "Nano Banana Pro".
Focus on lighting, composition, mood, and realistic details.
Include technical keywords like "8k resolution", "professional photography", "studio lighting".
Output ONLY the prompt text.`,

  ugc_generation: `You are an expert in creating authentic User-Generated Content (UGC) style images for advertising.
Generate a natural, relatable image that looks like it was taken by a real customer.
Focus on authentic environments, natural lighting, and genuine reactions.
Avoid overly polished or professional-looking shots.
The image should feel spontaneous and trustworthy.`,

  face_swap_instruction: `Perform a natural and seamless face swap.
Ensure the facial features blend perfectly with the target image.
Maintain proper lighting, shadows, and skin tone matching.
Preserve the original image quality and resolution.
The result should look completely natural and undetectable.`,

  quality_enhancement: `Enhance the image quality while maintaining natural appearance.
Improve sharpness, clarity, and detail without introducing artifacts.
Optimize colors and contrast for professional output.
Remove noise and grain while preserving texture.
Output should be suitable for high-resolution marketing materials.`
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
