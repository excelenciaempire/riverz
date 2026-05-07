import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getShopifyConnection } from '@/lib/shopify/connection';
import { ShopifyAdminClient } from '@/lib/shopify/admin-client';

export const runtime = 'nodejs';
// JSON-only request, no body buffering. The actual file bytes are
// PUT/POSTed directly from the browser to Shopify's staged target
// (Google Cloud Storage), bypassing this Next.js function entirely.
export const maxDuration = 15;
export const dynamic = 'force-dynamic';

/**
 * Step 1 of the direct-to-Shopify upload flow. Mints a staged upload
 * target the browser can POST a file to without ever passing the
 * bytes through Render. Avoids the OOM-restart loop that hit the
 * earlier flow (whole file buffered in formData → arrayBuffer →
 * Supabase upload → ~3x the file size in transient RAM).
 *
 * Pipeline:
 *   client → POST shopify-stage-upload   (~200B JSON metadata)
 *   server → stagedUploadsCreate         → returns target URL +
 *                                          GCS-style parameters
 *   client ← { upload_url, parameters, resource_url }
 *   client → POST <upload_url>           (file body straight to GCS)
 *   client → POST shopify-finalize-upload (registers as Shopify File)
 *
 * The merchant's connection MUST be active and have write_files —
 * which is the default scope and what every existing connection
 * already has.
 */

type StageReq = {
  filename?: string;
  mime?: string;
  size?: number;
  alt?: string;
  shop_domain?: string;
  /** 'image' or 'video'. Picks the size cap + ALLOWED_MIME set. */
  kind?: 'image' | 'video';
};

const ALLOWED_IMAGE_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);
const ALLOWED_VIDEO_MIME = new Set([
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/ogg',
]);
// Shopify accepts up to 5GB on FILE resources, but our editor caps
// images at 15MB (post-compression) and videos at 60MB so the user
// never sees a wall-of-text Shopify error mid-upload.
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const MAX_VIDEO_BYTES = 60 * 1024 * 1024;

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: StageReq;
  try { body = (await req.json()) as StageReq; }
  catch { return NextResponse.json({ error: 'Body inválido (JSON requerido)' }, { status: 400 }); }

  const kind = body.kind === 'video' ? 'video' : 'image';
  const mime = (body.mime || '').toLowerCase();
  const allowed = kind === 'video' ? ALLOWED_VIDEO_MIME : ALLOWED_IMAGE_MIME;
  if (!allowed.has(mime)) {
    return NextResponse.json({ error: `Tipo no soportado: ${mime}` }, { status: 400 });
  }
  const size = typeof body.size === 'number' ? body.size : 0;
  const cap = kind === 'video' ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  if (!size || size > cap) {
    return NextResponse.json(
      { error: !size ? 'Tamaño requerido' : `Archivo muy grande (max ${Math.round(cap / 1024 / 1024)}MB)` },
      { status: 413 },
    );
  }

  const conn = await getShopifyConnection({ clerkUserId: userId, shopDomain: body.shop_domain });
  if (!conn.ok) {
    return NextResponse.json(
      { error: conn.error, requiresReconnect: conn.requiresReconnect },
      { status: conn.status },
    );
  }
  const client = new ShopifyAdminClient(conn.shop, conn.token);

  const filename = (body.filename || (kind === 'video' ? 'video.mp4' : 'image.jpg'))
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .slice(0, 100) || 'upload.bin';

  // stagedUploadsCreate accepts httpMethod: POST or PUT. POST is the
  // canonical option — Shopify routes it to a Google Cloud Storage
  // form-multipart endpoint that wants every key from `parameters`
  // appended along with the file last.
  // resource MUST match the eventual fileCreate contentType for Shopify
  // to wire the upload through the right pipeline:
  //   IMAGE → MediaImage (transcoded variants)
  //   VIDEO → Video      (transcoded HLS sources)
  //   FILE  → GenericFile (raw passthrough)
  // Using VIDEO for video MIMEs unlocks Shopify's video transcoder —
  // without it Shopify treats the file as a generic blob, which is
  // why the earlier flow returned no playback URL even after the bytes
  // landed in Files.
  const resource = mime.startsWith('image/')
    ? 'IMAGE'
    : mime.startsWith('video/')
      ? 'VIDEO'
      : 'FILE';
  type StagedRes = {
    stagedUploadsCreate: {
      stagedTargets: Array<{
        url: string;
        resourceUrl: string;
        parameters: Array<{ name: string; value: string }>;
      }>;
      userErrors: Array<{ field: string[]; message: string }>;
    };
  };
  let staged: StagedRes;
  try {
    staged = await client.graphql<StagedRes>(
      `mutation StagedUploadsCreate($input: [StagedUploadInput!]!) {
         stagedUploadsCreate(input: $input) {
           stagedTargets { url resourceUrl parameters { name value } }
           userErrors { field message }
         }
       }`,
      {
        input: [
          {
            filename,
            mimeType: mime,
            httpMethod: 'POST',
            resource,
            fileSize: String(size),
          },
        ],
      },
    );
  } catch (e: any) {
    console.error('[shopify-stage-upload] stagedUploadsCreate failed:', e?.message);
    return NextResponse.json(
      { error: 'Falla al pedir el target a Shopify: ' + (e?.message || 'desconocido') },
      { status: 502 },
    );
  }

  if (staged.stagedUploadsCreate.userErrors.length) {
    return NextResponse.json(
      { error: 'stagedUploadsCreate: ' + JSON.stringify(staged.stagedUploadsCreate.userErrors) },
      { status: 502 },
    );
  }
  const target = staged.stagedUploadsCreate.stagedTargets[0];
  if (!target) {
    return NextResponse.json({ error: 'stagedUploadsCreate sin target' }, { status: 502 });
  }

  return NextResponse.json({
    upload_url: target.url,
    parameters: target.parameters,
    resource_url: target.resourceUrl,
    mime,
    filename,
    shop: conn.shop,
  });
}
