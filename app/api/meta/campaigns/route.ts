import { NextResponse } from 'next/server';
import { listCampaigns, MetaAuthError } from '@/lib/meta-client';
import { getMetaContext, markConnectionExpired } from '@/lib/meta-route-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const adAccountId = url.searchParams.get('adAccountId');
  if (!adAccountId) return NextResponse.json({ error: 'adAccountId requerido' }, { status: 400 });

  const result = await getMetaContext();
  if (!result.ok) return result.response;
  const { ctx } = result;

  try {
    const campaigns = await listCampaigns(ctx.token, adAccountId, { limit: 50 });
    return NextResponse.json({ campaigns });
  } catch (err: any) {
    if (err instanceof MetaAuthError) {
      await markConnectionExpired(ctx.userId, err.message);
      return NextResponse.json({ requiresReconnect: true, error: err.message }, { status: 401 });
    }
    return NextResponse.json({ error: err?.message || 'Error en Meta API' }, { status: 502 });
  }
}
