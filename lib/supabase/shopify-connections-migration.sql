-- ============================================================================
-- Shopify connections — one row per (clerk_user_id, shop_domain).
-- Mirrors the Meta connection storage pattern: tokens are AES-256-GCM
-- encrypted at rest, the row tracks install state + last error so the UI
-- can surface a "reconnect" hint instead of silently failing.
-- ============================================================================

CREATE TABLE IF NOT EXISTS shopify_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clerk_user_id TEXT NOT NULL,
  shop_domain TEXT NOT NULL,                          -- e.g. "vitalu.myshopify.com"
  shop_name TEXT,                                     -- merchant-friendly name shown in UI
  access_token_ciphertext TEXT NOT NULL,
  access_token_iv TEXT NOT NULL,
  access_token_tag TEXT NOT NULL,
  scope TEXT,                                         -- granted scopes returned by Shopify
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'uninstalled', 'expired', 'error')),
  last_error TEXT,
  installed_at TIMESTAMPTZ DEFAULT NOW(),
  uninstalled_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- A merchant can only install our app once per shop. If the same Riverz
  -- user reconnects the same shop we update the row in place.
  UNIQUE (clerk_user_id, shop_domain)
);

-- Lookup paths the app actually uses:
--   1) "what shops has THIS user connected?"  → list page in /configuracion
--   2) "given a shop_domain (from a webhook),  → who owns it?"
CREATE INDEX IF NOT EXISTS idx_shopify_connections_user
  ON shopify_connections (clerk_user_id, status);

CREATE INDEX IF NOT EXISTS idx_shopify_connections_shop
  ON shopify_connections (shop_domain);

-- updated_at touch trigger — same pattern used elsewhere in the schema.
CREATE OR REPLACE FUNCTION shopify_connections_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_shopify_connections_touch ON shopify_connections;
CREATE TRIGGER trg_shopify_connections_touch
  BEFORE UPDATE ON shopify_connections
  FOR EACH ROW EXECUTE FUNCTION shopify_connections_touch_updated_at();

-- ============================================================================
-- Published landings — bookkeeping so the UI can show "this landing was
-- published to vitalu.myshopify.com on 2026-04-30, page id 12345" and so a
-- republish updates the existing Shopify Page instead of creating a new one.
-- ============================================================================

CREATE TABLE IF NOT EXISTS shopify_published_landings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clerk_user_id TEXT NOT NULL,
  connection_id UUID REFERENCES shopify_connections(id) ON DELETE CASCADE,
  shop_domain TEXT NOT NULL,
  -- Local landing identifier from the editor (proj.id in landing-lab.html).
  local_project_id TEXT NOT NULL,
  local_project_name TEXT,
  shopify_page_id TEXT NOT NULL,                      -- Shopify GID
  shopify_page_handle TEXT,
  shopify_page_url TEXT,                              -- public URL on the storefront
  image_map JSONB,                                    -- { slot: shopifyFileUrl } — for diff'd republish
  published_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (clerk_user_id, shop_domain, local_project_id)
);

CREATE INDEX IF NOT EXISTS idx_shopify_published_landings_user
  ON shopify_published_landings (clerk_user_id);

DROP TRIGGER IF EXISTS trg_shopify_published_landings_touch ON shopify_published_landings;
CREATE TRIGGER trg_shopify_published_landings_touch
  BEFORE UPDATE ON shopify_published_landings
  FOR EACH ROW EXECUTE FUNCTION shopify_connections_touch_updated_at();
