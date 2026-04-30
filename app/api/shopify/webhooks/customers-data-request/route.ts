import { NextResponse } from 'next/server';
import { getShopifyEnv, verifyWebhookHmac } from '@/lib/shopify/oauth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GDPR mandatory webhook: customers/data_request.
 * Shopify rejects new app submissions (and disables existing apps over
 * time) if the three GDPR endpoints don't 200 within ~5s with a valid
 * HMAC check.
 *
 * Riverz's Shopify integration NEVER stores Shopify-customer PII — we
 * only persist a per-merchant access token + the merchant's shop domain
 * (which Shopify already has). So we have nothing to send back. We still
 * verify HMAC and acknowledge so the compliance check passes.
 */
export async function POST(req: Request) {
  const rawBody = await req.text();
  const headerHmac = req.headers.get('x-shopify-hmac-sha256');
  let env;
  try {
    env = getShopifyEnv();
  } catch {
    return new NextResponse('Server misconfigured', { status: 500 });
  }
  if (!verifyWebhookHmac(rawBody, headerHmac, env.apiSecret)) {
    return new NextResponse('Invalid HMAC', { status: 401 });
  }
  return NextResponse.json({ ok: true, note: 'no Shopify customer PII stored by this app' });
}
