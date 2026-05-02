import { NextResponse } from 'next/server';
import { listCampaignsForAccount, MetaAuthError } from '@/lib/meta-client';
import { getMetaContext, markConnectionExpired } from '@/lib/meta-route-helpers';
import type { ListCampaignsResponse } from '@/types/meta';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const adAccountId = url.searchParams.get('adAccountId');
  if (!adAccountId) {
    return NextResponse.json({ error: 'adAccountId requerido' }, { status: 400 });
  }

  const result = await getMetaContext();
  if (!result.ok) return result.response;
  const { ctx } = result;

  try {
    const campaigns = await listCampaignsForAccount(ctx.token, adAccountId, {
      limit: 200,
      // Excluye archivadas/eliminadas para no ensuciar el dropdown.
      effectiveStatus: ['ACTIVE', 'PAUSED', 'IN_PROCESS', 'WITH_ISSUES'],
    });
    const body: ListCampaignsResponse = {
      campaigns: campaigns.map((c) => ({
        id: c.id,
        name: c.name,
        status: c.effective_status || c.status,
        objective: c.objective,
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
