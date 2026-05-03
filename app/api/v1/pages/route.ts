/**
 * Public API V1 — list pages.
 * GET /api/v1/pages
 *   Header: Authorization: Bearer rvz_live_xxx
 */

import { NextResponse } from 'next/server';
import { authenticateApiKey } from '@/lib/auth/api-key';
import { createAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const key = await authenticateApiKey(req);
  if (!key) return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('landing_pages')
    .select('id, name, kind, status, created_at, updated_at')
    .eq('clerk_user_id', key.clerk_user_id)
    .order('updated_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ pages: data ?? [] });
}
