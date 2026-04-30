import { NextResponse } from 'next/server';
import { listInstagramAccountsForPage, MetaAuthError } from '@/lib/meta-client';
import { getMetaContext, markConnectionExpired } from '@/lib/meta-route-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const pageId = url.searchParams.get('pageId');
  if (!pageId) return NextResponse.json({ error: 'pageId requerido' }, { status: 400 });

  const result = await getMetaContext();
  if (!result.ok) return result.response;
  const { ctx } = result;

  try {
    const accounts = await listInstagramAccountsForPage(ctx.token, pageId);
    return NextResponse.json({ accounts });
  } catch (err: any) {
    if (err instanceof MetaAuthError) {
      await markConnectionExpired(ctx.userId, err.message);
      return NextResponse.json({ requiresReconnect: true, error: err.message }, { status: 401 });
    }
    return NextResponse.json({ error: err?.message || 'Error en Meta API' }, { status: 502 });
  }
}
