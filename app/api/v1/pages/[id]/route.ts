/**
 * GET /api/v1/pages/{id} → contenido completo (document + meta).
 */

import { NextResponse } from 'next/server';
import { authenticateApiKey } from '@/lib/auth/api-key';
import { createAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const key = await authenticateApiKey(req);
  if (!key) return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('landing_pages')
    .select('id, name, kind, status, document, product_id, created_at, updated_at, clerk_user_id')
    .eq('id', id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data || data.clerk_user_id !== key.clerk_user_id)
    return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // No exponer clerk_user_id al consumidor de la API.
  const { clerk_user_id: _, ...rest } = data;
  return NextResponse.json({ page: rest });
}
