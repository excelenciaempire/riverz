-- ============================================================================
-- Landing Pages V2 — moves the Landing Lab from localStorage-only to a real
-- Supabase-backed model. Each page is a JSON document of section instances
-- (type + props), persisted server-side so every device sees the same state
-- and the new editor can autosave + version history without conflicts.
--
-- Also lands the supporting tables for: API key auth (so agencies can fill
-- pages programmatically), referral tracking ("invita y gana créditos"),
-- and Creative Studio folders.
-- ============================================================================

-- --------------------------------------------------------------------------
-- landing_pages — one row per page the user is building.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS landing_pages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clerk_user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'landing_page'
    CHECK (kind IN ('landing_page', 'product_page', 'listicle', 'advertorial')),
  -- Optional product binding so the AI fill step has product context.
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  -- The full page content: { sections: SectionInstance[], theme, meta }.
  -- See lib/sections/types.ts for the schema.
  document JSONB NOT NULL DEFAULT '{"sections":[],"theme":{},"meta":{}}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published')),
  thumbnail_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_landing_pages_user_updated
  ON landing_pages (clerk_user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_landing_pages_user_status
  ON landing_pages (clerk_user_id, status);

CREATE OR REPLACE FUNCTION landing_pages_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_landing_pages_touch ON landing_pages;
CREATE TRIGGER trg_landing_pages_touch
  BEFORE UPDATE ON landing_pages
  FOR EACH ROW EXECUTE FUNCTION landing_pages_touch_updated_at();

-- --------------------------------------------------------------------------
-- landing_page_versions — snapshot history (auto + manual).
-- 'auto' rows are written by the editor on a debounce; 'manual' rows are
-- written when the user clicks "Save Version" so they can be promoted/
-- restored deliberately.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS landing_page_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  page_id UUID NOT NULL REFERENCES landing_pages(id) ON DELETE CASCADE,
  document JSONB NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('auto', 'manual')),
  label TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_landing_page_versions_page_created
  ON landing_page_versions (page_id, created_at DESC);

-- --------------------------------------------------------------------------
-- api_keys — Bearer tokens for the public /api/v1/* routes. We only ever
-- store the bcrypt hash; the plaintext is shown to the user once at
-- creation. key_prefix is the first 12 chars (e.g. "rvz_live_ab12") so the
-- UI can display "rvz_live_ab12••••••••" without leaking secrets.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clerk_user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_api_keys_user
  ON api_keys (clerk_user_id) WHERE revoked_at IS NULL;

-- Lookup path the auth middleware uses on every /api/v1 hit.
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix_active
  ON api_keys (key_prefix) WHERE revoked_at IS NULL;

-- --------------------------------------------------------------------------
-- referrals — "invita amigos y gana créditos". Riverz no cobra, así que el
-- programa de afiliados original (25% commission) se reemplaza por un
-- esquema de créditos: cuando el referido publica su primera landing,
-- ambos reciben créditos (cantidad configurable en credits_awarded).
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referrer_clerk_id TEXT NOT NULL,
  referee_clerk_id TEXT NOT NULL UNIQUE,    -- one user can only be referred once
  ref_code TEXT NOT NULL,                   -- the code the referee used (for debug/audit)
  status TEXT NOT NULL DEFAULT 'signed_up'
    CHECK (status IN ('signed_up', 'activated')),
  credits_awarded INT DEFAULT 0,
  signed_up_at TIMESTAMPTZ DEFAULT NOW(),
  activated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer
  ON referrals (referrer_clerk_id);

-- --------------------------------------------------------------------------
-- creative_folders — buckets for grouping Creative Studio generations.
-- The generations themselves live in the existing `generations` table.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS creative_folders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clerk_user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_creative_folders_user
  ON creative_folders (clerk_user_id, created_at DESC);

-- Add folder_id to generations as an opt-in foreign key. We don't enforce
-- it because most generations are not Creative Studio assets.
ALTER TABLE generations
  ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES creative_folders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_generations_folder
  ON generations (folder_id) WHERE folder_id IS NOT NULL;
