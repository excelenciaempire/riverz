-- Display currency preference + per-model Kie costs
-- Applied via Supabase Management API on 2026-05-02.

-- 1. admin_config: display mode + conversion rate -----------------------------

INSERT INTO admin_config (key, value, description)
VALUES
  ('display_currency_mode', 'credits',
   'Modo de visualización para precios y consumos en el admin: "credits" o "usd". Son equivalentes — sólo afecta cómo se muestran los números.'),
  ('credit_usd_rate', '0.01',
   'Equivalencia 1 crédito = X USD. Default 0.01 ⇒ 100 créditos = $1.00 USD. Se usa para convertir a USD cuando display_currency_mode = "usd".')
ON CONFLICT (key) DO NOTHING;

-- 2. kie_model_pricing: USD que paga Riverz a Kie por cada combinación tarea+modelo

CREATE TABLE IF NOT EXISTS kie_model_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_mode text NOT NULL,                    -- coincide con pricing_config.mode
  provider text NOT NULL DEFAULT 'kie',
  model_name text NOT NULL,                   -- id técnico del modelo
  model_label text NOT NULL,                  -- nombre legible
  usd_cost numeric(10, 4) NOT NULL DEFAULT 0,
  is_default boolean NOT NULL DEFAULT false,  -- modelo por defecto para esa tarea
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_mode, model_name)
);

CREATE INDEX IF NOT EXISTS idx_kie_model_pricing_task_mode
  ON kie_model_pricing (task_mode);

ALTER TABLE kie_model_pricing ENABLE ROW LEVEL SECURITY;

-- Sólo service role escribe; lectura para admins se hace vía API server-side.
DROP POLICY IF EXISTS "service role full access" ON kie_model_pricing;
CREATE POLICY "service role full access" ON kie_model_pricing
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 3. Seed con costos conocidos / placeholders editables ----------------------

INSERT INTO kie_model_pricing (task_mode, model_name, model_label, usd_cost, is_default, notes)
VALUES
  -- Static Ads (Nano Banana Pro confirmado en docs internos)
  ('static_ad_generation', 'nano-banana-pro', 'Nano Banana Pro', 0.1340, true,
   'Confirmado: ~$0.134 por imagen 2K.'),
  ('static_ad_edit',       'nano-banana-pro', 'Nano Banana Pro', 0.1340, true, NULL),

  -- Editar Foto
  ('editar_foto_crear',      'nano-banana-pro', 'Nano Banana Pro', 0.1340, true, NULL),
  ('editar_foto_editar',     'nano-banana-pro', 'Nano Banana Pro', 0.1340, true, NULL),
  ('editar_foto_combinar',   'nano-banana-pro', 'Nano Banana Pro', 0.1340, true, NULL),
  ('editar_foto_clonar',     'nano-banana-pro', 'Nano Banana Pro', 0.1340, true, NULL),
  ('editar_foto_draw_edit',  'nano-banana-pro', 'Nano Banana Pro', 0.1340, true, NULL),

  -- Mejorar Calidad
  ('mejorar_calidad_imagen', 'topaz-photo-ai', 'Topaz Photo AI',   0.0500, true,
   'Placeholder editable: actualizar con costo real de Kie.'),
  ('mejorar_calidad_video',  'topaz-video-ai', 'Topaz Video AI',   0.5000, true,
   'Placeholder editable: actualizar con costo real de Kie.'),

  -- UGC y Clips (varios modelos posibles)
  ('ugc',   'sora-2',       'Sora 2',           2.5000, true,
   'Placeholder editable: actualizar con costo real por video.'),
  ('ugc',   'kling-2-5',    'Kling 2.5',        1.0000, false,
   'Placeholder editable.'),
  ('clips', 'sora-2',       'Sora 2',           2.5000, true, 'Placeholder editable.'),
  ('clips', 'kling-2-5',    'Kling 2.5',        1.0000, false, 'Placeholder editable.'),

  -- Face Swap
  ('face_swap', 'wan-2-5-animate', 'Wan 2.5 Animate', 0.8000, true,
   'Placeholder editable: actualizar con costo real por face swap.'),

  -- Static Ads · Ideación (LLM, no genera imagen)
  ('static_ads_ideacion', 'gemini-3-pro', 'Gemini 3 Pro', 0.0200, true,
   'Costo estimado por corrida de ideación (token-based). Editable.'),

  -- UGC chat
  ('ugc_chat', 'gemini-3-pro', 'Gemini 3 Pro', 0.0050, true,
   'Costo estimado por mensaje de chat. Editable.')
ON CONFLICT (task_mode, model_name) DO NOTHING;

-- 4. Trigger updated_at -------------------------------------------------------

CREATE OR REPLACE FUNCTION set_kie_model_pricing_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_kie_model_pricing_updated_at ON kie_model_pricing;
CREATE TRIGGER trg_kie_model_pricing_updated_at
  BEFORE UPDATE ON kie_model_pricing
  FOR EACH ROW EXECUTE FUNCTION set_kie_model_pricing_updated_at();
