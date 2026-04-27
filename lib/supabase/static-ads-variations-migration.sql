-- ================================================================
-- RIVERZ — STATIC ADS · 5 variations per template
-- Adds the 'pending_variation' status to generations.status check.
-- Already applied to znrabzpwgoiepcjyljdk on 2026-04-27. Idempotent.
-- ================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'generations_status_check'
      AND conrelid = 'public.generations'::regclass
  ) THEN
    ALTER TABLE generations DROP CONSTRAINT generations_status_check;
  END IF;
END $$;

ALTER TABLE generations
  ADD CONSTRAINT generations_status_check CHECK (
    status = ANY (ARRAY[
      'pending'::text,
      'pending_analysis'::text,
      'pending_variation'::text,
      'analyzing'::text,
      'adapting'::text,
      'generating_prompt'::text,
      'pending_generation'::text,
      'generating'::text,
      'processing'::text,
      'completed'::text,
      'failed'::text
    ])
  );
