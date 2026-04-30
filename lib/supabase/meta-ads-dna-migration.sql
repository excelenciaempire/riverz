-- ================================================================
-- RIVERZ - META ADS DNA MIGRATION
-- Adds:
--   1) meta_brand_dna: aggregate Gemini analysis of winner vs loser ads
--      per brand (anchor: ad_account_id).
--   2) Comment-mining columns on meta_ad_intel.
-- Run after meta-ads-extended-migration.sql.
-- ================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. meta_brand_dna ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS meta_brand_dna (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clerk_user_id   TEXT NOT NULL,
  ad_account_id   TEXT NOT NULL,
  -- counts at the time of generation, for context in the UI
  winner_count    INT NOT NULL DEFAULT 0,
  loser_count     INT NOT NULL DEFAULT 0,
  unmarked_count  INT NOT NULL DEFAULT 0,
  -- structured Gemini output (winner_patterns, loser_patterns, comparison...)
  dna_data        JSONB NOT NULL,
  -- ready-to-paste creative brief for the next ad
  brief           TEXT,
  generated_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (clerk_user_id, ad_account_id)
);

CREATE INDEX IF NOT EXISTS idx_meta_brand_dna_account
  ON meta_brand_dna(clerk_user_id, ad_account_id);

DROP TRIGGER IF EXISTS update_meta_brand_dna_updated_at ON meta_brand_dna;
CREATE TRIGGER update_meta_brand_dna_updated_at
BEFORE UPDATE ON meta_brand_dna
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE meta_brand_dna ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to meta_brand_dna" ON meta_brand_dna;
CREATE POLICY "Allow all access to meta_brand_dna"
  ON meta_brand_dna FOR ALL USING (true) WITH CHECK (true);

-- 2. Comments mining columns on meta_ad_intel -------------------------------
ALTER TABLE meta_ad_intel
  ADD COLUMN IF NOT EXISTS comments_summary    TEXT,
  ADD COLUMN IF NOT EXISTS comments_insights   JSONB,
  ADD COLUMN IF NOT EXISTS comments_synced_at  TIMESTAMPTZ;

-- ================================================================
-- VERIFICATION
-- ================================================================
SELECT table_name FROM information_schema.tables
WHERE table_schema='public' AND table_name='meta_brand_dna';
-- expected: 1 row

SELECT column_name FROM information_schema.columns
WHERE table_name='meta_ad_intel'
  AND column_name IN ('comments_summary','comments_insights','comments_synced_at');
-- expected: 3 rows
