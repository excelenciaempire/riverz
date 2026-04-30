import { NextResponse } from 'next/server';
import { getShopifyEnv, verifyWebhookHmac } from '@/lib/shopify/oauth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GDPR mandatory webhook: customers/redact. See customers-data-request for rationale. */
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
  return NextResponse.json({ ok: true });
}
