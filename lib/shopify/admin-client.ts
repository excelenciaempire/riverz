/**
 * Thin wrapper around the Shopify Admin GraphQL API.
 * One client per (shop, token). We intentionally don't use a third-party SDK
 * — the surface area we need is tiny (Files + Pages) and adding a SDK means
 * shipping yet another bundle and tracking its breaking changes against
 * the Shopify API version.
 */

const DEFAULT_API_VERSION = process.env.SHOPIFY_API_VERSION || '2025-01';

export class ShopifyAdminClient {
  constructor(
    private readonly shop: string,
    private readonly token: string,
    private readonly apiVersion: string = DEFAULT_API_VERSION,
  ) {}

  async graphql<T = any>(query: string, variables?: Record<string, any>): Promise<T> {
    const url = `https://${this.shop}/admin/api/${this.apiVersion}/graphql.json`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': this.token,
        Accept: 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    });
    const body: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(`Shopify GraphQL ${res.status}: ${JSON.stringify(body).slice(0, 500)}`);
    }
    if (body.errors?.length) {
      throw new Error(`Shopify GraphQL errors: ${JSON.stringify(body.errors).slice(0, 500)}`);
    }
    // Top-level userErrors live under each mutation; surface them too.
    return body.data as T;
  }

  /** Resolve `vitalu.myshopify.com` → the merchant's primary domain (for the public URL). */
  async getShopInfo(): Promise<{ name: string; primaryDomain: string; myshopifyDomain: string }> {
    const data = await this.graphql<{ shop: { name: string; primaryDomain: { url: string }; myshopifyDomain: string } }>(`
      query ShopInfo {
        shop {
          name
          myshopifyDomain
          primaryDomain { url }
        }
      }
    `);
    const url = data.shop.primaryDomain?.url || `https://${data.shop.myshopifyDomain}`;
    return {
      name: data.shop.name,
      primaryDomain: url.replace(/^https?:\/\//, '').replace(/\/$/, ''),
      myshopifyDomain: data.shop.myshopifyDomain,
    };
  }
}
