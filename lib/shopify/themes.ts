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
  // Schema allows `@app` blocks ONLY — the merchant edits all Riverz
  // content through the Riverz editor (never through Shopify's theme
  // editor) but they DO need a way to drop Shopify app blocks like
  // Kaching Bundles into the page so the offer chooser + add-to-cart
  // button render on the live product page. The Riverz template itself
  // ships a `[data-rz-kaching-slot]` container that the merchant maps
  // to the Kaching Bundles app block from the theme editor.
  // No presets — keeps the section out of "Add section" pickers so it
  // can't be dropped into unrelated templates by accident.
  const schema = JSON.stringify(
    {
      name: `Riverz · ${opts.sectionTag}`,
      tag: 'section',
      class: 'riverz-landing-section',
      settings: [],
      blocks: [{ type: '@app' }],
    },
    null,
    2,
  );
  // The bodyHtml passed in already contains its own
  // <div id="riverz-landing-..."> wrapper + the page CSS + the inline
  // <script> tags built by the editor (sticky/reveal/carousel/shopify
  // wiring). Earlier versions wrapped it AGAIN here, which produced
  // duplicate ids on the page (invalid HTML) and meant the theme reset
  // CSS targeted the outer wrapper while the page styles targeted the
  // inner one — a few rules misfired on Horizon as a result.
  // The wrapId / handleAttr fallback below only fires for callers
  // that pass a bodyHtml WITHOUT their own wrapper; current callers
  // always include one.
  const alreadyWrapped = /id="riverz-landing-/i.test(opts.bodyHtml);
  const inner = alreadyWrapped
    ? opts.bodyHtml
    : `<div id="${wrapId}"${handleAttr}>${opts.bodyHtml}</div>`;
  // Liquid comments use {% comment %} ... {% endcomment %}. The schema
  // sits at the bottom in a {% schema %} block per OS 2.0 convention.
  // Render any merchant-added app blocks (e.g. Kaching Bundles) into the
  // [data-rz-kaching-slot] placeholder if it exists, otherwise just append
  // them at the end of the section. The MutationObserver-friendly placement
  // means Kaching Bundles' web component lands inside the buy-box column
  // alongside the Riverz product info instead of being orphaned at the
  // bottom of the page.
  const appBlocksLiquid = `{% if section.blocks.size > 0 %}
<div data-rz-app-blocks style="display:contents">
  {% for block in section.blocks %}
    {% if block.type == '@app' %}{% render block %}{% endif %}
  {% endfor %}
</div>
<script>
  (function(){
    var src=document.querySelector('[data-rz-app-blocks]');
    var slot=document.querySelector('[data-rz-kaching-slot]');
    if(!src||!slot)return;
    while(src.firstChild)slot.appendChild(src.firstChild);
    src.parentNode&&src.parentNode.removeChild(src);
  })();
</script>
{% endif %}`;
  return `{% comment %}
  Riverz Landing Lab — auto-generated section.
  DO NOT EDIT MANUALLY: changes are overwritten on every "Publicar en Shopify".
  Edit through the Riverz editor instead.
  Use the Shopify theme editor to drop app blocks (Kaching Bundles, etc.)
  into this section — they render inside [data-rz-kaching-slot].
{% endcomment %}

${opts.fontsLink}
<style>${opts.cssBlock}</style>

${inner}

${appBlocksLiquid}

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
