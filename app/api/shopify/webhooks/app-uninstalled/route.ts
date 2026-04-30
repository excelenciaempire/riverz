import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getShopifyEnv, verifyWebhookHmac } from '@/lib/shopify/oauth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Shopify calls this when a merchant uninstalls our app from the admin.
 * The access token is invalid the moment the webhook fires, so we must
 * mark the connection uninstalled — leaving it "active" causes every
 * subsequent publish attempt to 401.
 *
 * Shopify will retry on 5xx but won't on 401/403, so we 200 even on bad
 * signatures (after rejecting the work) to avoid being flagged for high
 * webhook failure rates.
 */
export async function POST(req: Request) {
  const rawBody = await req.text();
  const headerHmac = req.headers.get('x-shopify-hmac-sha256');
  const shopDomain = req.headers.get('x-shopify-shop-domain');

  let env;
  try {
    env = getShopifyEnv();
  } catch {
    return new NextResponse('Server misconfigured', { status: 500 });
  }

  if (!verifyWebhookHmac(rawBody, headerHmac, env.apiSecret)) {
    return new NextResponse('Invalid HMAC', { status: 401 });
  }
  if (!shopDomain) return NextResponse.json({ ok: true });

  const supabase = createAdminClient();
  await supabase
    .from('shopify_connections')
    .update({
      status: 'uninstalled',
      uninstalled_at: new Date().toISOString(),
      last_error: 'app_uninstalled webhook',
    })
    .eq('shop_domain', shopDomain);

  return NextResponse.json({ ok: true });
}
