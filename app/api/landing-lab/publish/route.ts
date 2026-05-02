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
      });
    } else {
      result = await createPage(client, primaryDomain, {
        title: payload.title,
        bodyHtml,
        handle: payload.handle,
        published: payload.published,
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
// forces the body wrapper to full viewport width. We can't use a custom
// layout/template (would require write_themes scope + per-merchant theme edits),
// so we go scorched-earth via !important rules. Selectors cover Dawn and
// every Dawn-derived theme we've tested (Sense, Refresh, Studio, Origin,
// Crave, Powernax, plus older Debut/Brooklyn fallbacks).
const FULL_WIDTH_RESET_CSS = `
/* Hide announcement bar, header, footer, breadcrumbs */
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

/* Hide auto-rendered page title — landing has its own hero */
.template-page .main-page-title,
.template-page .page__title,
.template-page .page-title,
.template-page main h1:first-of-type,
main .page-width > .main-page-title,
main .page-width > .page__title,
.page__header, .main-page-header, .section-header__title {
  display: none !important;
}

/* Force every wrapper between <body> and our content to full width, no padding */
html, body { margin: 0 !important; padding: 0 !important; overflow-x: hidden !important; background: #fff !important; }
main, #MainContent, [role="main"], .content-for-layout, .main-content,
.template-page main, .template-page .main-content,
.shopify-section, .shopify-section--main-page,
.page, .page-width, .page__content, .main-page,
.rte, .container, .grid, .grid__item, .layout {
  max-width: 100% !important;
  width: 100% !important;
  margin: 0 !important;
  padding: 0 !important;
  background: transparent !important;
}

/* Some themes drop a min-height/padding on main; flatten it */
main, #MainContent { min-height: 0 !important; }
`.trim();

function wrapForFullWidth(bodyHtml: string): string {
  return `<style data-riverz-reset>${FULL_WIDTH_RESET_CSS}</style>\n${bodyHtml}`;
}
