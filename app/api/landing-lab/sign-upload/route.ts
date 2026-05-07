import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
// JSON-only request, no body buffering. Stays under the function's
// memory ceiling even when the user is uploading a 60MB reel — the
// actual file bytes go directly from the browser to Supabase Storage
// over the signed URL we hand back here.
export const maxDuration = 15;
export const dynamic = 'force-dynamic';

/**
 * Mint a short-lived signed upload URL so the browser can PUT a file
 * directly to Supabase Storage. The previous flow buffered the whole
 * file inside this Next.js function (formData → arrayBuffer → supabase
 * .upload()), which on a 60MB video meant ~180MB of transient RAM —
 * enough to push the Render instance past its memory ceiling and
 * trigger an auto-restart (502 until the container came back).
 *
 * With createSignedUploadUrl the function never touches the bytes; the
 * browser PUTs the file straight to Supabase using the signed URL.
 */

type SignReq = {
  kind?: 'image' | 'video';
  filename?: string;
  mime?: string;
  size?: number;
  project_id?: string;
  slot?: string;
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

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const MAX_VIDEO_BYTES = 60 * 1024 * 1024;
const BUCKET = 'public-images';

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: SignReq;
  try {
    body = (await req.json()) as SignReq;
  } catch {
    return NextResponse.json({ error: 'Body inválido (JSON requerido)' }, { status: 400 });
  }

  const kind = body.kind === 'video' ? 'video' : 'image';
  const mime = (body.mime || '').toLowerCase();
  const allowed = kind === 'video' ? ALLOWED_VIDEO_MIME : ALLOWED_IMAGE_MIME;
  if (!allowed.has(mime)) {
    return NextResponse.json({ error: `Tipo no soportado: ${mime}` }, { status: 400 });
  }

  const cap = kind === 'video' ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  const size = typeof body.size === 'number' ? body.size : 0;
  if (size > cap) {
    return NextResponse.json(
      { error: `Archivo muy grande (max ${Math.round(cap / 1024 / 1024)}MB)` },
      { status: 413 },
    );
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[sign-upload] Supabase env vars missing');
    return NextResponse.json(
      { error: 'Configuración de Supabase incompleta en el servidor.' },
      { status: 500 },
    );
  }

  const projectId = (body.project_id || 'landing').toString();
  const slot = (body.slot || (kind === 'video' ? 'video' : 'image')).toString();

  const ext = mimeToExt(mime, kind);
  const safeUser = userId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
  const safeProj = projectId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32) || 'landing';
  const safeSlot = slot.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || (kind === 'video' ? 'video' : 'image');
  const objectPath = `landing-lab/${safeUser}/${safeProj}/${safeSlot}-${Date.now()}.${ext}`;

  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUploadUrl(objectPath);

  if (error || !data) {
    const msg = (error && error.message) || 'unknown';
    console.error('[sign-upload] createSignedUploadUrl failed:', msg);
    const hint = /not found|bucket/i.test(msg)
      ? ' (Asegurate de haber corrido lib/supabase/public-images-storage-setup.sql)'
      : '';
    return NextResponse.json(
      { error: 'No se pudo firmar la subida: ' + msg + hint },
      { status: 502 },
    );
  }

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);
  if (!pub || !pub.publicUrl) {
    return NextResponse.json(
      { error: 'No se pudo resolver la URL pública' },
      { status: 502 },
    );
  }

  return NextResponse.json({
    upload_url: data.signedUrl,
    token: data.token,
    path: data.path,
    public_url: pub.publicUrl,
    bucket: BUCKET,
    mime,
  });
}

function mimeToExt(mime: string, kind: 'image' | 'video'): string {
  if (kind === 'image') {
    if (mime === 'image/jpeg') return 'jpg';
    if (mime === 'image/png') return 'png';
    if (mime === 'image/webp') return 'webp';
    if (mime === 'image/gif') return 'gif';
  } else {
    if (mime === 'video/mp4') return 'mp4';
    if (mime === 'video/quicktime') return 'mov';
    if (mime === 'video/webm') return 'webm';
    if (mime === 'video/ogg') return 'ogv';
  }
  return 'bin';
}
