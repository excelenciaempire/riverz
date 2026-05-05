import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getShopifyConnection } from '@/lib/shopify/connection';
import { ShopifyAdminClient } from '@/lib/shopify/admin-client';
import { uploadImageToShopify } from '@/lib/shopify/files';

export const runtime = 'nodejs';
// Video uploads run through staged upload + GenericFile + READY poll. Transcoded
// Video objects can take 60s+; we use GenericFile (immediate CDN URL) instead so
// publishes don't stall. 60s headroom keeps slow networks happy.
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// UGC clips are typically <10MB after compression. Cap at 60MB to allow the
// occasional uncompressed phone export, while keeping us inside Vercel's
// per-request payload limits.
const MAX_BYTES = 60 * 1024 * 1024;

const ALLOWED_MIME = new Set([
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/ogg',
]);

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Body inválido (esperado multipart/form-data)' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Falta el archivo "file"' }, { status: 400 });
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json({ error: `Tipo no soportado: ${file.type}` }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: 'Archivo vacío' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: `Archivo muy grande (max ${Math.round(MAX_BYTES/1024/1024)}MB)` }, { status: 413 });
  }

  const shopDomain = (form.get('shop_domain') as string) || undefined;
  const alt = (form.get('alt') as string) || '';
  const slot = (form.get('slot') as string) || 'video';
  const projectId = (form.get('project_id') as string) || 'landing';

  const conn = await getShopifyConnection({ clerkUserId: userId, shopDomain });
  if (!conn.ok) {
    return NextResponse.json(
      { error: conn.error, requiresReconnect: conn.requiresReconnect },
      { status: conn.status },
    );
  }

  const client = new ShopifyAdminClient(conn.shop, conn.token);
  const bytes = Buffer.from(await file.arrayBuffer());

  const ext = mimeToExt(file.type);
  const safeProject = projectId.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 40) || 'landing';
  const safeSlot = slot.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 20) || 'video';
  const filename = `${safeProject}__${safeSlot}__${Date.now()}.${ext}`;

  try {
    // uploadImageToShopify routes non-image MIME types through GenericFile —
    // returns a direct cdn.shopify.com URL we can drop straight into <video src>.
    const { fileId, cdnUrl } = await uploadImageToShopify(client, {
      bytes,
      filename,
      mimeType: file.type,
      altText: alt || `${safeProject} — ${safeSlot}`,
    });
    return NextResponse.json({
      ok: true,
      url: cdnUrl,
      fileId,
      shop: conn.shop,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: 'Falla al subir a Shopify Files: ' + (e.message || 'desconocido') },
      { status: 502 },
    );
  }
}

function mimeToExt(mime: string): string {
  if (mime === 'video/mp4') return 'mp4';
  if (mime === 'video/quicktime') return 'mov';
  if (mime === 'video/webm') return 'webm';
  if (mime === 'video/ogg') return 'ogv';
  return 'bin';
}
