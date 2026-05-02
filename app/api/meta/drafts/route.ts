import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/meta-route-helpers';
import type { AdDraft, AdDraftRow } from '@/types/meta';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const adAccountId = url.searchParams.get('adAccountId');

  let q = supabaseAdmin
    .from('ad_drafts')
    .select('*')
    .eq('clerk_user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(50);
  if (adAccountId) q = q.eq('ad_account_id', adAccountId);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ drafts: data ?? [] });
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { name?: string; ad_account_id?: string; rows?: AdDraftRow[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }
  const { name, ad_account_id, rows = [] } = body;
  if (!name || !ad_account_id) {
    return NextResponse.json({ error: 'Faltan name o ad_account_id' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('ad_drafts')
    .insert({
      clerk_user_id: userId,
      ad_account_id,
      name,
      rows,
      status: 'draft',
    })
    .select('*')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ draft: data as AdDraft });
}
