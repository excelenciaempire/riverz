-- Adds an admin-only `folder` tag to templates. Used by the bulk upload
-- modal to group a batch of templates so the admin can later filter or
-- bulk-delete the whole batch. End users (the /crear/static-ads selector)
-- never see the folder field — they continue to see all active templates
-- regardless of folder assignment.
--
-- Run from Supabase SQL Editor. Safe to re-run.

ALTER TABLE templates
  ADD COLUMN IF NOT EXISTS folder TEXT;

CREATE INDEX IF NOT EXISTS templates_folder_idx
  ON templates(folder) WHERE folder IS NOT NULL;

COMMENT ON COLUMN templates.folder IS
  'Admin-only organisational tag. NULL = sin carpeta. Not visible to end users — only filtered in /admin/dashboard.';
