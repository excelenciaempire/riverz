import { NextResponse } from 'next/server';
import { listPages, MetaAuthError } from '@/lib/meta-client';
import { getMetaContext, markConnectionExpired } from '@/lib/meta-route-helpers';
import type { ListPagesResponse, MetaPageSummary } from '@/types/meta';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const API_VERSION = process.env.META_GRAPH_API_VERSION ?? 'v23.0';

/**
 * GET /api/meta/pages
 *
 * Lista las Fan Pages del usuario + la cuenta de IG Business asociada a cada
 * una (si existe). Backing del dropdown de identidad por fila en la grilla.
 */
export async function GET() {
  const result = await getMetaContext();
  if (!result.ok) return result.response;
  const { ctx } = result;

  try {
    const pagesRaw = await listPages(ctx.token);
    const pages: MetaPageSummary[] = pagesRaw.map((p) => ({
      id: p.id,
      name: p.name,
      picture_url: p.picture_url ?? null,
      instagram: null,
    }));

    // Segunda pasada para extraer username del IG (listPages lo descarta).
    const fields = 'id,instagram_business_account{id,username}';
    await Promise.all(
      pages.map(async (p, i) => {
        if (!pagesRaw[i].has_instagram) return;
        try {
          const url = `https://graph.facebook.com/${API_VERSION}/${p.id}?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(ctx.token)}`;
          const res = await fetch(url);
          if (!res.ok) return;
          const json = (await res.json()) as {
            instagram_business_account?: { id?: string; username?: string };
          };
          const ig = json.instagram_business_account;
          if (ig?.id) {
            pages[i].instagram = { id: ig.id, username: ig.username || '' };
          }
        } catch {
          /* swallow — la página simplemente queda sin IG en la lista */
        }
      }),
    );

    const body: ListPagesResponse = {
      pages,
      default_page_id: ctx.connection?.default_page_id ?? null,
      default_instagram_id: ctx.connection?.default_instagram_id ?? null,
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
