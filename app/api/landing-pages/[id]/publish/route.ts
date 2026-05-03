/**
 * Publish V2 — toma una página del editor v2, renderiza su document a HTML
 * y delega al pipeline existente de Shopify (`/api/landing-lab/publish`).
 *
 * Esta capa existe para no acoplar el editor v2 al schema antiguo del
 * publish endpoint. Si mañana cambiamos el contrato del publish endpoint
 * (e.g. nuevo formato de imágenes), sólo tocamos aquí.
 *
 * Body:
 *   {
 *     shop_domain?: string;   // si el usuario tiene >1 tienda
 *     handle?: string;        // override del slug
 *     published?: boolean;    // default true
 *   }
 */

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/server';
import { renderPageDocument } from '@/lib/sections/render';
import { getShopifyConnection } from '@/lib/shopify/connection';
import { ShopifyAdminClient } from '@/lib/shopify/admin-client';
import { createPage, updatePage } from '@/lib/shopify/pages';
import type { PageDocument } from '@/types/landing-pages';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

interface PublishBody {
  shop_domain?: string;
  handle?: string;
  published?: boolean;
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: PublishBody = {};
  try {
    body = (await req.json()) as PublishBody;
  } catch {
    /* opcional */
  }

  const supabase = createAdminClient();
  const { data: page, error } = await supabase
    .from('landing_pages')
    .select('id, name, document, clerk_user_id')
    .eq('id', id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!page || page.clerk_user_id !== userId)
    return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // 1) Render document → HTML.
  const doc = page.document as PageDocument;
  const { html, unknownSections } = renderPageDocument(doc);
  if (unknownSections.length > 0) {
    console.warn(`[publish v2] unknown sections in page ${id}:`, unknownSections);
  }

  const title = doc.meta?.title || page.name;
  const handle = body.handle || doc.meta?.handle || slugify(title);

  // 2) Resolver Shopify.
  const conn = await getShopifyConnection({
    clerkUserId: userId,
    shopDomain: body.shop_domain,
  });
  if (!conn.ok)
    return NextResponse.json(
      { error: conn.error, requiresReconnect: conn.requiresReconnect },
      { status: conn.status },
    );

  const client = new ShopifyAdminClient(conn.shop, conn.token);
  let primaryDomain: string;
  try {
    primaryDomain = (await client.getShopInfo()).primaryDomain;
  } catch (e: any) {
    return NextResponse.json({ error: 'No se pudo leer la tienda: ' + e.message }, { status: 502 });
  }

  // 3) Buscar publicación previa para republish (mismo patrón que el publish v1).
  const { data: prev } = await supabase
    .from('shopify_published_landings')
    .select('shopify_page_id, shopify_page_handle')
    .eq('clerk_user_id', userId)
    .eq('shop_domain', conn.shop)
    .eq('local_project_id', id)
    .maybeSingle();

  const pagePayload = {
    title,
    handle,
    bodyHtml: wrapForShopify(html),
    seoTitle: doc.meta?.seoTitle ?? title,
    metaDescription: doc.meta?.metaDescription ?? undefined,
    published: body.published !== false,
  };

  let shopifyPageId: string;
  let shopifyHandle: string;
  let publicUrl: string;
  try {
    const result = prev?.shopify_page_id
      ? await updatePage(client, primaryDomain, prev.shopify_page_id, pagePayload)
      : await createPage(client, primaryDomain, pagePayload);
    shopifyPageId = result.id;
    shopifyHandle = result.handle;
    publicUrl = result.url;
  } catch (e: any) {
    return NextResponse.json({ error: 'Shopify rechazó la página: ' + e.message }, { status: 502 });
  }

  // 4) Bookkeeping.
  await supabase
    .from('shopify_published_landings')
    .upsert(
      {
        clerk_user_id: userId,
        connection_id: conn.connectionId,
        shop_domain: conn.shop,
        local_project_id: id,
        local_project_name: title,
        shopify_page_id: shopifyPageId,
        shopify_page_handle: shopifyHandle,
        shopify_page_url: publicUrl,
        image_map: {},
      },
      { onConflict: 'clerk_user_id,shop_domain,local_project_id' },
    );

  await supabase.from('landing_pages').update({ status: 'published' }).eq('id', id);

  return NextResponse.json({ ok: true, url: publicUrl, shopify_page_id: shopifyPageId });
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'untitled';
}

/**
 * Mismo wrapper de reset CSS que usa publish v1, condensado. Oculta el
 * header/footer del theme y deja la landing full-bleed.
 */
function wrapForShopify(html: string): string {
  const css = `
<style>
  .shopify-section-header, .shopify-section-footer, header.section-header, footer.site-footer { display: none !important; }
  .page-width { max-width: none !important; padding: 0 !important; }
  .riverz-landing { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.5; }
  .riverz-landing * { box-sizing: border-box; }
  .riverz-landing img { max-width: 100%; height: auto; }
</style>`.trim();
  return `${css}\n${html}`;
}
