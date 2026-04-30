import { NextResponse } from 'next/server';
import {
  exchangeCodeForToken,
  getShopifyEnv,
  normalizeShopDomain,
  verifyOAuthHmac,
} from '@/lib/shopify/oauth';
import { persistShopifyConnection } from '@/lib/shopify/connection';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SETTINGS_PATH = '/configuracion?tab=integrations';

function bounce(req: Request, params: Record<string, string>): NextResponse {
  const base = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
  const url = new URL(SETTINGS_PATH, base);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = NextResponse.redirect(url);
  // Clean up the install-time cookies so a stale state can't be replayed.
  for (const name of ['shopify_oauth_state', 'shopify_oauth_user', 'shopify_oauth_shop']) {
    res.cookies.set(name, '', { path: '/', maxAge: 0 });
  }
  return res;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const params = url.searchParams;

  const cookieJar = req.headers.get('cookie') || '';
  const expectedState = readCookie(cookieJar, 'shopify_oauth_state');
  const expectedShop = readCookie(cookieJar, 'shopify_oauth_shop');
  const userId = readCookie(cookieJar, 'shopify_oauth_user');

  let env;
  try {
    env = getShopifyEnv();
  } catch (err: any) {
    return bounce(req, { shopify: 'error', reason: 'config' });
  }

  // 1) Verify HMAC over the query string. Shopify signs the callback so we
  //    can detect tampering before doing anything else.
  if (!verifyOAuthHmac(params, env.apiSecret)) {
    return bounce(req, { shopify: 'error', reason: 'hmac' });
  }

  // 2) State must match the cookie we set on /install. Without this anyone
  //    can craft a callback URL and bind their shop to your session.
  const state = params.get('state');
  if (!state || !expectedState || state !== expectedState) {
    return bounce(req, { shopify: 'error', reason: 'state' });
  }

  // 3) The shop in the query must be a real *.myshopify.com and match the
  //    shop the user typed on /install. Defense in depth against a stolen
  //    code being replayed against a different store.
  const shop = normalizeShopDomain(params.get('shop') || '');
  if (!shop) return bounce(req, { shopify: 'error', reason: 'bad_shop' });
  if (expectedShop && shop !== expectedShop) {
    return bounce(req, { shopify: 'error', reason: 'shop_mismatch' });
  }

  // 4) We must have a logged-in Riverz user to associate the install with.
  //    If the cookie is gone (session expired during the dance), bail and
  //    ask them to retry — we don't want orphan connection rows.
  if (!userId) return bounce(req, { shopify: 'error', reason: 'no_user' });

  const code = params.get('code');
  if (!code) return bounce(req, { shopify: 'error', reason: 'no_code' });

  // 5) Exchange the temporary code for a permanent offline token + persist.
  try {
    const { access_token, scope } = await exchangeCodeForToken({
      shop,
      code,
      apiKey: env.apiKey,
      apiSecret: env.apiSecret,
    });

    await persistShopifyConnection({
      clerkUserId: userId,
      shopDomain: shop,
      accessToken: access_token,
      scope,
    });

    return bounce(req, { shopify: 'connected', shop });
  } catch (err: any) {
    console.error('[shopify/callback] token exchange or persist failed:', err);
    return bounce(req, { shopify: 'error', reason: 'exchange' });
  }
}

function readCookie(cookieHeader: string, name: string): string | null {
  for (const part of cookieHeader.split(/;\s*/)) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    if (part.slice(0, eq) === name) return decodeURIComponent(part.slice(eq + 1));
  }
  return null;
}
