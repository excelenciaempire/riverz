import { encrypt, decrypt } from '@/lib/crypto';
import { createAdminClient } from '@/lib/supabase/server';

export interface StoredShopifyConnection {
  id: string;
  clerk_user_id: string;
  shop_domain: string;
  shop_name: string | null;
  scope: string | null;
  status: string;
  last_error: string | null;
  installed_at: string | null;
  uninstalled_at: string | null;
  access_token_ciphertext: string;
  access_token_iv: string;
  access_token_tag: string;
}

export type ResolvedShopifyConnection =
  | { ok: true; shop: string; token: string; scope: string | null; connectionId: string }
  | { ok: false; status: 401 | 404 | 500; requiresReconnect?: boolean; error: string };

/** Decrypt the stored token from a connection row. Returns the cleartext or throws. */
export function decryptShopifyToken(connection: Pick<StoredShopifyConnection, 'access_token_ciphertext' | 'access_token_iv' | 'access_token_tag'>): string {
  return decrypt({
    ciphertext: connection.access_token_ciphertext,
    iv: connection.access_token_iv,
    tag: connection.access_token_tag,
  });
}

/** Helper to upsert/refresh a Shopify connection on (re-)install. */
export async function persistShopifyConnection(opts: {
  clerkUserId: string;
  shopDomain: string;
  shopName?: string | null;
  accessToken: string;
  scope?: string | null;
}): Promise<{ id: string }> {
  const supabase = createAdminClient();
  const enc = encrypt(opts.accessToken);
  const row = {
    clerk_user_id: opts.clerkUserId,
    shop_domain: opts.shopDomain,
    shop_name: opts.shopName ?? null,
    access_token_ciphertext: enc.ciphertext,
    access_token_iv: enc.iv,
    access_token_tag: enc.tag,
    scope: opts.scope ?? null,
    status: 'active' as const,
    last_error: null as string | null,
    installed_at: new Date().toISOString(),
    uninstalled_at: null as string | null,
  };

  const { data, error } = await supabase
    .from('shopify_connections')
    .upsert(row, { onConflict: 'clerk_user_id,shop_domain' })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(`Failed to persist Shopify connection: ${error?.message || 'unknown error'}`);
  }
  return { id: data.id };
}

/** Look up the connection for the current Riverz user + a shop they own. */
export async function getShopifyConnection(opts: {
  clerkUserId: string;
  shopDomain?: string;
}): Promise<ResolvedShopifyConnection> {
  const supabase = createAdminClient();
  let query = supabase
    .from('shopify_connections')
    .select('*')
    .eq('clerk_user_id', opts.clerkUserId)
    .eq('status', 'active')
    .order('installed_at', { ascending: false })
    .limit(1);

  if (opts.shopDomain) query = query.eq('shop_domain', opts.shopDomain);

  const { data, error } = await query.maybeSingle();
  if (error) return { ok: false, status: 500, error: error.message };
  if (!data) return { ok: false, status: 404, requiresReconnect: true, error: 'No hay conexión activa con Shopify' };

  try {
    const token = decryptShopifyToken(data as StoredShopifyConnection);
    return { ok: true, shop: data.shop_domain, token, scope: data.scope, connectionId: data.id };
  } catch (err: any) {
    return { ok: false, status: 500, error: 'No se pudo descifrar el token guardado: ' + (err?.message || 'unknown') };
  }
}
