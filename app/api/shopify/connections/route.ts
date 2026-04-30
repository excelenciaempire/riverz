import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/shopify/connections — list the shops the current user has
 * connected. Used by the settings UI to render the panel ("you have 1 shop
 * connected: vitalu.myshopify.com — disconnect"). Token ciphertext is
 * deliberately not returned.
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('shopify_connections')
    .select('id, shop_domain, shop_name, scope, status, last_error, installed_at, uninstalled_at')
    .eq('clerk_user_id', userId)
    .order('installed_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ connections: data || [] });
}
