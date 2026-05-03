import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getShopifyConnection } from '@/lib/shopify/connection';
import { ShopifyAdminClient } from '@/lib/shopify/admin-client';
import { uploadImageToShopify } from '@/lib/shopify/files';
import { createPage, updatePage } from '@/lib/shopify/pages';

export const runtime = 'nodejs';
// Image uploads + page create can take 10–25s on a landing with many slots.
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

interface PublishRequest {
  /** Shop chosen in the UI when the user has more than one Shopify store connected. */
  shop_domain?: string;
  /** Local id from the editor (proj.id) — used to upsert republishes. */
  project_id: string;
  /** Page title in Shopify. */
  title: string;
  /** Optional handle (URL slug). */
  handle?: string;
  /** Optional SEO title. Falls back to `title` in Shopify if omitted. */
  seo_title?: string;
  /** Optional meta description. ≤160 chars recommended. */
  meta_description?: string;
  /**
   * Full HTML for the page body — what the editor exports today, minus the
   * <html>/<body> wrapper which Shopify Pages don't support.
   */
  body_html: string;
  /**
   * Map of placeholders found in body_html to image bytes that need to be
   * uploaded to Shopify Files first. Each entry's data URL or http URL gets
   * fetched, pushed to Files, and the resulting CDN URL is substituted in
   * for `placeholder` everywhere it appears.
   *
   *   { slot: "img-1", placeholder: "RIVERZ_IMG__img-1__", source: "data:..." }
   *
   * The editor builds this map at export time so we never have to parse the
   * HTML server-side.
   */
  images?: Array<{ slot: string; placeholder: string; source: string; alt?: string }>;
  /** Override the default behavior of publishing to the storefront immediately. */
  published?: boolean;
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let payload: PublishRequest;
  try {
    payload = (await req.json()) as PublishRequest;
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 });
  }
  if (!payload.project_id || !payload.title || !payload.body_html) {
    return NextResponse.json({ error: 'Faltan project_id, title o body_html' }, { status: 400 });
  }

  const conn = await getShopifyConnection({ clerkUserId: userId, shopDomain: payload.shop_domain });
  if (!conn.ok) return NextResponse.json({ error: conn.error, requiresReconnect: conn.requiresReconnect }, { status: conn.status });

  const client = new ShopifyAdminClient(conn.shop, conn.token);

  // Resolve the storefront domain so the URL we return points to the live
  // page (e.g. shop.com/pages/foo) instead of the .myshopify.com fallback.
  let primaryDomain: string;
  try {
    primaryDomain = (await client.getShopInfo()).primaryDomain;
  } catch (e: any) {
    return NextResponse.json({ error: 'No se pudo leer la tienda: ' + e.message }, { status: 502 });
  }

  // 1) Replace each placeholder with a Shopify CDN URL. Images uploaded
  //    through the editor's "Imagenes" modal already live on the merchant's
  //    cdn.shopify.com — those we substitute directly. Anything else (legacy
  //    data: URLs, kie.ai temp URLs, externally-pasted URLs) gets fetched +
  //    re-uploaded to Shopify Files so the published page never depends on a
  //    third-party host that could expire or rate-limit.
  const imageMap: Record<string, string> = {};
  let bodyHtml = payload.body_html;
  if (payload.images?.length) {
    for (const img of payload.images) {
      try {
        let finalUrl: string;
        if (isShopifyCdnUrl(img.source)) {
          finalUrl = img.source;
        } else {
          const bytes = await fetchAsBuffer(img.source);
          const mimeType = guessMimeFromSource(img.source) || 'image/png';
          const filename = sanitizeFilename(`${payload.project_id}__${img.slot}`) + '.' + extFromMime(mimeType);
          const uploaded = await uploadImageToShopify(client, {
            bytes: bytes.buffer,
            filename,
            mimeType: bytes.mime || mimeType,
            altText: img.alt || `${payload.title} — ${img.slot}`,
          });
          finalUrl = uploaded.cdnUrl;
        }
        imageMap[img.slot] = finalUrl;
        bodyHtml = bodyHtml.split(img.placeholder).join(finalUrl);
      } catch (e: any) {
        return NextResponse.json(
          { error: `Falla al subir imagen ${img.slot}: ${e.message}` },
          { status: 502 },
        );
      }
    }
  }

  // 2) Wrap the editor body with a CSS reset that hides the merchant's theme
  //    header/footer/announcement-bar/auto-title and forces the page wrapper
  //    to full viewport width. Shopify Pages render inside the active theme's
  //    layout, so without this the landing would sit inside the theme's
  //    ~1200px container with the store nav on top — visually broken for a
  //    sales landing. Selectors target Dawn-derived themes (the vast
  //    majority of Shopify themes) plus a generous fallback set.
  bodyHtml = wrapForFullWidth(bodyHtml);

  // 3) Has this project already been published to this shop? If so update,
  //    otherwise create — keeps the URL/handle stable across republishes.
  const supabase = createAdminClient();
  const { data: existing } = await supabase
    .from('shopify_published_landings')
    .select('id, shopify_page_id, shopify_page_handle')
    .eq('clerk_user_id', userId)
    .eq('shop_domain', conn.shop)
    .eq('local_project_id', payload.project_id)
    .maybeSingle();

  let result: { id: string; handle: string; url: string };
  try {
    if (existing?.shopify_page_id) {
      result = await updatePage(client, primaryDomain, existing.shopify_page_id, {
        title: payload.title,
        bodyHtml,
        handle: payload.handle ?? existing.shopify_page_handle ?? undefined,
        published: payload.published,
        seoTitle: payload.seo_title,
        metaDescription: payload.meta_description,
      });
    } else {
      result = await createPage(client, primaryDomain, {
        title: payload.title,
        bodyHtml,
        handle: payload.handle,
        published: payload.published,
        seoTitle: payload.seo_title,
        metaDescription: payload.meta_description,
      });
    }
  } catch (e: any) {
    return NextResponse.json({ error: 'Falla al crear/actualizar la página: ' + e.message }, { status: 502 });
  }

  // 4) Persist the publish so a republish updates instead of duplicating.
  await supabase
    .from('shopify_published_landings')
    .upsert(
      {
        clerk_user_id: userId,
        connection_id: conn.connectionId,
        shop_domain: conn.shop,
        local_project_id: payload.project_id,
        local_project_name: payload.title,
        shopify_page_id: result.id,
        shopify_page_handle: result.handle,
        shopify_page_url: result.url,
        image_map: imageMap,
        published_at: new Date().toISOString(),
      },
      { onConflict: 'clerk_user_id,shop_domain,local_project_id' },
    );

  return NextResponse.json({
    ok: true,
    page: result,
    image_map: imageMap,
  });
}

// ---------- helpers ----------

async function fetchAsBuffer(source: string): Promise<{ buffer: Buffer; mime?: string }> {
  if (source.startsWith('data:')) {
    const m = /^data:([^;,]+)(;base64)?,(.*)$/.exec(source);
    if (!m) throw new Error('data URL inválida');
    const mime = m[1];
    const isBase64 = !!m[2];
    const payload = decodeURIComponent(m[3]);
    return {
      buffer: Buffer.from(payload, isBase64 ? 'base64' : 'utf8'),
      mime,
    };
  }
  if (/^https?:\/\//i.test(source)) {
    const res = await fetch(source);
    if (!res.ok) throw new Error(`fetch ${source} → ${res.status}`);
    const arr = new Uint8Array(await res.arrayBuffer());
    return {
      buffer: Buffer.from(arr),
      mime: res.headers.get('content-type') || undefined,
    };
  }
  throw new Error('Fuente de imagen no soportada (debe ser http(s) o data:)');
}

function guessMimeFromSource(source: string): string | null {
  if (source.startsWith('data:')) {
    const m = /^data:([^;,]+)/.exec(source);
    return m ? m[1] : null;
  }
  const ext = (source.split('?')[0].split('.').pop() || '').toLowerCase();
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif') return 'image/gif';
  return null;
}

function extFromMime(mime: string): string {
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'image/gif') return 'gif';
  return 'bin';
}

function sanitizeFilename(s: string): string {
  return s.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 80) || 'image';
}

function isShopifyCdnUrl(url: string): boolean {
  return /^https:\/\/(cdn\.shopify\.com|[\w-]+\.myshopify\.com\/cdn\/)/i.test(url);
}

// CSS that nukes the active Shopify theme's chrome around a Page render and
// forces the wrapper to full viewport width. We can't use a custom layout
// (would require write_themes scope), so we go scorched-earth via !important.
// Selectors target Dawn and every Dawn-derived theme (Sense, Refresh, Studio,
// Origin, Crave, Debut, Brooklyn) PLUS Horizon and the new agentic-themes
// architecture (rte-formatter, .section-content-wrapper, .shopify-block,
// .text-block--heading) which Powernax and most fresh stores ship with.
//
// The :has() rule is the load-bearing one for new themes: themes wrap each
// page block (title, content, etc.) in a generic .shopify-block, so we can't
// hard-code "hide the title block" by class. Instead we hide every block
// inside the section content-wrapper that does NOT contain our riverz-landing
// div. :has() is supported in every browser shipped after late 2023.
const FULL_WIDTH_RESET_CSS = `
/* ── 1. Hide store chrome (announcement bar, header, footer, breadcrumbs) ── */
#shopify-section-announcement-bar,
#shopify-section-header, #shopify-section-footer,
.shopify-section-header, .shopify-section-footer,
.shopify-section-group-header-group, .shopify-section-group-footer-group,
[id*="shopify-section-announcement"],
[id*="shopify-section-header"],
[id*="shopify-section-footer"],
header.section-header, header.site-header, header[role="banner"],
footer.site-footer, footer.footer, footer[role="contentinfo"],
.announcement-bar, .announcement-bar-section,
.header-wrapper, .header__wrapper,
.breadcrumb, .breadcrumbs, nav.breadcrumb {
  display: none !important;
}

/* ── 2. Hide auto-rendered page title across theme generations ── */
/* Dawn / older themes — title has a known class */
.template-page .main-page-title,
.template-page .page__title,
.template-page .page-title,
.template-page main h1:first-of-type,
main .page-width > .main-page-title,
main .page-width > .page__title,
.page__header, .main-page-header, .section-header__title,
/* Horizon / new themes — title sits in a .text-block--heading sibling of the rte block */
.section-content-wrapper > .text-block,
.section-content-wrapper > .text-block--heading,
.section-content-wrapper > div.text-block,
.layout-panel-flex > .text-block {
  display: none !important;
}

/* Catch-all for Horizon-style block layouts: hide every direct child of the
   section content wrapper that does NOT contain our landing wrapper. */
.section-content-wrapper > *:not(:has([id^="riverz-landing-"])) {
  display: none !important;
}
.section-content-wrapper > :has([id^="riverz-landing-"]) {
  display: block !important;
}

/* ── 3. Force every wrapper from <body> down to riverz-landing to full width ── */
html, body { margin: 0 !important; padding: 0 !important; overflow-x: hidden !important; background: #fff !important; max-width: 100vw !important; }
main, #MainContent, [role="main"], .content-for-layout, .main-content,
.template-page main, .template-page .main-content,
.shopify-section, .shopify-section--main-page, .section-wrapper,
.section, .layout-panel-flex, .layout-panel-flex--column,
.section-content-wrapper,
.shopify-block, .shopify-block.rte,
.page, .page-width, .page__content, .main-page,
.rte, .container, .grid, .grid__item, .layout {
  max-width: 100% !important;
  width: 100% !important;
  margin: 0 !important;
  padding: 0 !important;
  background: transparent !important;
}

/* Horizon's page section is a CSS grid — width: 100% on a grid item is sized
   by the parent's grid track, not the parent's box, so we have to neutralise
   the grid (display: block) to give the child the full row to itself. */
.section.page-width-content,
.page-width-content,
.section.page-width,
.section.full-width {
  display: block !important;
  grid-template-columns: none !important;
  grid-template-rows: none !important;
  gap: 0 !important;
  max-width: 100% !important;
  width: 100% !important;
  margin: 0 !important;
  padding: 0 !important;
}
.section-content-wrapper {
  display: block !important;
  grid-column: 1 / -1 !important;
}

/* The Horizon Web Component that renders rich-text blocks */
rte-formatter {
  display: block !important;
  width: 100% !important;
  max-width: 100% !important;
  padding: 0 !important;
  margin: 0 !important;
}

/* Our own landing wrapper — force fluid width, the inner sections handle their own layout */
[id^="riverz-landing-"] {
  width: 100% !important;
  max-width: 100% !important;
  margin: 0 !important;
  padding: 0 !important;
}

/* Some themes drop a min-height/padding on main; flatten it */
main, #MainContent { min-height: 0 !important; }
`.trim();

function wrapForFullWidth(bodyHtml: string): string {
  return `<style data-riverz-reset>${FULL_WIDTH_RESET_CSS}</style>\n${bodyHtml}`;
}
