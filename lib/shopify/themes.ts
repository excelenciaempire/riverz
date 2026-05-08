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

/**
 * Fetch a theme asset's value as a string. Returns null when the asset
 * doesn't exist (Shopify returns 404 + a JSON error body) so callers can
 * gracefully fall through to "first-time create" logic. Any other failure
 * throws — the publish flow surfaces those as 502s.
 */
export async function getThemeAssetValue(
  client: ShopifyAdminClient,
  themeId: number,
  key: string,
): Promise<string | null> {
  const url =
    themeAssetUrl(client, themeId) + `?asset[key]=${encodeURIComponent(key)}`;
  const res = await fetch(url, { method: 'GET', headers: assetHeaders(client) });
  if (res.status === 404) return null;
  const body: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.errors ? JSON.stringify(body.errors) : `HTTP ${res.status}`;
    throw new Error(`themeAsset GET failed for ${key}: ${msg}`);
  }
  // The asset endpoint returns either { asset: { value: "..." } } for text
  // assets or { asset: { attachment: "<base64>" } } for binary. Section /
  // template files are always text so we only handle the value branch.
  const v = body?.asset?.value;
  return typeof v === 'string' ? v : null;
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
  // `show_buy_button` is on by default — Riverz product templates strip
  // the theme's native product form, so without our own button there's
  // no way to actually add the product to the cart. Kaching Bundles'
  // "Add to cart" sub-block (when added) writes lines client-side and
  // the merchant can flip this off to avoid duplicate buttons.
  const schema = JSON.stringify(
    {
      name: `Riverz · ${opts.sectionTag}`,
      tag: 'section',
      class: 'riverz-landing-section',
      settings: [
        {
          type: 'checkbox',
          id: 'show_buy_button',
          label: 'Mostrar botón "Agregar al carrito"',
          default: true,
          info: 'Apagalo si Kaching Bundles (u otra app) ya inyecta su propio botón.',
        },
        {
          type: 'text',
          id: 'buy_button_text',
          label: 'Texto del botón',
          default: 'Agregar al carrito',
        },
      ],
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
  // [data-rz-kaching-slot] placeholder so the offer chooser lands inside
  // the buy-box column instead of orphaned at the section bottom.
  //
  // The reparent runs as soon as DOM is ready AND keeps watching with a
  // MutationObserver — Kaching Bundles renders a custom element that
  // hydrates asynchronously, and on slow connections the slot div from
  // the riverz body can show up after the {% for block %} markup. We
  // also accept several fallback selectors (#bundles, .riverz-kaching-slot)
  // so projects authored before the explicit data-rz-kaching-slot
  // attribute existed still land the widget in the right place.
  const appBlocksLiquid = `{% if section.blocks.size > 0 %}
<div data-rz-app-blocks style="display:contents">
  {% for block in section.blocks %}
    {% if block.type == '@app' %}{% render block %}{% endif %}
  {% endfor %}
</div>
<script>
  (function(){
    var SELECTORS = ['[data-rz-kaching-slot]', '.riverz-kaching-slot', '#bundles'];
    function findSlot(){
      for (var i=0;i<SELECTORS.length;i++){
        var el=document.querySelector(SELECTORS[i]);
        if (el) return el;
      }
      return null;
    }
    function reparent(){
      var src=document.querySelector('[data-rz-app-blocks]');
      var slot=findSlot();
      // Already mounted on a previous tick — stop observing.
      if(slot && slot.getAttribute('data-rz-kaching-mounted')==='1' && (!src||!src.children.length)) return true;
      if(!src||!slot||!src.children.length) return false;
      // Don't reparent if the slot is itself inside the src wrapper
      // (would create a cycle).
      if(src.contains(slot)) return false;
      while(src.firstChild) slot.appendChild(src.firstChild);
      if(src.parentNode) src.parentNode.removeChild(src);
      slot.setAttribute('data-rz-kaching-mounted','1');
      return true;
    }
    function tryNow(){
      if (reparent()) return;
      // Slot or source not ready yet — observe the body for late mounts
      // (Kaching's web component, async section reload, etc.).
      var mo=new MutationObserver(function(){ if (reparent()) mo.disconnect(); });
      mo.observe(document.body || document.documentElement, { childList:true, subtree:true });
      // Stop polling after 8s so we don't observe forever on pages that
      // legitimately have no slot — the app block stays where it was
      // rendered (end of section) which is the safe default.
      setTimeout(function(){ try { mo.disconnect(); } catch(e){} }, 8000);
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', tryNow, { once:true });
    } else {
      tryNow();
    }
  })();
</script>
{% endif %}`;
  // Native add-to-cart fallback. Riverz product templates replace the
  // theme's main-product section, which means the standard
  // {% form 'product' %} button is gone — without this the page has
  // bundle radio options but no way to actually buy. Kaching Bundles
  // can override this via lines hijacking; when their "Add to cart"
  // sub-block is added, the merchant flips off section.settings.
  // show_buy_button.
  //
  // We render INSIDE the riverz wrapper near the kaching slot so it
  // sits in the buy-box column. A small client-side script reparents
  // the form into [data-rz-buy-button-slot] (or the kaching slot if
  // that's the only anchor present), so the user can position it
  // precisely from the editor by dropping a Buy-button block — same
  // pattern as the Kaching slot.
  // Buy flow on the published page is split into two separate buttons,
  // both editable from the Riverz palette:
  //   • [data-rz-buy="addtocart"] → POST /cart/add.js, redirect /cart
  //     so the merchant's cart drawer (or /cart page) shows the bundle.
  //     Carries name="add" + .product-form__submit so Kaching Bundles'
  //     auto-detector finds it without manual selector configuration.
  //   • [data-rz-buy="checkout"]  → POST /cart/add.js, redirect /checkout
  //     directly. Bypasses /cart for one-click purchase intent.
  //
  // Auto-form fallback only fires when section.settings.show_buy_button
  // is on AND the body_html doesn't already contain an editor button.
  const editorButtonAlreadyPresent = /data-rz-buy=["'](?:checkout|addtocart)["']/.test(opts.bodyHtml);
  const autoFormGuard = editorButtonAlreadyPresent
    ? '{% assign rz_show_auto_form = false %}'
    : "{% assign rz_show_auto_form = section.settings.show_buy_button %}";
  const buyButtonLiquid = `${autoFormGuard}
<span hidden data-rz-product-handle="{{ product.handle }}" data-rz-default-variant="{{ product.selected_or_first_available_variant.id }}"></span>
{% comment %} Standard hidden product form so Kaching Bundles' default
selectors (button[name="add"], form[action*="/cart/add"]) auto-detect.
The visible buttons above wire their clicks through our JS handler, but
this hidden form gives Kaching a stable anchor for live price updates. {% endcomment %}
<form action="/cart/add" method="post" data-rz-shadow-form style="display:none" id="riverz-shadow-form">
  <input type="hidden" name="id" value="{{ product.selected_or_first_available_variant.id }}" data-rz-shadow-id>
  <input type="hidden" name="quantity" value="1" data-rz-shadow-qty>
</form>
{% if rz_show_auto_form %}
<div data-rz-buy-form class="riverz-buy-form" style="display:contents">
  <button type="button"
    name="add"
    class="riverz-buy-btn product-form__submit add-to-cart-button"
    data-rz-buy="addtocart"
    {% unless product.selected_or_first_available_variant.available %}disabled{% endunless %}
    style="display:inline-flex;align-items:center;justify-content:center;gap:8px;width:100%;max-width:420px;background:#0a0a0a;color:#fff;font-family:inherit;font-weight:800;font-size:15px;letter-spacing:.04em;text-transform:uppercase;padding:16px 24px;border-radius:8px;border:0;cursor:pointer;margin:14px auto 6px;transition:filter .12s;box-shadow:0 8px 24px rgba(0,0,0,.18)">
    {% if product.selected_or_first_available_variant.available %}
      {{ section.settings.buy_button_text | default: 'Agregar al carrito' }}
      <span style="opacity:.85" data-rz-buy-price>· {{ product.selected_or_first_available_variant.price | money }}</span>
    {% else %}
      Agotado
    {% endif %}
  </button>
  <button type="button"
    class="riverz-buy-btn shopify-payment-button__button"
    data-rz-buy="checkout"
    {% unless product.selected_or_first_available_variant.available %}disabled{% endunless %}
    style="display:inline-flex;align-items:center;justify-content:center;gap:8px;width:100%;max-width:420px;background:#f7ff9e;color:#0a0a0a;font-family:inherit;font-weight:800;font-size:14.5px;letter-spacing:.04em;text-transform:uppercase;padding:14px 22px;border-radius:8px;border:0;cursor:pointer;margin:0 auto 14px;transition:filter .12s;box-shadow:0 6px 18px rgba(247,255,158,.28)">
    Comprar ahora →
  </button>
</div>
<script>
  (function(){
    var wrap=document.querySelector('[data-rz-buy-form]');
    if(!wrap) return;
    // Anchor priority: explicit slot > kaching slot > legacy #bundles.
    var anchor=document.querySelector('[data-rz-buy-button-slot]')
            || document.querySelector('[data-rz-kaching-mounted="1"]')
            || document.querySelector('[data-rz-kaching-slot]')
            || document.querySelector('.riverz-kaching-slot')
            || document.querySelector('#bundles');
    if(!anchor || anchor.contains(wrap)) return;
    anchor.parentNode && anchor.parentNode.insertBefore(wrap, anchor.nextSibling);
  })();
</script>
{% endif %}
<script>
  // Direct-to-checkout handler for any [data-rz-buy="checkout"] in the
  // section (whether the auto-form above or a button the user dropped
  // in the Riverz editor). Reads Kaching's currently selected variant
  // + qty (multiple selector fallbacks since the deal block's DOM
  // shape varies by version), POSTs /cart/add.js, then jumps straight
  // to /checkout. Bypasses /cart entirely so the merchant doesn't lose
  // conversions to the cart page.
  (function(){
    if (window.__rzBuyWired) return; window.__rzBuyWired = true;
    // Shopify variant ids are 13+ digit numeric strings. Anything else
    // (Kaching's internal deal ids like "ZhUk", base36 hashes, GIDs we
    // forgot to strip) hard-fails /cart/add.js and the cart permalink.
    function isVariantId(v){ return typeof v === 'string' && /^\d{6,}$/.test(v); }
    function pickVariantId(){
      for (var i=0;i<arguments.length;i++){
        var v = arguments[i];
        if (typeof v === 'number') v = String(v);
        if (isVariantId(v)) return v;
      }
      return null;
    }
    function getDefaults(){
      var meta=document.querySelector('[data-rz-default-variant]');
      return {
        id: meta ? meta.getAttribute('data-rz-default-variant') : null,
        handle: meta ? meta.getAttribute('data-rz-product-handle') : null,
      };
    }
    // Highest fidelity source: the shadow product form. If Kaching has
    // wired up to it (auto-detection via name="add"/form[action]) the
    // hidden id input reflects whichever bundle the user just picked.
    function readShadowForm(){
      var idInput=document.querySelector('[data-rz-shadow-id], #riverz-shadow-form input[name="id"]');
      var qtyInput=document.querySelector('[data-rz-shadow-qty], #riverz-shadow-form input[name="quantity"]');
      if(!idInput) return null;
      var id=pickVariantId(idInput.value);
      if(!id) return null;
      var q=parseInt((qtyInput && qtyInput.value) || '1', 10);
      return { id: id, quantity: isNaN(q)?1:q };
    }
    function readKachingSelection(){
      var checked=document.querySelector('[data-rz-kaching-mounted="1"] input[type="radio"]:checked, [data-rz-kaching-slot] input[type="radio"]:checked, .kaching-bundles input[type="radio"]:checked');
      var hidden=document.querySelector('[data-rz-kaching-mounted="1"] input[type="hidden"][name="id"], [data-rz-kaching-slot] input[type="hidden"][name="id"]');
      var src = hidden || checked;
      if(!src) return null;
      // Walk current node + ancestors for a valid Shopify variant id.
      var node = src, found=null, qty=null, dealId=null;
      while (node && node !== document.body) {
        var cand = pickVariantId(
          node.getAttribute && node.getAttribute('data-shopify-variant-id'),
          node.getAttribute && node.getAttribute('data-product-variant-id'),
          node.getAttribute && node.getAttribute('data-variant-id'),
          node.getAttribute && node.getAttribute('data-merchandise-id'),
          node.getAttribute && node.getAttribute('data-kaching-variant-id'),
          node.value
        );
        if (!found && cand) found = cand;
        if (!qty && node.getAttribute) {
          var qa = node.getAttribute('data-kaching-quantity') || node.getAttribute('data-quantity');
          if (qa && /^\d+$/.test(qa)) qty = parseInt(qa, 10);
        }
        if (!dealId && node.getAttribute) {
          dealId = node.getAttribute('data-kaching-deal-id') || node.getAttribute('data-deal-id') || dealId;
        }
        if (found && qty && dealId) break;
        node = node.parentElement;
      }
      if (!dealId && src.value && !isVariantId(src.value)) dealId = src.value;
      if (!found) return null;
      return { id: found, quantity: qty || 1, dealId: dealId || null };
    }
    function buildLine(){
      // Order of preference:
      //   1) Shadow form (Kaching auto-wires here when its detector
      //      finds button[name="add"]) — single source of truth once
      //      Kaching is in control.
      //   2) Manual scrape of the deal block radios (older Kaching
      //      versions / when auto-detection failed).
      //   3) Product default — keeps the buy buttons functional even
      //      with zero Kaching integration.
      var s=readShadowForm();
      var k=readKachingSelection();
      var d=getDefaults();
      var id = (s && s.id) || (k && k.id) || (isVariantId(d.id) ? d.id : null);
      var qty = (s && s.quantity) || (k && k.quantity) || 1;
      if (!id) return null;
      var line = { id: id, quantity: qty };
      if (k && k.dealId) {
        line.properties = { __kaching_bundles: JSON.stringify({ id: k.dealId }) };
      }
      return line;
    }
    async function go(btn, mode){
      var line=buildLine();
      if (!line) {
        console.warn('[Riverz] no valid Shopify variant id available; skipping ' + mode);
        return;
      }
      var prevLabel=btn.innerHTML;
      btn.disabled=true;
      btn.innerHTML='Procesando…';
      try {
        var res=await fetch('/cart/add.js', {
          method:'POST',
          headers:{ 'Content-Type':'application/json', 'Accept':'application/json' },
          body: JSON.stringify({ items: [line] }),
        });
        if (!res.ok) {
          var err=await res.json().catch(function(){ return {}; });
          throw new Error(err.description || ('cart/add ' + res.status));
        }
        // Mode controls the post-add destination:
        //   addtocart → /cart (drawer / cart page)
        //   checkout  → /checkout (one-click intent)
        window.location.href = (mode === 'checkout') ? '/checkout' : '/cart';
      } catch(e){
        console.error('[Riverz] ' + mode + ' failed:', e);
        btn.disabled=false;
        btn.innerHTML=prevLabel;
        if (isVariantId(line.id)) {
          // Permalink fallback — appends to cart server-side.
          var ret = (mode === 'checkout') ? '/checkout' : '/cart';
          window.location.href = '/cart/' + line.id + ':' + line.quantity + '?return_to=' + encodeURIComponent(ret);
        }
      }
    }
    document.addEventListener('click', function(e){
      var btn=e.target && e.target.closest && e.target.closest('[data-rz-buy]');
      if (!btn) return;
      var mode = btn.getAttribute('data-rz-buy');
      if (mode !== 'checkout' && mode !== 'addtocart') return;
      e.preventDefault();
      go(btn, mode);
    });
  })();
</script>`;
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

${buyButtonLiquid}

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
 *
 * If `preserveBlocks` is provided (typically the merchant's previously-
 * saved Kaching Bundles app block from a prior republish, or copied from
 * the default product.json on first publish), they're carried through so
 * the merchant doesn't have to re-add the app block on every republish.
 */
export function buildProductTemplateJson(
  sectionType: string,
  preserveBlocks?: { blocks?: Record<string, any>; block_order?: string[] },
): string {
  const main: Record<string, any> = {
    type: sectionType,
    settings: {},
  };
  if (preserveBlocks?.blocks && Object.keys(preserveBlocks.blocks).length > 0) {
    main.blocks = preserveBlocks.blocks;
    if (preserveBlocks.block_order?.length) {
      main.block_order = preserveBlocks.block_order;
    } else {
      main.block_order = Object.keys(preserveBlocks.blocks);
    }
  }
  return JSON.stringify(
    {
      sections: { main },
      order: ['main'],
    },
    null,
    2,
  );
}

/**
 * Pull existing **app blocks** off a previously-saved product template
 * JSON so subsequent republishes don't wipe the merchant's app blocks
 * (e.g. Kaching Bundles). Returns null when the template doesn't exist
 * yet OR when its `sections.main.blocks` has no app-block entries.
 *
 * We filter to @app-type blocks only because the Riverz section schema
 * declares `blocks: [{ type: '@app' }]` — copying through native blocks
 * (text/image/etc.) from the merchant's stock product template would
 * make Shopify silently drop them on render and would also pollute
 * block_order with keys whose blocks the section doesn't accept.
 *
 * App block types are saved as `shopify://apps/<app>/blocks/<block>/<id>`.
 */
export function extractMainBlocks(
  rawTemplateJson: string | null | undefined,
): { blocks: Record<string, any>; block_order?: string[] } | null {
  if (!rawTemplateJson) return null;
  let parsed: any;
  try {
    parsed = JSON.parse(rawTemplateJson);
  } catch {
    return null;
  }
  const main = parsed?.sections?.main;
  if (!main || typeof main !== 'object') return null;
  const allBlocks = main.blocks;
  if (!allBlocks || typeof allBlocks !== 'object' || Array.isArray(allBlocks)) return null;
  const isAppBlock = (b: any) =>
    b && typeof b.type === 'string' && /^shopify:\/\/apps\//.test(b.type);
  const filtered: Record<string, any> = {};
  for (const [k, v] of Object.entries(allBlocks)) {
    if (isAppBlock(v)) filtered[k] = v;
  }
  const keys = Object.keys(filtered);
  if (keys.length === 0) return null;
  const order = Array.isArray(main.block_order)
    ? (main.block_order as string[]).filter((k) => k in filtered)
    : keys;
  return { blocks: filtered, block_order: order.length ? order : keys };
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
