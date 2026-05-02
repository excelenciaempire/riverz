-- ad_drafts: persistencia de la grilla Kitchn-style del paso "Editar copy"
-- Permite que el usuario cierre la pestaña y vuelva a editar 50 ads sin perder trabajo.
-- Aplicado vía Supabase Management API; idempotente.

CREATE TABLE IF NOT EXISTS ad_drafts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id TEXT NOT NULL,
  ad_account_id TEXT NOT NULL,
  name          TEXT NOT NULL,
  rows          JSONB NOT NULL DEFAULT '[]'::jsonb,
  status        TEXT NOT NULL DEFAULT 'draft',  -- draft | launching | launched | failed
  launched_at   TIMESTAMPTZ,
  result        JSONB,                          -- LaunchResponse al lanzar
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ad_drafts_user_account_idx
  ON ad_drafts (clerk_user_id, ad_account_id);

CREATE INDEX IF NOT EXISTS ad_drafts_updated_idx
  ON ad_drafts (clerk_user_id, updated_at DESC);
