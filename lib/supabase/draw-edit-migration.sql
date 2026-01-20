-- Migration to add draw-edit pricing configuration
-- ✅ ALREADY EXECUTED - 2026-01-17 23:08:07 UTC
-- Run this in Supabase SQL Editor if you need to re-run

-- Add draw-edit pricing configuration
INSERT INTO pricing_config (mode, credits_cost, is_active, description)
VALUES ('editar_foto_draw_edit', 100, true, 'Draw to Edit - Editor de imágenes con máscaras y IA')
ON CONFLICT (mode) DO UPDATE
SET credits_cost = 100, is_active = true, description = EXCLUDED.description, updated_at = NOW();

-- Verify the configuration
SELECT * FROM pricing_config WHERE mode = 'editar_foto_draw_edit';

-- Update existing generation types if needed
-- This ensures the generations table can handle draw-edit type
-- No schema changes needed if generations.type is already VARCHAR/TEXT
