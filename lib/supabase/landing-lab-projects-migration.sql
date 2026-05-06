-- ================================================================
-- RIVERZ PLATFORM - LANDING LAB PROJECTS MIGRATION
-- Backend persistence for Landing Lab editor projects.
-- Replaces fragile localStorage-only storage so:
--   - changes survive reload / browser switch / device switch
--   - "Usar plantilla" creates a real durable copy keyed to the user
--   - "Mis páginas" lists the user's actual server-side projects
-- Run this in Supabase SQL Editor.
-- ================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Reuse the project's standard updated_at trigger helper.
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- ================================================================
-- landing_lab_projects
--   id            : opaque string id, comes from the editor (pXXX) or
--                   server-minted on POST. Plain TEXT (not UUID) so the
--                   editor's existing 'p' + base36 id format keeps working
--                   end-to-end without a translation layer.
--   clerk_user_id : owner — every read/write filters on this so projects
--                   are strictly per-user. No cross-user sharing.
--   name / angle / cta_url / template_id : flat metadata so we can list
--                   projects in "Mis páginas" without parsing project_data.
--   project_data  : the full editor state — { texts, images, videos,
--                   imageSizes, imageShapes, imageStyles, videoSizes,
--                   layoutOrder } — exactly the shape saveAll() used to
--                   shove into localStorage. Stored as JSONB so we can
--                   index/inspect later without a schema change.
-- ================================================================

CREATE TABLE IF NOT EXISTS landing_lab_projects (
  id              TEXT PRIMARY KEY,
  clerk_user_id   TEXT NOT NULL,
  name            TEXT NOT NULL DEFAULT 'Nueva Landing',
  angle           TEXT,
  cta_url         TEXT,
  template_id     TEXT,
  project_data    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_landing_lab_projects_user
  ON landing_lab_projects(clerk_user_id);

CREATE INDEX IF NOT EXISTS idx_landing_lab_projects_user_updated
  ON landing_lab_projects(clerk_user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_landing_lab_projects_template
  ON landing_lab_projects(clerk_user_id, template_id);

-- Bump updated_at on every UPDATE so the editor's debounced PUT trail
-- gives us an accurate "last edited" timestamp for the dashboard.
DROP TRIGGER IF EXISTS trg_landing_lab_projects_updated_at ON landing_lab_projects;
CREATE TRIGGER trg_landing_lab_projects_updated_at
  BEFORE UPDATE ON landing_lab_projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ================================================================
-- RLS NOTE
-- This project's API routes use the service-role client (auth happens
-- in Clerk before the supabase call), so we don't add RLS policies
-- here — same pattern as products / generations / shopify_connections.
-- If you ever switch to direct browser access, add policies that key
-- on auth.jwt() ->> 'sub' = clerk_user_id.
-- ================================================================
