-- ================================================================
-- RIVERZ PLATFORM - STEALER ENGINE MIGRATION (Phase 0)
-- Tables for the AI Video Cloner pipeline
-- Run this in Supabase SQL Editor
-- ================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Reuse the existing trigger function (defined in static-ads-migration.sql).
-- If running this in a fresh DB, uncomment:
-- CREATE OR REPLACE FUNCTION update_updated_at_column()
-- RETURNS TRIGGER AS $$
-- BEGIN
--   NEW.updated_at = NOW();
--   RETURN NEW;
-- END;
-- $$ language 'plpgsql';

-- ================================================================
-- 1. stealer_projects
--    One row per video the user wants to clone.
-- ================================================================

CREATE TABLE IF NOT EXISTS stealer_projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clerk_user_id TEXT NOT NULL,
  name TEXT,
  source_url TEXT,
  source_video_path TEXT,
  source_duration_sec NUMERIC,
  source_audio_path TEXT,
  transcript JSONB,
  master_audio_path TEXT,
  master_audio_duration_sec NUMERIC,
  selected_avatar_id UUID,
  selected_voice_id UUID,
  status TEXT NOT NULL DEFAULT 'ingesting'
    CHECK (status IN (
      'ingesting',
      'scenes_ready',
      'awaiting_user_review',
      'processing',
      'completed',
      'failed'
    )),
  total_credits INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stealer_projects_user ON stealer_projects(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_stealer_projects_status ON stealer_projects(status);
CREATE INDEX IF NOT EXISTS idx_stealer_projects_date ON stealer_projects(created_at DESC);

DROP TRIGGER IF EXISTS set_stealer_projects_updated_at ON stealer_projects;
CREATE TRIGGER set_stealer_projects_updated_at
  BEFORE UPDATE ON stealer_projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================================================
-- 2. stealer_scenes
--    Each detected/edited scene from the source video.
-- ================================================================

CREATE TABLE IF NOT EXISTS stealer_scenes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES stealer_projects(id) ON DELETE CASCADE,
  scene_index INTEGER NOT NULL,
  start_sec NUMERIC NOT NULL,
  end_sec NUMERIC NOT NULL,
  type TEXT NOT NULL DEFAULT 'broll'
    CHECK (type IN ('actor', 'broll')),
  visual_prompt TEXT,
  emotion_context TEXT,
  fallback_prompt TEXT,
  keyframe_path TEXT,
  audio_segment_path TEXT,
  audio_text TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending',
      'prompting',
      'generating',
      'trimming',
      'lipsyncing',
      'completed',
      'failed'
    )),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (project_id, scene_index)
);

CREATE INDEX IF NOT EXISTS idx_stealer_scenes_project ON stealer_scenes(project_id);
CREATE INDEX IF NOT EXISTS idx_stealer_scenes_status ON stealer_scenes(status);

DROP TRIGGER IF EXISTS set_stealer_scenes_updated_at ON stealer_scenes;
CREATE TRIGGER set_stealer_scenes_updated_at
  BEFORE UPDATE ON stealer_scenes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================================================
-- 3. stealer_jobs
--    The async work queue. The worker pulls rows from here.
-- ================================================================

CREATE TABLE IF NOT EXISTS stealer_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES stealer_projects(id) ON DELETE CASCADE,
  scene_id UUID REFERENCES stealer_scenes(id) ON DELETE CASCADE,
  kind TEXT NOT NULL
    CHECK (kind IN (
      'extract_audio',
      'transcribe',
      'detect_scenes',
      'extract_keyframes',
      'generate_prompts',
      'tts_master',
      'split_audio',
      'generate_actor',
      'generate_broll',
      'lipsync',
      'trim_to_duration'
    )),
  payload JSONB,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'waiting_callback', 'succeeded', 'failed')),
  external_task_id TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  result JSONB,
  error_message TEXT,
  worker_id TEXT,
  picked_up_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stealer_jobs_dispatch
  ON stealer_jobs(status, next_attempt_at)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_stealer_jobs_project ON stealer_jobs(project_id);
CREATE INDEX IF NOT EXISTS idx_stealer_jobs_external_task
  ON stealer_jobs(external_task_id)
  WHERE external_task_id IS NOT NULL;

DROP TRIGGER IF EXISTS set_stealer_jobs_updated_at ON stealer_jobs;
CREATE TRIGGER set_stealer_jobs_updated_at
  BEFORE UPDATE ON stealer_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================================================
-- 4. stealer_assets
--    Final and intermediate outputs (clips, master audio, etc.).
-- ================================================================

CREATE TABLE IF NOT EXISTS stealer_assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES stealer_projects(id) ON DELETE CASCADE,
  scene_id UUID REFERENCES stealer_scenes(id) ON DELETE CASCADE,
  kind TEXT NOT NULL
    CHECK (kind IN ('actor_clip', 'broll_clip', 'master_audio', 'audio_segment', 'lipsync_clip', 'keyframe')),
  storage_path TEXT NOT NULL,
  public_url TEXT,
  duration_sec NUMERIC,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stealer_assets_project ON stealer_assets(project_id);
CREATE INDEX IF NOT EXISTS idx_stealer_assets_scene ON stealer_assets(scene_id);
CREATE INDEX IF NOT EXISTS idx_stealer_assets_kind ON stealer_assets(kind);

-- ================================================================
-- 5. RLS
--    Match the patterns in security-optimizations.sql.
-- ================================================================

ALTER TABLE stealer_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE stealer_scenes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE stealer_jobs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE stealer_assets   ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS automatically; these policies cover
-- direct client reads (e.g., Realtime subscriptions in the dashboard UI).
DROP POLICY IF EXISTS "stealer_projects_owner_read" ON stealer_projects;
CREATE POLICY "stealer_projects_owner_read"
  ON stealer_projects FOR SELECT
  USING (clerk_user_id = (current_setting('request.jwt.claims', true)::json->>'sub'));

DROP POLICY IF EXISTS "stealer_scenes_owner_read" ON stealer_scenes;
CREATE POLICY "stealer_scenes_owner_read"
  ON stealer_scenes FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM stealer_projects
      WHERE clerk_user_id = (current_setting('request.jwt.claims', true)::json->>'sub')
    )
  );

DROP POLICY IF EXISTS "stealer_jobs_owner_read" ON stealer_jobs;
CREATE POLICY "stealer_jobs_owner_read"
  ON stealer_jobs FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM stealer_projects
      WHERE clerk_user_id = (current_setting('request.jwt.claims', true)::json->>'sub')
    )
  );

DROP POLICY IF EXISTS "stealer_assets_owner_read" ON stealer_assets;
CREATE POLICY "stealer_assets_owner_read"
  ON stealer_assets FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM stealer_projects
      WHERE clerk_user_id = (current_setting('request.jwt.claims', true)::json->>'sub')
    )
  );

-- ================================================================
-- 6. Storage bucket for STEALER assets
--    Bucket is private; the worker uses the service role,
--    Next.js generates signed URLs for the client when needed.
-- ================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'stealer',
  'stealer',
  FALSE,
  524288000, -- 500 MB
  ARRAY[
    'video/mp4', 'video/quicktime', 'video/webm',
    'audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/x-wav',
    'image/jpeg', 'image/png', 'image/webp'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Owner read policy on storage objects in the stealer bucket.
DROP POLICY IF EXISTS "stealer_storage_owner_read" ON storage.objects;
CREATE POLICY "stealer_storage_owner_read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'stealer'
    AND (
      auth.role() = 'service_role'
      OR (storage.foldername(name))[1] IN (
        SELECT id::text FROM stealer_projects
        WHERE clerk_user_id = (current_setting('request.jwt.claims', true)::json->>'sub')
      )
    )
  );

-- ================================================================
-- 7. Verify
-- ================================================================
-- After running, the following should return rows:
--   SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'stealer_%';
--   SELECT id FROM storage.buckets WHERE id = 'stealer';
