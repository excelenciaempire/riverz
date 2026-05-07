-- ============================================================================
-- Shopify Theme Template publishes — bookkeeping for product-page projects
-- that ship as custom Online Store 2.0 product templates instead of regular
-- Online Store Pages. The /api/landing-lab/publish-theme endpoint uploads:
--   - sections/riverz-landing-<projectId>.liquid   (the rendered HTML body)
--   - templates/product.riverz-<projectId>.json    (OS 2.0 wrapper)
-- and stores the keys here so a republish updates the same files instead
-- of leaving stale assets behind.
--
-- This table is INDEPENDENT from shopify_published_landings — the Page-based
-- publishes (advertorials, listicles, plain landings) keep using that table
-- and are NEVER touched by this flow.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

CREATE TABLE IF NOT EXISTS shopify_published_theme_templates (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clerk_user_id   TEXT NOT NULL,
  connection_id   UUID REFERENCES shopify_connections(id) ON DELETE CASCADE,
  shop_domain     TEXT NOT NULL,
  -- Local landing identifier from the editor (proj.id in landing-lab.html)
  local_project_id    TEXT NOT NULL,
  local_project_name  TEXT,
  -- Shopify theme target. Themes can be replaced (publish a new theme),
  -- so we store both the GID at publish time AND the current asset keys
  -- so we can detect drift on republish.
  theme_id            TEXT NOT NULL,
  theme_name          TEXT,
  template_key        TEXT NOT NULL,    -- e.g. 'templates/product.riverz-<projectId>.json'
  section_key         TEXT NOT NULL,    -- e.g. 'sections/riverz-landing-<projectId>.liquid'
  -- The product handle the merchant connected (from proj.shopifyProductHandle).
  -- We don't pin a single product to the template here — Shopify lets any
  -- product use the template via Admin → Product → Theme template — but
  -- knowing the "intended" product gives us the preview URL and helps the
  -- editor surface "set this template as default for <product>" CTAs.
  product_handle      TEXT,
  -- Same diff'd-republish cache as Page publishes: { slot: shopifyFileUrl }
  -- so we don't re-upload bytes on every save.
  image_map           JSONB,
  -- Public URLs we showed the user at publish time. preview_url uses the
  -- ?view=<template> query param so the merchant can see the rendered page
  -- without changing their product's default template; public_url drops
  -- the query string and is what they'd see if they assign the template
  -- as the product's default.
  preview_url         TEXT,
  public_url          TEXT,
  published_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (clerk_user_id, shop_domain, local_project_id)
);

CREATE INDEX IF NOT EXISTS idx_shopify_published_theme_templates_user
  ON shopify_published_theme_templates (clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_shopify_published_theme_templates_shop
  ON shopify_published_theme_templates (shop_domain);

DROP TRIGGER IF EXISTS trg_shopify_published_theme_templates_touch ON shopify_published_theme_templates;
CREATE TRIGGER trg_shopify_published_theme_templates_touch
  BEFORE UPDATE ON shopify_published_theme_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
