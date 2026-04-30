import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getShopifyEnv, verifyWebhookHmac } from '@/lib/shopify/oauth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GDPR mandatory webhook: shop/redact.
 * Shopify fires this 48 hours after a shop fully uninstalls our app,
 * meaning we must purge anything we still have for that shop. We hard-
 * delete the connection row(s) (the access token row was already invalid
 * after app/uninstalled, but we keep it for audit until this fires).
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

  let payload: any = {};
  try { payload = JSON.parse(rawBody); } catch {}
  const shopDomain: string | undefined = payload?.shop_domain || payload?.shop_domain;

  if (shopDomain) {
    const supabase = createAdminClient();
    // Cascade deletes shopify_published_landings rows via FK.
    await supabase.from('shopify_connections').delete().eq('shop_domain', shopDomain);
  }
  return NextResponse.json({ ok: true });
}
