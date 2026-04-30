-- ================================================================
-- RIVERZ - META ADS EXTENDED MIGRATION
-- Adds:
--   1) Page + Instagram defaults to meta_connections
--   2) ad_metadata column to meta_uploads (kitchn-style bulk metadata)
--   3) meta_ad_intel: per-ad transcript + winner classification + notes
-- Run after meta-ads-migration.sql
-- ================================================================

-- 1. meta_connections: page + instagram defaults
ALTER TABLE meta_connections
  ADD COLUMN IF NOT EXISTS default_page_id           TEXT,
  ADD COLUMN IF NOT EXISTS default_page_name         TEXT,
  ADD COLUMN IF NOT EXISTS default_instagram_id      TEXT,
  ADD COLUMN IF NOT EXISTS default_instagram_username TEXT;

-- 2. meta_uploads: store per-asset ad metadata used at campaign creation
ALTER TABLE meta_uploads
  ADD COLUMN IF NOT EXISTS ad_metadata JSONB;
-- ad_metadata shape:
-- {
--   "name":         "Ad name shown in Ads Manager",
--   "primary_text": "Body copy",
--   "headline":     "Headline (≤40 chars)",
--   "description":  "Optional description",
--   "link_url":     "https://shop.example/product",
--   "cta":          "SHOP_NOW"
-- }

-- 3. meta_ad_intel: durable AI memory of which ads work
CREATE TABLE IF NOT EXISTS meta_ad_intel (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clerk_user_id      TEXT NOT NULL,
  ad_account_id      TEXT NOT NULL,
  meta_ad_id         TEXT NOT NULL,
  meta_creative_id   TEXT,
  asset_type         TEXT CHECK (asset_type IN ('image', 'video', 'carousel', 'unknown')),
  asset_url          TEXT,
  thumbnail_url      TEXT,
  ad_name            TEXT,
  campaign_id        TEXT,
  campaign_name      TEXT,
  adset_id           TEXT,
  adset_name         TEXT,
  page_id            TEXT,
  primary_text       TEXT,
  headline           TEXT,
  cta                TEXT,
  link_url           TEXT,
  effective_status   TEXT,
  -- AI memory
  transcript         TEXT,
  transcript_status  TEXT NOT NULL DEFAULT 'idle'
                     CHECK (transcript_status IN ('idle','queued','running','done','failed')),
  transcript_error   TEXT,
  is_winner          BOOLEAN,
  notes              TEXT,
  -- Performance snapshot
  insights           JSONB,
  insights_synced_at TIMESTAMP WITH TIME ZONE,
  created_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (clerk_user_id, meta_ad_id)
);

CREATE INDEX IF NOT EXISTS idx_meta_ad_intel_user      ON meta_ad_intel(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_meta_ad_intel_account   ON meta_ad_intel(ad_account_id);
CREATE INDEX IF NOT EXISTS idx_meta_ad_intel_winner    ON meta_ad_intel(is_winner) WHERE is_winner IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_meta_ad_intel_campaign  ON meta_ad_intel(campaign_id);

DROP TRIGGER IF EXISTS update_meta_ad_intel_updated_at ON meta_ad_intel;
CREATE TRIGGER update_meta_ad_intel_updated_at
BEFORE UPDATE ON meta_ad_intel
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE meta_ad_intel ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to meta_ad_intel" ON meta_ad_intel;
CREATE POLICY "Allow all access to meta_ad_intel"
ON meta_ad_intel FOR ALL
USING (true)
WITH CHECK (true);

-- ================================================================
-- VERIFICATION
-- ================================================================
SELECT column_name FROM information_schema.columns
WHERE table_name = 'meta_connections'
  AND column_name IN ('default_page_id','default_page_name','default_instagram_id','default_instagram_username');
-- Should return 4 rows

SELECT column_name FROM information_schema.columns
WHERE table_name = 'meta_uploads' AND column_name = 'ad_metadata';
-- Should return 1 row

SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'meta_ad_intel';
-- Should return 1 row
