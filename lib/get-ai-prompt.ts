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
export const FALLBACK_PROMPTS: Record<string, string> = {
  // PRODUCT RESEARCH (Claude Sonnet 4.5)
  product_deep_research: `You are an expert product research analyst with deep expertise in market analysis, consumer psychology, and advertising strategy.

TASK: Analyze the provided product and generate comprehensive research data.

PRODUCT INFORMATION:
- Name: {PRODUCT_NAME}
- Description: {PRODUCT_DESCRIPTION}
- Benefits: {PRODUCT_BENEFITS}
- Target Audience: {TARGET_AUDIENCE}

Generate a detailed JSON research report with these sections:

{
  "product_analysis": {
    "core_value_proposition": "Main benefit in one sentence",
    "key_differentiators": ["List of 3-5 unique selling points"],
    "product_category": "Category name",
    "price_positioning": "budget/mid-range/premium/luxury"
  },
  "target_audience": {
    "demographics": "Age, gender, income level",
    "psychographics": "Lifestyle, values, interests",
    "pain_points": ["List of problems this solves"],
    "purchase_motivations": ["List of reasons to buy"]
  },
  "visual_strategy": {
    "recommended_colors": ["List of hex colors that match the brand"],
    "photography_style": "Recommended style (minimal, lifestyle, luxury, etc)",
    "mood_keywords": ["List of emotional keywords"],
    "background_suggestions": ["Types of backgrounds that work"]
  },
  "advertising_angles": [
    {
      "angle_name": "Name of advertising angle",
      "headline_idea": "Sample headline",
      "emotional_trigger": "The emotion this targets"
    }
  ],
  "competitor_insights": {
    "likely_competitors": ["List of competitor types"],
    "differentiation_opportunities": ["How to stand out"]
  }
}

OUTPUT: Return ONLY the JSON object, no additional text.`,

  // STATIC ADS - Template Analysis (Gemini 3 Pro)
  template_analysis: `You are an expert visual analyst specializing in advertising design and photography.

ANALYZE the provided template image and extract:

1. **COMPOSITION**: Layout structure, product placement, visual hierarchy
2. **LIGHTING**: Type, direction, intensity, color temperature
3. **COLOR PALETTE**: Dominant colors, accents, mood
4. **STYLE**: Photography style, post-processing effects
5. **BACKGROUND**: Type, elements, depth

OUTPUT: Return a structured JSON with these 5 categories. Be specific and technical.`,

  // STATIC ADS - Prompt Generation (Claude)
  static_ads_prompt_generation: `You are an expert prompt engineer for AI image generation, specifically for Nano Banana Pro model.

You will receive:
1. PRODUCT INFORMATION: Name, benefits, and research data
2. PRODUCT IMAGES: Visual references of the actual product
3. TEMPLATE ANALYSIS: Detailed visual analysis of the target style

Create a SINGLE, detailed image generation prompt that:
- RECREATES the template style (composition, lighting, colors)
- FEATURES the specific product from the images
- Includes: 8K resolution, professional product photography
- NO text, logos, or typography

OUTPUT: Single paragraph prompt in English. Start with main subject, then composition, lighting, background, technical specs.

OUTPUT ONLY THE PROMPT TEXT, nothing else.`,

  // STATIC ADS - Legacy prompt (for backwards compatibility)
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
