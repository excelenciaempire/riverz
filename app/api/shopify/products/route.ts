import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getShopifyConnection } from '@/lib/shopify/connection';
import { ShopifyAdminClient } from '@/lib/shopify/admin-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/shopify/products?q=<search>&first=20&shop=<domain>
 *
 * Lists active products from the user's connected Shopify store, used by the
 * Landing Lab editor's "Elegir producto" picker. Returns the bits the picker
 * needs to render a card (title, image, price range) and to populate the
 * landing's slots when the user picks "auto-rellenar contenido" — handle
 * (for the runtime cart wiring), title, featured image, and the first
 * variant's price + compare-at.
 *
 * Auth: Clerk session + an active Shopify connection on the same account.
 *
 * Scope: requires read_products. Connections installed before that scope was
 * added to oauth.ts will hit a 403 — the route translates that into
 * { requiresReconnect: true } so the editor can surface a reconnect prompt
 * without dumping a raw GraphQL error on the user.
 */
export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const q = (url.searchParams.get('q') || '').trim();
  const firstRaw = parseInt(url.searchParams.get('first') || '20', 10);
  const first = Math.min(50, Math.max(1, isFinite(firstRaw) ? firstRaw : 20));
  const shopDomain = url.searchParams.get('shop') || undefined;

  const conn = await getShopifyConnection({ clerkUserId: userId, shopDomain });
  if (!conn.ok) {
    return NextResponse.json(
      { error: conn.error, requiresReconnect: conn.requiresReconnect },
      { status: conn.status },
    );
  }

  const client = new ShopifyAdminClient(conn.shop, conn.token);

  // Shopify search syntax: `title:*foo* OR handle:*foo*` — but * wildcards on
  // arbitrary fields are quirky. The default `query` argument already does a
  // fuzzy match across title/sku/vendor/etc., so we just pass the user's
  // string through verbatim. Status filter pinned to ACTIVE so the picker
  // doesn't surface drafts/archived.
  const searchQuery = q ? `status:active AND ${q}` : 'status:active';

  const QUERY = /* GraphQL */ `
    query LandingLabProducts($q: String, $first: Int!) {
      products(first: $first, query: $q, sortKey: UPDATED_AT, reverse: true) {
        edges {
          node {
            id
            handle
            title
            status
            totalInventory
            featuredMedia {
              preview { image { url altText } }
            }
            images(first: 10) {
              edges {
                node {
                  url
                  altText
                }
              }
            }
            priceRangeV2 {
              minVariantPrice { amount currencyCode }
              maxVariantPrice { amount currencyCode }
            }
            compareAtPriceRange {
              minVariantCompareAtPrice { amount currencyCode }
              maxVariantCompareAtPrice { amount currencyCode }
            }
            variants(first: 25) {
              edges {
                node {
                  id
                  title
                  price
                  compareAtPrice
                  availableForSale
                }
              }
            }
          }
        }
      }
    }
  `;

  let raw: any;
  try {
    raw = await client.graphql(QUERY, { q: searchQuery, first });
  } catch (e: any) {
    const msg = String(e?.message || '');
    // Insufficient scope manifests as a 403 with ACCESS_DENIED in the
    // GraphQL error body. Treat it like a missing connection so the editor
    // can prompt the user to reconnect (which will request read_products).
    if (/403|ACCESS_DENIED|access denied|Required access/i.test(msg)) {
      return NextResponse.json(
        {
          error:
            'Tu conexión Shopify no tiene permiso para leer productos. Reconectá la tienda para autorizar el acceso.',
          requiresReconnect: true,
        },
        { status: 403 },
      );
    }
    return NextResponse.json({ error: 'Shopify error: ' + msg }, { status: 502 });
  }

  const edges: any[] = raw?.products?.edges || [];
  const products = edges.map((edge) => {
    const n = edge.node;
    const variants: any[] = (n.variants?.edges || []).map((ve: any) => ({
      id: gidToNumeric(ve.node.id),
      title: ve.node.title,
      price: ve.node.price,
      compareAtPrice: ve.node.compareAtPrice,
      available: ve.node.availableForSale,
    }));
    const minPrice = n.priceRangeV2?.minVariantPrice;
    const maxPrice = n.priceRangeV2?.maxVariantPrice;
    const minCompareAt = n.compareAtPriceRange?.minVariantCompareAtPrice;
    const featured = n.featuredMedia?.preview?.image?.url || null;
    const allImages: Array<{ url: string; alt: string | null }> = (n.images?.edges || [])
      .map((ie: any) => ({ url: ie.node.url, alt: ie.node.altText || null }))
      .filter((x: any) => !!x.url);
    // Make sure the featured image is index 0 — Shopify already orders this
    // way 99% of the time but `images` ordering is by position and a merchant
    // may have manually reordered after picking a featured one.
    if (featured && allImages.length && allImages[0].url !== featured) {
      const fIdx = allImages.findIndex((x) => x.url === featured);
      if (fIdx > 0) {
        const [f] = allImages.splice(fIdx, 1);
        allImages.unshift(f);
      }
    }
    return {
      id: gidToNumeric(n.id),
      handle: n.handle,
      title: n.title,
      status: n.status,
      totalInventory: n.totalInventory,
      image: featured,
      imageAlt: n.featuredMedia?.preview?.image?.altText || null,
      images: allImages,
      priceMin: minPrice?.amount || null,
      priceMax: maxPrice?.amount || null,
      currencyCode: minPrice?.currencyCode || 'USD',
      compareAtMin: minCompareAt?.amount || null,
      variants,
    };
  });

  return NextResponse.json({
    shop: conn.shop,
    products,
    count: products.length,
  });
}

function gidToNumeric(gid: string | null | undefined): string | null {
  if (!gid) return null;
  const m = /\/(\d+)(?:\?.*)?$/.exec(gid);
  return m ? m[1] : gid;
}
