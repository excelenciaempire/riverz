import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getShopifyConnection } from '@/lib/shopify/connection';
import { ShopifyAdminClient } from '@/lib/shopify/admin-client';
import { uploadImageToShopify } from '@/lib/shopify/files';
import {
  getMainTheme,
  upsertThemeAsset,
  buildSectionLiquid,
  buildProductTemplateJson,
} from '@/lib/shopify/themes';

export const runtime = 'nodejs';
// Theme asset upload + image re-upload + Shopify Files staging takes the
// same 10–25s as a normal publish; 60s gives headroom on slow uplinks.
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

/**
 * Publish a Riverz product-page project as a Shopify Online Store 2.0
 * custom product template. This is the path that bundle/upsell apps like
 * Kaching Bundles need — they only render their widgets on real product
 * pages, not on /pages/ Pages.
 *
 * What this route does NOT do:
 *   - It never creates / modifies Shopify Pages. Page-based publishes
 *     keep going through /api/landing-lab/publish, untouched.
 *   - It never assigns the new template to a product. The merchant does
 *     that step in Shopify Admin → Products → <product> → Theme template.
 *     We surface the preview URL (?view=…) so they can review first.
 */

interface PublishThemeRequest {
  shop_domain?: string;
  project_id: string;
  title: string;
  /** Same body_html the Page publish flow builds, with placeholders. */
  body_html: string;
  images?: Array<{ slot: string; placeholder: string; source: string; alt?: string }>;
  /** Product handle the merchant tied to this project (Settings → Producto). */
  shopify_handle?: string;
  /** Allow republish even if scopes look incomplete (defensive override). */
  ignore_scope_warning?: boolean;
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let payload: PublishThemeRequest;
  try {
    payload = (await req.json()) as PublishThemeRequest;
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 });
  }
  if (!payload.project_id || !payload.title || !payload.body_html) {
    return NextResponse.json({ error: 'Faltan project_id, title o body_html' }, { status: 400 });
  }

  const conn = await getShopifyConnection({ clerkUserId: userId, shopDomain: payload.shop_domain });
  if (!conn.ok) {
    return NextResponse.json(
      { error: conn.error, requiresReconnect: conn.requiresReconnect },
      { status: conn.status },
    );
  }

  // Theme writes need write_themes. Shopify collapses paired scopes —
  // when you request `read_themes,write_themes` the granted-scope
  // string only echoes `write_themes` (write implies read), so we
  // ONLY require write_themes here. The earlier 'read_themes' check
  // produced false-negative reconnect prompts after a successful
  // re-auth (the user's connection had write_themes but the granted
  // scope list omitted the implied read_themes).
  const scopes = new Set((conn.scope || '').split(',').map((s) => s.trim()).filter(Boolean));
  if (!scopes.has('write_themes') && !payload.ignore_scope_warning) {
    return NextResponse.json(
      {
        error:
          'Reconectá Shopify para activar Product Pages — falta el permiso write_themes. Andá a Configuración → Integraciones → Reconectar Shopify y autorizá los nuevos permisos.',
        requiresReconnect: true,
        missingScopes: ['write_themes'],
      },
      { status: 403 },
    );
  }

  const client = new ShopifyAdminClient(conn.shop, conn.token);

  let primaryDomain: string;
  try {
    primaryDomain = (await client.getShopInfo()).primaryDomain;
  } catch (e: any) {
    return NextResponse.json({ error: 'No se pudo leer la tienda: ' + e.message }, { status: 502 });
  }

  let theme;
  try {
    theme = await getMainTheme(client);
  } catch (e: any) {
    return NextResponse.json(
      {
        error: 'No se pudo leer el theme principal de Shopify: ' + (e.message || 'desconocido'),
        requiresReconnect: /401|403|access denied/i.test(e.message || ''),
      },
      { status: 502 },
    );
  }

  // 1) Same image substitution as the Page publish: each placeholder gets
  //    swapped for a Shopify CDN URL after fetching + uploading the bytes.
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
          const filename =
            sanitizeFilename(`${payload.project_id}__${img.slot}`) + '.' + extFromMime(mimeType);
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

  // 2) Wrap the editor body for theme context. We DON'T use the
  //    Page-publish FULL_WIDTH_RESET_CSS here — the merchant's product
  //    template renders inside the theme's normal layout (header +
  //    footer remain, which is correct for a product page). We only
  //    add a minimal full-width reset so our section spans the
  //    section-wrapper instead of being clamped by .page-width.
  const themeReset = buildThemeReset();

  // 3) Build the section + template files. Section name uses the
  //    project id for stability across republishes (same id → same
  //    file → no orphaned assets).
  const sectionTag = sanitizeSectionTag(payload.project_id);
  const sectionFileName = `riverz-landing-${sectionTag}`;
  const sectionKey = `sections/${sectionFileName}.liquid`;
  const templateName = `riverz-${sectionTag}`;
  const templateKey = `templates/product.${templateName}.json`;

  const sectionLiquid = buildSectionLiquid({
    bodyHtml,
    cssBlock: themeReset,
    fontsLink: '', // body_html already carries the template's own <link rel="stylesheet"> tags
    inlineScripts: [],
    sectionTag,
    shopifyHandle: payload.shopify_handle,
  });
  const templateJson = buildProductTemplateJson(sectionFileName);

  // 4) Upsert both assets. Section first so the template (which
  //    references it by name) never points to a missing section.
  try {
    await upsertThemeAsset(client, theme.id, { key: sectionKey, value: sectionLiquid });
    await upsertThemeAsset(client, theme.id, { key: templateKey, value: templateJson });
  } catch (e: any) {
    return NextResponse.json(
      {
        error: 'Falla al subir asset al theme: ' + (e.message || 'desconocido'),
        requiresReconnect: /401|403|access denied/i.test(e.message || ''),
      },
      { status: 502 },
    );
  }

  const supabase = createAdminClient();
  const handle = (payload.shopify_handle || '').replace(/^\/products\//, '').replace(/[^a-z0-9-]/gi, '');

  // 4b) If the user linked a product handle in Riverz Settings, assign
  //     this template to it automatically — saves the user the manual
  //     "Shopify Admin → Productos → Theme template" step. We do a
  //     lookup-by-handle, productUpdate(templateSuffix), and on
  //     success the public /products/<handle> URL renders the Riverz
  //     landing immediately. Failures here are NOT fatal: the
  //     section + template files are already live in the theme, the
  //     user can always assign the template manually as a fallback.
  let assignedToProduct = false;
  let assignError: string | null = null;
  // Only attempt the auto-assign if the connection actually has
  // write_products. Existing connections from before this feature
  // shipped only have read_products → productUpdate would 403.
  // Skipping cleanly here keeps the user out of a confusing "publish
  // succeeded BUT productUpdate threw access denied" error path.
  const canWriteProducts = scopes.has('write_products');
  if (handle && !canWriteProducts) {
    assignError = 'Tu conexión Shopify no incluye write_products todavía. Reconectá Shopify (Configuración → Integraciones) para activar la asignación automática del template; mientras tanto asigná el template manualmente.';
  }
  if (handle && canWriteProducts) {
    try {
      type ProductByHandleRes = {
        productByHandle: { id: string; title: string; templateSuffix: string | null } | null;
      };
      const lookup = await client.graphql<ProductByHandleRes>(
        `query ProductByHandle($handle: String!) {
           productByHandle(handle: $handle) { id title templateSuffix }
         }`,
        { handle },
      );
      const product = lookup.productByHandle;
      if (!product) {
        assignError = `Producto "${handle}" no encontrado en Shopify`;
      } else {
        type AssignRes = {
          productUpdate: {
            product: { id: string; templateSuffix: string | null } | null;
            userErrors: Array<{ field: string[]; message: string }>;
          };
        };
        const assigned = await client.graphql<AssignRes>(
          `mutation AssignTpl($product: ProductUpdateInput!) {
             productUpdate(product: $product) {
               product { id templateSuffix }
               userErrors { field message }
             }
           }`,
          { product: { id: product.id, templateSuffix: templateName } },
        );
        if (assigned.productUpdate.userErrors.length) {
          assignError = 'productUpdate: ' + JSON.stringify(assigned.productUpdate.userErrors);
        } else {
          assignedToProduct = true;
        }
      }
    } catch (e: any) {
      assignError = e?.message || 'desconocido';
      console.error('[publish-theme] auto-assign failed:', assignError);
    }
  }

  // 5) Persist so a republish hits the same files (no orphan assets) and
  //    so "Mis páginas" can show the publish target + URL.
  const previewUrl = handle
    ? `https://${primaryDomain}/products/${handle}?view=${templateName}`
    : `https://${primaryDomain}/?view=${templateName}`;
  const publicUrl = handle ? `https://${primaryDomain}/products/${handle}` : null;

  await supabase
    .from('shopify_published_theme_templates')
    .upsert(
      {
        clerk_user_id: userId,
        connection_id: conn.connectionId,
        shop_domain: conn.shop,
        local_project_id: payload.project_id,
        local_project_name: payload.title,
        theme_id: theme.gid,
        theme_name: theme.name,
        template_key: templateKey,
        section_key: sectionKey,
        product_handle: handle || null,
        image_map: imageMap,
        preview_url: previewUrl,
        public_url: publicUrl,
        published_at: new Date().toISOString(),
      },
      { onConflict: 'clerk_user_id,shop_domain,local_project_id' },
    );

  // The publish itself ALWAYS succeeded by the time we reach this
  // point — section + template assets are live in the merchant's
  // theme. Whether or not the user passed a shopify_handle only
  // affects the preview URL we suggest. The next_steps message used
  // to imply the publish failed when no handle was set ("Configurá
  // un producto…"), confusing users who already had a product in
  // Shopify but hadn't linked it inside Riverz Settings. New copy
  // makes the success explicit and gives the same Admin → assign
  // template instructions either way.
  return NextResponse.json({
    ok: true,
    template: {
      key: templateKey,
      name: templateName,
      section_key: sectionKey,
    },
    preview_url: previewUrl,
    public_url: publicUrl,
    image_map: imageMap,
    assigned_to_product: assignedToProduct,
    assign_error: assignError,
    next_steps: assignedToProduct
      ? '✓ Listo — tu producto "' + handle + '" ya usa esta plantilla.\n\nAbrí ' + publicUrl + ' para ver la landing en vivo.'
      : handle
        ? '✓ Theme template publicado.\n\nNo pude asignarlo automáticamente al producto "' + handle + '"' + (assignError ? ' (' + assignError + ')' : '') + '.\n\nAsignación manual:\n1. Shopify Admin → Productos → "' + handle + '".\n2. En "Online store" elegí Theme template = "' + templateName + '".\n\nMientras tanto, preview:\n' + previewUrl
        : '✓ Theme template publicado en tu theme.\n\nPara que un producto lo use:\n1. Cargá el handle del producto en Riverz → Ajustes → "Producto Shopify" y republicá (Riverz lo asigna solo).\n2. O hacelo manualmente en Shopify Admin → Productos → tu producto → "Online store" → Theme template = "' + templateName + '".\n\nPreview sin asignar:\n' + previewUrl,
  });
}

// ---------- helpers (kept inline so the existing /publish route stays untouched) ----------

async function fetchAsBuffer(source: string): Promise<{ buffer: Buffer; mime?: string }> {
  if (source.startsWith('data:')) {
    const m = /^data:([^;,]+)(;base64)?,(.*)$/.exec(source);
    if (!m) throw new Error('data URL inválida');
    const mime = m[1];
    const isBase64 = !!m[2];
    const data = decodeURIComponent(m[3]);
    return { buffer: Buffer.from(data, isBase64 ? 'base64' : 'utf8'), mime };
  }
  if (/^https?:\/\//i.test(source)) {
    const res = await fetch(source);
    if (!res.ok) throw new Error(`fetch ${source} → ${res.status}`);
    const arr = new Uint8Array(await res.arrayBuffer());
    return { buffer: Buffer.from(arr), mime: res.headers.get('content-type') || undefined };
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

function sanitizeSectionTag(projectId: string): string {
  // Section file names must be lowercase letters, numbers, hyphens, and
  // underscores per Shopify's asset naming. Riverz project ids are
  // already in that range (`p` + base36) but be defensive.
  return projectId.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 50) || 'project';
}

/**
 * Theme-context CSS reset. Way smaller than the Page-publish reset because
 * we ARE the product template — no need to hide the theme's product info,
 * it isn't rendered. Just make sure our section spans full width inside
 * whatever wrapper the theme uses for sections AND hide the Riverz
 * template's own announcement bar / header — those duplicate the
 * Shopify theme's announcement bar + nav, which already render above
 * us on every product page (especially noticeable on mobile, where
 * stacking two headers leaves the hero pushed below the fold).
 */
function buildThemeReset(): string {
  return `
[id^="riverz-landing-"] { width: 100% !important; max-width: 100% !important; margin: 0 !important; padding: 0 !important; }
[id^="riverz-landing-"] img,
[id^="riverz-landing-"] video,
[id^="riverz-landing-"] picture { max-width: 100% !important; height: auto; }
[id^="riverz-landing-"] .vid-ph video { width: 100% !important; height: 100% !important; object-fit: cover; display: block; }
.shopify-section--main-product .page-width,
.shopify-section--main-product .container,
.shopify-section .page-width:has([id^="riverz-landing-"]),
.shopify-section .container:has([id^="riverz-landing-"]) {
  max-width: 100% !important; width: 100% !important; padding: 0 !important; margin: 0 !important;
}
/* Hide Riverz template's redundant chrome — the storefront theme provides
   its own announcement bar + nav header, so rendering ours on top makes
   the hero start below the fold on mobile. */
[id^="riverz-landing-"] .pp-announce,
[id^="riverz-landing-"] header.pp-header,
[id^="riverz-landing-"] .pp-header { display: none !important; }
/* Tighten the hero spacing once the redundant header is gone — the
   .pp-hero default top padding compensated for the announcement bar. */
[id^="riverz-landing-"] .pp-hero { padding-top: 0 !important; }
@media (max-width: 768px) {
  [id^="riverz-landing-"] .pp-hero { padding: 0 !important; gap: 18px !important; }
  [id^="riverz-landing-"] .pp { padding-left: 14px !important; padding-right: 14px !important; }
}
`.trim();
}
