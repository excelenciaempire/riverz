import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getShopifyConnection } from '@/lib/shopify/connection';
import { ShopifyAdminClient } from '@/lib/shopify/admin-client';

export const runtime = 'nodejs';
// Polling waitForFileReady can take 5–25s on large videos, but the
// request body is just JSON metadata so memory stays flat.
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

/**
 * Step 2 of the direct-to-Shopify upload flow. The browser already
 * POSTed the file body to the staged target returned by
 * /api/landing-lab/shopify-stage-upload. This endpoint takes the
 * resource_url that came back, registers it as a permanent
 * Shopify File via fileCreate, polls until READY, and returns the
 * CDN URL the editor can drop into proj.images / proj.videos.
 */

type FinalizeReq = {
  resource_url?: string;
  mime?: string;
  alt?: string;
  shop_domain?: string;
};

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: FinalizeReq;
  try { body = (await req.json()) as FinalizeReq; }
  catch { return NextResponse.json({ error: 'Body inválido (JSON requerido)' }, { status: 400 }); }

  if (!body.resource_url || !body.mime) {
    return NextResponse.json({ error: 'Faltan resource_url o mime' }, { status: 400 });
  }

  const conn = await getShopifyConnection({ clerkUserId: userId, shopDomain: body.shop_domain });
  if (!conn.ok) {
    return NextResponse.json(
      { error: conn.error, requiresReconnect: conn.requiresReconnect },
      { status: conn.status },
    );
  }
  const client = new ShopifyAdminClient(conn.shop, conn.token);

  // Register the staged upload as a Shopify File. contentType=IMAGE
  // for image MIMEs (gives us a MediaImage with image.url), FILE for
  // everything else (GenericFile with .url) — the polling step below
  // reads the right field per __typename.
  type FileCreateRes = {
    fileCreate: {
      files: Array<{ id: string; fileStatus: string }>;
      userErrors: Array<{ field: string[]; message: string }>;
    };
  };
  let created: FileCreateRes;
  try {
    created = await client.graphql<FileCreateRes>(
      `mutation FileCreate($files: [FileCreateInput!]!) {
         fileCreate(files: $files) {
           files { id fileStatus }
           userErrors { field message }
         }
       }`,
      {
        files: [
          {
            alt: body.alt || '',
            contentType: body.mime.startsWith('image/') ? 'IMAGE' : 'FILE',
            originalSource: body.resource_url,
          },
        ],
      },
    );
  } catch (e: any) {
    console.error('[shopify-finalize-upload] fileCreate failed:', e?.message);
    return NextResponse.json(
      { error: 'Falla al registrar el File en Shopify: ' + (e?.message || 'desconocido') },
      { status: 502 },
    );
  }

  if (created.fileCreate.userErrors.length) {
    return NextResponse.json(
      { error: 'fileCreate: ' + JSON.stringify(created.fileCreate.userErrors) },
      { status: 502 },
    );
  }
  const fileId = created.fileCreate.files[0]?.id;
  if (!fileId) {
    return NextResponse.json({ error: 'fileCreate sin id' }, { status: 502 });
  }

  // Poll until the file is processed. Shopify normally finishes in
  // <2s for images, 5-15s for videos. We give it 40s before giving up.
  type FileNodeRes = {
    node:
      | { __typename: 'MediaImage'; id: string; fileStatus: string; image: { url: string } | null }
      | { __typename: 'GenericFile'; id: string; fileStatus: string; url: string | null }
      | null;
  };
  const start = Date.now();
  while (Date.now() - start < 40_000) {
    const data = await client.graphql<FileNodeRes>(
      `query File($id: ID!) {
         node(id: $id) {
           __typename
           ... on MediaImage { id fileStatus image { url } }
           ... on GenericFile { id fileStatus url }
         }
       }`,
      { id: fileId },
    );
    const n = data.node;
    if (n && n.fileStatus === 'READY') {
      const url = n.__typename === 'MediaImage' ? n.image?.url : n.url;
      if (url) {
        return NextResponse.json({ ok: true, url, file_id: fileId });
      }
      return NextResponse.json({ error: 'File READY pero sin URL' }, { status: 502 });
    }
    if (n && n.fileStatus === 'FAILED') {
      return NextResponse.json({ error: 'Shopify File processing FAILED' }, { status: 502 });
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  return NextResponse.json({ error: 'Timeout esperando que Shopify procese el archivo' }, { status: 504 });
}
