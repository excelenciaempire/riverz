-- Re-categorise the edit-instructions prompt and mark the old clone-prompt
-- builder as legacy. The clone pipeline now ships the adapted JSON straight
-- to Nano Banana, so static_ads_clone is no longer invoked anywhere in the
-- code — and static_ads_edit_instructions belongs to its own image-edit
-- workflow, not to the clone pipeline.
--
-- Run from Supabase SQL Editor. Safe to re-run.

UPDATE ai_prompts
SET category = 'image_edit',
    name = 'Edición con IA · Generar prompt de re-edición',
    description = 'Workflow INDEPENDIENTE de la clonación. Aplica instrucciones de edición del usuario sobre una variación ya generada y produce un nuevo prompt para Nano Banana. Recibe la imagen original adjunta. Modelo: Gemini 3 Pro con visión.',
    updated_at = NOW()
WHERE key = 'static_ads_edit_instructions';

UPDATE ai_prompts
SET is_active = false,
    name = 'Static Ads · Clone Prompt Builder (Legacy)',
    description = 'Versión vieja del Paso 3: usaba a Gemini para construir un prompt natural-language a partir del template + producto. Reemplazado por el handoff directo del JSON adaptado a Nano Banana — el pipeline ya no lo invoca.',
    updated_at = NOW()
WHERE key = 'static_ads_clone';
