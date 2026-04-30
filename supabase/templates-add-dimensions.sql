-- Adds width / height columns to templates so the static-ads pipeline can
-- read the source dimensions from the DB instead of re-downloading the image
-- to detect them, and so the admin grid can render each card at the
-- template's true aspect ratio.
--
-- Run from Supabase SQL Editor. Safe to re-run.

ALTER TABLE templates
  ADD COLUMN IF NOT EXISTS width INT,
  ADD COLUMN IF NOT EXISTS height INT;

-- Optional: backfill for existing templates by detecting dimensions in the
-- application code on next access. The columns stay NULL until then; the
-- pipeline already falls back to runtime detection when missing.

COMMENT ON COLUMN templates.width IS 'Native pixel width of thumbnail_url. Set at upload time.';
COMMENT ON COLUMN templates.height IS 'Native pixel height of thumbnail_url. Set at upload time.';
