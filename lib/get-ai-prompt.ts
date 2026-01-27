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

  static_ads_clone_with_research: `Eres un experto en publicidad y generación de prompts para IA.

RESEARCH DEL PRODUCTO:
{RESEARCH_DATA}

PRODUCTO: {PRODUCT_NAME}
BENEFICIOS: {PRODUCT_BENEFITS}
TEMPLATE DE REFERENCIA: {TEMPLATE_NAME}

Tu objetivo es generar un prompt de imagen para "Nano Banana Pro" que:
1. Capture la esencia visual del template de referencia
2. Integre el producto de forma natural
3. Use las emociones y miedos del research para crear conexión
4. Mantenga el estilo visual publicitario del template

Genera SOLO el prompt de imagen, sin explicaciones. El prompt debe ser detallado, describiendo:
- Composición y encuadre
- Iluminación y atmósfera
- Ubicación del producto
- Elementos de fondo y contexto
- Estilo fotográfico (profesional, 8k, etc.)`,

  product_deep_research: `ROL Y OBJETIVO
Sos un analista de marketing de clase mundial con un entendimiento profundo del comportamiento del comprador. Sos el mejor del mundo descubriendo las VERDADERAS motivaciones de la gente para comprar productos, más allá de las razones superficiales.

Tu objetivo: Crear un perfil psicológico profundo del comprador ideal para {PRODUCT_NAME}.

INFORMACIÓN DEL PRODUCTO:
- Nombre: {PRODUCT_NAME}
- Descripción/Web: {PRODUCT_DESCRIPTION}
- Beneficios: {PRODUCT_BENEFITS}
- Audiencia objetivo: {TARGET_AUDIENCE}

INSTRUCCIONES:
Analiza el producto y genera un JSON con la siguiente estructura exacta:

{
  "producto": "nombre del producto",
  "perfil_demografico": {
    "avatar": "nombre descriptivo del comprador ideal",
    "descripcion": "descripción detallada del buyer persona",
    "edad": "rango de edad",
    "genero": "género predominante o ambos",
    "ubicacion": "tipo de ubicación (urbana/rural)",
    "nivel_socioeconomico": "nivel económico",
    "ocupacion": "ocupaciones típicas"
  },
  "problema_central": {
    "descripcion": "el problema principal que el producto resuelve",
    "impacto_vida_diaria": "cómo afecta su día a día",
    "emociones": ["emoción1", "emoción2", "emoción3"],
    "frustraciones": ["frustración1", "frustración2"]
  },
  "miedos_oscuros": {
    "descripcion": "los miedos profundos que tiene el comprador",
    "miedos": ["miedo1", "miedo2", "miedo3", "miedo4", "miedo5"],
    "consecuencias_temidas": "qué temen que pase si no actúan"
  },
  "deseos_profundos": {
    "descripcion": "lo que realmente desean lograr",
    "deseos": ["deseo1", "deseo2", "deseo3"],
    "estado_ideal": "cómo se imaginan después de usar el producto"
  },
  "lenguaje": {
    "palabras_clave": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
    "frases_comunes": ["frase que dirían", "otra frase"],
    "tono": "formal/informal/técnico/emocional"
  },
  "objeciones": {
    "principales": ["objeción1", "objeción2", "objeción3"],
    "respuestas": ["respuesta a objeción1", "respuesta a objeción2"]
  },
  "triggers_compra": {
    "emocionales": ["trigger1", "trigger2"],
    "racionales": ["trigger1", "trigger2"],
    "urgencia": "qué crea urgencia para comprar"
  }
}

IMPORTANTE: Responde SOLO con el JSON, sin texto adicional ni explicaciones.`,

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
