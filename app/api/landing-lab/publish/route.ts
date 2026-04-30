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

  // 1) Upload every image referenced by the editor and replace placeholders.
  const imageMap: Record<string, string> = {};
  let bodyHtml = payload.body_html;
  if (payload.images?.length) {
    for (const img of payload.images) {
      try {
        const bytes = await fetchAsBuffer(img.source);
        const mimeType = guessMimeFromSource(img.source) || 'image/png';
        const filename = sanitizeFilename(`${payload.project_id}__${img.slot}`) + '.' + extFromMime(mimeType);
        const uploaded = await uploadImageToShopify(client, {
          bytes: bytes.buffer,
          filename,
          mimeType: bytes.mime || mimeType,
          altText: img.alt || `${payload.title} — ${img.slot}`,
        });
        imageMap[img.slot] = uploaded.cdnUrl;
        bodyHtml = bodyHtml.split(img.placeholder).join(uploaded.cdnUrl);
      } catch (e: any) {
        return NextResponse.json(
          { error: `Falla al subir imagen ${img.slot}: ${e.message}` },
          { status: 502 },
        );
      }
    }
  }

  // 2) Has this project already been published to this shop? If so update,
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

  // 3) Persist the publish so a republish updates instead of duplicating.
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
