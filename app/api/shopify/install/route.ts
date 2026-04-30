import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { randomBytes } from 'crypto';
import { buildAuthorizeUrl, getShopifyEnv, normalizeShopDomain } from '@/lib/shopify/oauth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Start the Shopify OAuth flow.
 * Expects ?shop=<domain> — accepts "vitalu", "vitalu.myshopify.com", or
 * "https://vitalu.myshopify.com" and normalizes to the canonical form.
 *
 * We pin the install to the current Clerk user via two cookies:
 *   - shopify_oauth_state : random nonce echoed back in the callback
 *   - shopify_oauth_user  : the userId we expect to finalize the install
 * Cookies are httpOnly + lax so an attacker can't trigger a callback that
 * silently associates a foreign shop with this account.
 */
export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const shopRaw = url.searchParams.get('shop') || '';
  const shop = normalizeShopDomain(shopRaw);
  if (!shop) {
    return NextResponse.json(
      { error: 'Shop inválido. Usa el formato tu-tienda.myshopify.com' },
      { status: 400 },
    );
  }

  let env;
  try {
    env = getShopifyEnv();
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }

  const state = randomBytes(32).toString('hex');
  const authorizeUrl = buildAuthorizeUrl({
    shop,
    state,
    apiKey: env.apiKey,
    redirectUri: env.redirectUri,
    scopes: env.scopes,
  });

  const res = NextResponse.redirect(authorizeUrl);
  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 60 * 10,
    path: '/',
  };
  res.cookies.set('shopify_oauth_state', state, cookieOpts);
  res.cookies.set('shopify_oauth_user', userId, cookieOpts);
  res.cookies.set('shopify_oauth_shop', shop, cookieOpts);
  return res;
}
