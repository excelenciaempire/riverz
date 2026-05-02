import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getShopifyConnection } from '@/lib/shopify/connection';
import { ShopifyAdminClient } from '@/lib/shopify/admin-client';
import { uploadImageToShopify } from '@/lib/shopify/files';

export const runtime = 'nodejs';
// Single image upload + Shopify staged upload + fileCreate + READY poll
// can take 5–15s. Set headroom for slow connections.
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

// Editor-side compression already targets ~300 KB JPEGs at 1920px. Cap
// generously so we still accept the rare uncompressed payload (e.g. someone
// hitting the endpoint directly) without DoS exposure.
const MAX_BYTES = 15 * 1024 * 1024;

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

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
  const slot = (form.get('slot') as string) || 'image';
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

  // Filename Shopify will index in the merchant's Files admin.
  // <project>__<slot>__<timestamp>.<ext> keeps things grep-able if a merchant
  // ever wants to clean up old landing assets.
  const ext = mimeToExt(file.type);
  const safeProject = projectId.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 40) || 'landing';
  const safeSlot = slot.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 20) || 'image';
  const filename = `${safeProject}__${safeSlot}__${Date.now()}.${ext}`;

  try {
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
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'image/gif') return 'gif';
  return 'bin';
}
