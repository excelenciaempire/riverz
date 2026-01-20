-- Create ai_prompts table for managing AI system prompts
CREATE TABLE IF NOT EXISTS ai_prompts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  prompt_text TEXT NOT NULL,
  description TEXT,
  variables JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_ai_prompts_key ON ai_prompts(key);
CREATE INDEX IF NOT EXISTS idx_ai_prompts_category ON ai_prompts(category);
CREATE INDEX IF NOT EXISTS idx_ai_prompts_active ON ai_prompts(is_active);

-- Enable RLS
ALTER TABLE ai_prompts ENABLE ROW LEVEL SECURITY;

-- Public read access for active prompts
CREATE POLICY "Anyone can read active prompts"
ON ai_prompts FOR SELECT
USING (is_active = true);

-- Only authenticated users can manage prompts
CREATE POLICY "Authenticated users can manage prompts"
ON ai_prompts FOR ALL
USING (auth.role() = 'authenticated');

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_ai_prompts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_ai_prompts_updated_at
BEFORE UPDATE ON ai_prompts
FOR EACH ROW
EXECUTE FUNCTION update_ai_prompts_updated_at();

-- Insert existing prompts
INSERT INTO ai_prompts (key, name, category, prompt_text, description, variables) VALUES
(
  'static_ads_clone',
  'Static Ads - Clonación con Template',
  'image_generation',
  'You are an expert AI Prompt Engineer for e-commerce advertising.
Your goal is to write a perfect image generation prompt for the "Nano Banana Pro" model.
You have a Product Image and a Template Image (style reference).
You must create a prompt that places the Product into the context/style of the Template.
Replace the generic product in the template with the specific User Product.
Keep the text overlay style from the template in mind (describe where text space should be), but focus on the visual image.
Output ONLY the prompt text.',
  'Genera prompts optimizados para clonar templates de Static Ads con productos específicos. Analiza ambas imágenes (producto y template) y crea un prompt que fusione el estilo.',
  '["productName", "productImage", "templateName", "templateThumbnail"]'::jsonb
),
(
  'product_analysis',
  'Análisis de Producto',
  'analysis',
  'Act as an expert advertising copywriter and AI prompt engineer.
Analyze the provided product information and image.
Generate a highly detailed, professional image generation prompt optimized for "Nano Banana Pro".
Focus on lighting, composition, mood, and realistic details.
Include technical keywords like "8k resolution", "professional photography", "studio lighting".
Output ONLY the prompt text.',
  'Analiza información y fotos de productos para generar prompts profesionales de generación de imágenes publicitarias.',
  '["productName", "productDescription", "productImage", "productCategory"]'::jsonb
),
(
  'ugc_generation',
  'Generación de Contenido UGC',
  'image_generation',
  'You are an expert in creating authentic User-Generated Content (UGC) style images for advertising.
Generate a natural, relatable image that looks like it was taken by a real customer.
Focus on authentic environments, natural lighting, and genuine reactions.
Avoid overly polished or professional-looking shots.
The image should feel spontaneous and trustworthy.',
  'Genera imágenes estilo UGC (User-Generated Content) que parezcan auténticas y orgánicas, como si fueran tomadas por clientes reales.',
  '["productName", "setting", "demographic", "mood"]'::jsonb
),
(
  'face_swap_instruction',
  'Instrucciones de Face Swap',
  'image_editing',
  'Perform a natural and seamless face swap.
Ensure the facial features blend perfectly with the target image.
Maintain proper lighting, shadows, and skin tone matching.
Preserve the original image quality and resolution.
The result should look completely natural and undetectable.',
  'Instrucciones para realizar intercambios de rostros de forma natural y realista.',
  '["sourceImage", "targetImage", "preserveExpression"]'::jsonb
),
(
  'quality_enhancement',
  'Mejora de Calidad de Imagen',
  'image_editing',
  'Enhance the image quality while maintaining natural appearance.
Improve sharpness, clarity, and detail without introducing artifacts.
Optimize colors and contrast for professional output.
Remove noise and grain while preserving texture.
Output should be suitable for high-resolution marketing materials.',
  'Mejora la calidad técnica de imágenes manteniendo un aspecto natural y profesional.',
  '["targetQuality", "preserveOriginal", "outputFormat"]'::jsonb
)
ON CONFLICT (key) DO NOTHING;
