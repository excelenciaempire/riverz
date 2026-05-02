import { NextResponse } from 'next/server';
import {
  listAdSetsForAccount,
  listAdSetsForCampaign,
  MetaAuthError,
} from '@/lib/meta-client';
import { getMetaContext, markConnectionExpired } from '@/lib/meta-route-helpers';
import type { ListAdSetsResponse } from '@/types/meta';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const campaignId = url.searchParams.get('campaignId');
  const adAccountId = url.searchParams.get('adAccountId');

  if (!campaignId && !adAccountId) {
    return NextResponse.json(
      { error: 'campaignId o adAccountId requerido' },
      { status: 400 },
    );
  }

  const result = await getMetaContext();
  if (!result.ok) return result.response;
  const { ctx } = result;

  try {
    const adsets = campaignId
      ? await listAdSetsForCampaign(ctx.token, campaignId, { limit: 200 })
      : await listAdSetsForAccount(ctx.token, adAccountId!, { limit: 500 });
    const body: ListAdSetsResponse = {
      adsets: adsets.map((a) => ({
        id: a.id,
        name: a.name,
        status: a.effective_status || a.status,
        campaign_id: a.campaign_id,
        daily_budget: a.daily_budget,
      })),
    };
    return NextResponse.json(body);
  } catch (err: any) {
    if (err instanceof MetaAuthError) {
      await markConnectionExpired(ctx.userId, err.message);
      return NextResponse.json({ requiresReconnect: true, error: err.message }, { status: 401 });
    }
    return NextResponse.json({ error: err?.message || 'Error en Meta API' }, { status: 502 });
  }
}
