import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/server';
import { decryptShopifyToken } from '@/lib/shopify/connection';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/shopify/disconnect
 * Body: { shop_domain: "vitalu.myshopify.com" }
 *
 * Best-effort revokes the access token via Shopify's REST endpoint
 * (DELETE /admin/api_permissions/current.json) so the merchant doesn't
 * see a "still installed" stale entry, then marks the row uninstalled.
 * The actual app-uninstall webhook from Shopify will also flip the row
 * if the merchant uninstalls from the admin instead.
 */
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { shop_domain?: string };
  const shopDomain = body.shop_domain?.trim();
  if (!shopDomain) return NextResponse.json({ error: 'shop_domain requerido' }, { status: 400 });

  const supabase = createAdminClient();
  const { data: row, error: fetchErr } = await supabase
    .from('shopify_connections')
    .select('*')
    .eq('clerk_user_id', userId)
    .eq('shop_domain', shopDomain)
    .maybeSingle();

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!row) return NextResponse.json({ error: 'Conexión no encontrada' }, { status: 404 });

  // Revoke the token on Shopify's side. We don't fail the local disconnect
  // if this 4xx/5xx — the row already says "uninstalled" once we update it.
  try {
    const token = decryptShopifyToken(row);
    const apiVersion = process.env.SHOPIFY_API_VERSION || '2025-10';
    await fetch(`https://${shopDomain}/admin/api/${apiVersion}/api_permissions/current.json`, {
      method: 'DELETE',
      headers: { 'X-Shopify-Access-Token': token },
    }).catch(() => {});
  } catch {
    // ignore — we still want to flip the local state
  }

  const { error: updateErr } = await supabase
    .from('shopify_connections')
    .update({
      status: 'uninstalled',
      uninstalled_at: new Date().toISOString(),
      last_error: null,
    })
    .eq('id', row.id);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
