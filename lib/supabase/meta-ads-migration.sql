-- ================================================================
-- RIVERZ PLATFORM - META ADS MIGRATION
-- Adds tables to support OAuth connections to Meta (Facebook)
-- and bulk upload of generated assets to ad account media library.
-- Run this in Supabase SQL Editor.
-- ================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Reuse update_updated_at_column() from static-ads-migration.sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- ================================================================
-- 1. meta_connections - per-user OAuth credentials
-- ================================================================

CREATE TABLE IF NOT EXISTS meta_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clerk_user_id TEXT UNIQUE NOT NULL,
  fb_user_id TEXT NOT NULL,
  fb_user_name TEXT,
  access_token_ciphertext TEXT NOT NULL,
  access_token_iv TEXT NOT NULL,
  access_token_tag TEXT NOT NULL,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  default_ad_account_id TEXT,
  scopes TEXT[],
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked')),
  last_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meta_connections_user ON meta_connections(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_meta_connections_status ON meta_connections(status);

DROP TRIGGER IF EXISTS update_meta_connections_updated_at ON meta_connections;
CREATE TRIGGER update_meta_connections_updated_at
BEFORE UPDATE ON meta_connections
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ================================================================
-- 2. meta_uploads - one row per (generation, ad_account) upload attempt
-- ================================================================

CREATE TABLE IF NOT EXISTS meta_uploads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clerk_user_id TEXT NOT NULL,
  generation_id UUID NOT NULL REFERENCES generations(id) ON DELETE CASCADE,
  ad_account_id TEXT NOT NULL,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('image', 'video')),
  meta_asset_id TEXT,
  meta_asset_hash TEXT,
  source_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'uploading', 'processing', 'ready', 'failed')),
  error_message TEXT,
  poll_attempts INTEGER DEFAULT 0,
  last_polled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (generation_id, ad_account_id)
);

CREATE INDEX IF NOT EXISTS idx_meta_uploads_user ON meta_uploads(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_meta_uploads_status ON meta_uploads(status);
CREATE INDEX IF NOT EXISTS idx_meta_uploads_generation ON meta_uploads(generation_id);
CREATE INDEX IF NOT EXISTS idx_meta_uploads_date ON meta_uploads(created_at DESC);

DROP TRIGGER IF EXISTS update_meta_uploads_updated_at ON meta_uploads;
CREATE TRIGGER update_meta_uploads_updated_at
BEFORE UPDATE ON meta_uploads
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ================================================================
-- 3. Row Level Security
-- API layer enforces ownership via clerk_user_id; permissive policies
-- match the project pattern (see static-ads-migration.sql).
-- ================================================================

ALTER TABLE meta_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_uploads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to meta_connections" ON meta_connections;
CREATE POLICY "Allow all access to meta_connections"
ON meta_connections FOR ALL
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to meta_uploads" ON meta_uploads;
CREATE POLICY "Allow all access to meta_uploads"
ON meta_uploads FOR ALL
USING (true)
WITH CHECK (true);

-- ================================================================
-- VERIFICATION
-- ================================================================

SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('meta_connections', 'meta_uploads')
ORDER BY table_name;
-- Should return 2 rows
