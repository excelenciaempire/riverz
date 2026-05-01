-- ================================================================
-- RIVERZ - META RATE-LIMIT MIGRATION
-- 1) meta_rate_limit_state:  per (user, ad_account_id) cooldown + usage
--    snapshot. Set when Graph returns 80004 / 80000 / etc., or when
--    the X-Business-Use-Case-Usage header reports usage > 90%.
-- 2) meta_ads_cache: 5-min server-side cache of /api/meta/ads payload
--    so reopening the viewer doesn't burn the BUC budget every time.
-- Run after meta-ads-dna-migration.sql.
-- ================================================================

CREATE TABLE IF NOT EXISTS meta_rate_limit_state (
  clerk_user_id      TEXT NOT NULL,
  ad_account_id      TEXT NOT NULL DEFAULT '',
  -- The Meta BUC usage (0-100) for the most recent response. Anything
  -- over 90% triggers preventive throttling; 100% is a hard block.
  call_count_pct     INT,
  total_cputime_pct  INT,
  total_time_pct     INT,
  -- When the cooldown lifts. Set from estimated_time_to_regain_access
  -- on a 80004 / 80000 error or extrapolated from headers.
  cooldown_until     TIMESTAMPTZ,
  -- Reason text for surfacing in the UI ("ads_management quota at 100%").
  reason             TEXT,
  -- Last time we observed any rate-limit signal for this (user, account).
  last_observed_at   TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (clerk_user_id, ad_account_id)
);

CREATE INDEX IF NOT EXISTS idx_meta_rate_limit_until
  ON meta_rate_limit_state(cooldown_until) WHERE cooldown_until IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 2. meta_ads_cache: a tiny KV per (user, account, datePreset) that holds the
-- last successful /api/meta/ads response. Anything within 5 minutes is
-- served straight from here.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meta_ads_cache (
  clerk_user_id  TEXT NOT NULL,
  ad_account_id  TEXT NOT NULL,
  date_preset    TEXT NOT NULL,
  payload        JSONB NOT NULL,
  cached_at      TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (clerk_user_id, ad_account_id, date_preset)
);

CREATE INDEX IF NOT EXISTS idx_meta_ads_cache_age
  ON meta_ads_cache(cached_at);

ALTER TABLE meta_rate_limit_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_ads_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to meta_rate_limit_state" ON meta_rate_limit_state;
CREATE POLICY "Allow all access to meta_rate_limit_state"
  ON meta_rate_limit_state FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to meta_ads_cache" ON meta_ads_cache;
CREATE POLICY "Allow all access to meta_ads_cache"
  ON meta_ads_cache FOR ALL USING (true) WITH CHECK (true);

-- Verification
SELECT table_name FROM information_schema.tables
WHERE table_schema='public' AND table_name IN ('meta_rate_limit_state','meta_ads_cache')
ORDER BY table_name;
-- expected: 2 rows
