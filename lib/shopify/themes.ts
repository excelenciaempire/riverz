import { ShopifyAdminClient } from './admin-client';

/**
 * Shopify Themes — read the live theme + upload custom templates / sections
 * via the REST Admin Asset API.
 *
 * GraphQL covers the theme listing (themes(role: MAIN)), but theme assets
 * (templates/*.json, sections/*.liquid, snippets/*, assets/*.css|js) have
 * NOT migrated to GraphQL — the canonical write path is still
 *   PUT  /admin/api/<version>/themes/<themeId>/assets.json
 *   GET  /admin/api/<version>/themes/<themeId>/assets.json?asset[key]=<key>
 *   DELETE /admin/api/<version>/themes/<themeId>/assets.json?asset[key]=<key>
 *
 * https://shopify.dev/docs/api/admin-rest/2025-10/resources/asset
 *
 * Used by /api/landing-lab/publish-theme to ship a Riverz product page as
 * a real Online Store 2.0 product template (so apps like Kaching Bundles
 * that target product pages render natively).
 */

const DEFAULT_API_VERSION = process.env.SHOPIFY_API_VERSION || '2025-10';

export interface MainTheme {
  /** Numeric id used by the REST Asset API (NOT a GID). */
  id: number;
  /** Same id formatted as the GraphQL global id, kept for reference. */
  gid: string;
  name: string;
  role: string;
}

/**
 * Fetch the merchant's currently-published theme. We only ever write to
 * MAIN — modifying a draft / dev theme wouldn't show on the storefront,
 * and writing to a non-current theme is dangerous (could land in someone
 * else's WIP).
 */
export async function getMainTheme(client: ShopifyAdminClient): Promise<MainTheme> {
  const data = await client.graphql<{
    themes: { nodes: Array<{ id: string; name: string; role: string }> };
  }>(
    `query MainTheme {
       themes(first: 5, roles: [MAIN]) {
         nodes { id name role }
       }
     }`,
  );
  const node = data.themes?.nodes?.[0];
  if (!node) throw new Error('No published theme found on this shop');
  // Shopify GIDs look like "gid://shopify/OnlineStoreTheme/123456789".
  const m = /\/(\d+)$/.exec(node.id);
  if (!m) throw new Error('Could not parse theme id from GID: ' + node.id);
  return { id: parseInt(m[1], 10), gid: node.id, name: node.name, role: node.role };
}

/**
 * Upsert (create-or-replace) a theme asset. Shopify treats this as a
 * single op — passing an existing key overwrites, a new key creates.
 *
 * Returns the asset record so callers can store the key + the public_url
 * (handy when uploading static images / fonts; not relevant for liquid
 * sections + json templates).
 */
export async function upsertThemeAsset(
  client: ShopifyAdminClient,
  themeId: number,
  asset: { key: string; value: string },
): Promise<{ key: string; checksum: string | null; updated_at: string | null; public_url: string | null }> {
  const url = themeAssetUrl(client, themeId);
  const res = await fetch(url, {
    method: 'PUT',
    headers: assetHeaders(client),
    body: JSON.stringify({ asset: { key: asset.key, value: asset.value } }),
  });
  const body: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.errors ? JSON.stringify(body.errors) : `HTTP ${res.status}`;
    throw new Error(`themeAsset PUT failed for ${asset.key}: ${msg}`);
  }
  const a = body?.asset || {};
  return {
    key: a.key,
    checksum: a.checksum || null,
    updated_at: a.updated_at || null,
    public_url: a.public_url || null,
  };
}

/** Optional helper — used only by future cleanup flows. Kept minimal so the module isn't bloated. */
export async function deleteThemeAsset(
  client: ShopifyAdminClient,
  themeId: number,
  key: string,
): Promise<void> {
  const url = themeAssetUrl(client, themeId) + `?asset[key]=${encodeURIComponent(key)}`;
  const res = await fetch(url, { method: 'DELETE', headers: assetHeaders(client) });
  if (!res.ok && res.status !== 404) {
    const text = await res.text().catch(() => '');
    throw new Error(`themeAsset DELETE failed for ${key}: ${res.status} ${text.slice(0, 200)}`);
  }
}

/** Build the wrapper Liquid section that hosts the editor's body_html. */
export function buildSectionLiquid(opts: {
  bodyHtml: string;
  cssBlock: string;
  fontsLink: string;
  inlineScripts: string[];
  sectionTag: string;
  /**
   * The Shopify product handle the merchant is "binding" this template to.
   * Embedded as a data attribute so the cart / variant wiring script knows
   * which product to fetch — same scheme the Page-based publish uses.
   */
  shopifyHandle?: string;
}): string {
  const wrapId = `riverz-landing-${opts.sectionTag.replace(/[^a-z0-9-]/gi, '').slice(0, 32)}`;
  const handleAttr = opts.shopifyHandle
    ? ` data-shopify-handle="${opts.shopifyHandle.replace(/[^a-z0-9-]/gi, '')}"`
    : '';
  // Schema is intentionally minimal — no editor-visible blocks. The
  // template references this section by name; the merchant edits the
  // landing exclusively through Riverz, never via the theme editor.
  // Disabling presets keeps it out of "Add section" pickers so it can't
  // be dropped into other unrelated templates by accident.
  const schema = JSON.stringify(
    {
      name: `Riverz · ${opts.sectionTag}`,
      tag: 'section',
      class: 'riverz-landing-section',
      // Intentionally NO presets — section is template-only, not a
      // user-pickable block.
      settings: [],
    },
    null,
    2,
  );
  // Liquid comments use {% comment %} ... {% endcomment %}. The schema
  // sits at the bottom in a {% schema %} block per OS 2.0 convention.
  return `{% comment %}
  Riverz Landing Lab — auto-generated section.
  DO NOT EDIT MANUALLY: changes are overwritten on every "Publicar en Shopify".
  Edit through the Riverz editor instead.
{% endcomment %}

${opts.fontsLink}
<style>${opts.cssBlock}</style>

<div id="${wrapId}"${handleAttr}>${opts.bodyHtml}</div>

${opts.inlineScripts.map((s) => `<script>${s}</script>`).join('\n')}

{% schema %}
${schema}
{% endschema %}
`;
}

/**
 * Build the OS 2.0 product template JSON. References the section by its
 * file name (without the .liquid extension and without the sections/
 * prefix). `order` controls render order; we only have one section.
 */
export function buildProductTemplateJson(sectionType: string): string {
  return JSON.stringify(
    {
      sections: {
        main: {
          type: sectionType,
          settings: {},
        },
      },
      order: ['main'],
    },
    null,
    2,
  );
}

function themeAssetUrl(client: ShopifyAdminClient, themeId: number): string {
  return `https://${client.shopDomain}/admin/api/${client.version}/themes/${themeId}/assets.json`;
}

function assetHeaders(client: ShopifyAdminClient): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'X-Shopify-Access-Token': client.accessToken,
  };
}
