import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Shopify OAuth helpers.
 *
 * Shopify rejects shop domains it doesn't own and silently 404s on bad
 * callbacks, so we keep the validation in one place and have every route
 * import from here. HMAC verification follows the spec at
 * https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/authorization-code-grant
 */

// Shopify dev-store hostnames are <slug>.myshopify.com. The slug is 3+ chars,
// alphanumeric + dashes. We're strict here because a wrong shop in the URL
// means an OAuth redirect to an attacker-controlled host.
const SHOP_DOMAIN_RE = /^[a-z0-9][a-z0-9-]{1,}\.myshopify\.com$/i;

/** Normalize "vitalu", "vitalu.myshopify.com", "https://vitalu.myshopify.com" → "vitalu.myshopify.com". */
export function normalizeShopDomain(input: string): string | null {
  if (!input) return null;
  let s = input.trim().toLowerCase();
  s = s.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (!s.includes('.')) s = `${s}.myshopify.com`;
  return SHOP_DOMAIN_RE.test(s) ? s : null;
}

export interface ShopifyEnv {
  apiKey: string;
  apiSecret: string;
  redirectUri: string;
  scopes: string;
  apiVersion: string;
}

export function getShopifyEnv(): ShopifyEnv {
  const apiKey = process.env.SHOPIFY_API_KEY;
  const apiSecret = process.env.SHOPIFY_API_SECRET;
  const redirectUri = process.env.SHOPIFY_OAUTH_REDIRECT_URI;
  if (!apiKey || !apiSecret || !redirectUri) {
    throw new Error(
      'Shopify OAuth no está configurado: faltan SHOPIFY_API_KEY, SHOPIFY_API_SECRET o SHOPIFY_OAUTH_REDIRECT_URI.',
    );
  }
  // Minimal scopes for the publish flow:
  //   write_files   → Files API (image uploads via stagedUploadsCreate)
  //   write_content → Online Store Pages (pageCreate / pageUpdate)
  // read_* counterparts are implied by the write ones for these resources.
  const scopes = process.env.SHOPIFY_SCOPES || 'write_files,write_content';
  const apiVersion = process.env.SHOPIFY_API_VERSION || '2025-01';
  return { apiKey, apiSecret, redirectUri, scopes, apiVersion };
}

export function buildAuthorizeUrl(opts: {
  shop: string;
  state: string;
  apiKey: string;
  redirectUri: string;
  scopes: string;
}): string {
  const params = new URLSearchParams({
    client_id: opts.apiKey,
    scope: opts.scopes,
    redirect_uri: opts.redirectUri,
    state: opts.state,
    // 'per-user' would yield short-lived online tokens; we want offline access
    // because publishing happens server-side hours/days after install.
    'grant_options[]': '',
  });
  return `https://${opts.shop}/admin/oauth/authorize?${params.toString()}`;
}

/**
 * Verify Shopify's HMAC on an OAuth callback / proxy request.
 * Per the docs, you sort all params except `hmac` (and `signature` if present),
 * urlencode them, and HMAC-SHA256 the result with the API secret.
 */
export function verifyOAuthHmac(searchParams: URLSearchParams, secret: string): boolean {
  const received = searchParams.get('hmac');
  if (!received) return false;

  const entries: [string, string][] = [];
  searchParams.forEach((v, k) => {
    if (k === 'hmac' || k === 'signature') return;
    entries.push([k, v]);
  });
  entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const message = entries
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

  const expected = createHmac('sha256', secret).update(message).digest('hex');
  return safeEqualHex(expected, received);
}

/**
 * Verify the X-Shopify-Hmac-Sha256 header sent on every webhook call.
 * The HMAC is computed over the raw request body using the API secret,
 * and is base64-encoded (unlike OAuth HMAC which is hex).
 */
export function verifyWebhookHmac(rawBody: string | Buffer, headerHmac: string | null, secret: string): boolean {
  if (!headerHmac) return false;
  const body = typeof rawBody === 'string' ? Buffer.from(rawBody, 'utf8') : rawBody;
  const expected = createHmac('sha256', secret).update(body).digest('base64');
  return safeEqualBase64(expected, headerHmac);
}

function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  } catch {
    return false;
  }
}

function safeEqualBase64(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, 'base64');
    const bb = Buffer.from(b, 'base64');
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

/** Exchange the temporary code returned in the OAuth callback for a permanent offline access token. */
export async function exchangeCodeForToken(opts: {
  shop: string;
  code: string;
  apiKey: string;
  apiSecret: string;
}): Promise<{ access_token: string; scope: string }> {
  const res = await fetch(`https://${opts.shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: opts.apiKey,
      client_secret: opts.apiSecret,
      code: opts.code,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Shopify token exchange failed (${res.status}): ${text}`);
  }
  const data = (await res.json()) as { access_token?: string; scope?: string };
  if (!data.access_token) {
    throw new Error('Shopify token exchange returned no access_token');
  }
  return { access_token: data.access_token, scope: data.scope || '' };
}
