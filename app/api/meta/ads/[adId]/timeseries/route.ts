import { NextResponse } from 'next/server';
import { fetchAdTimeSeries, MetaAuthError } from '@/lib/meta-client';
import { getMetaContext, markConnectionExpired } from '@/lib/meta-route-helpers';
import type { AdTimeSeriesRow } from '@/types/meta';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Returns daily-broken-down insights for a single ad. Drives the
 * Performance line chart in the detail panel.
 */
export async function GET(req: Request, ctx: { params: Promise<{ adId: string }> }) {
  const { adId } = await ctx.params;
  const url = new URL(req.url);
  const datePreset = url.searchParams.get('datePreset') || 'last_30d';

  const result = await getMetaContext();
  if (!result.ok) return result.response;
  const { ctx: c } = result;

  try {
    const rows = await fetchAdTimeSeries(c.token, adId, datePreset);
    const series: AdTimeSeriesRow[] = rows.map((r) => ({
      date: r.date_start,
      spend: Number(r.spend ?? 0),
      impressions: Number(r.impressions ?? 0),
      clicks: Number(r.clicks ?? 0),
      ctr: Number(r.ctr ?? 0),
      cpm: Number(r.cpm ?? 0),
      cpc: Number(r.cpc ?? 0),
      reach: r.reach ? Number(r.reach) : undefined,
      purchases: r.purchases,
      purchase_value: r.purchase_value,
      roas: r.roas,
    }));
    return NextResponse.json({ series });
  } catch (err: any) {
    if (err instanceof MetaAuthError) {
      await markConnectionExpired(c.userId, err.message);
      return NextResponse.json({ requiresReconnect: true, error: err.message }, { status: 401 });
    }
    return NextResponse.json({ error: err?.message || 'Error en Meta API' }, { status: 502 });
  }
}
