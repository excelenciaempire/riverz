import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
// 60MB videos take 10–30s on slow uplinks; give 60s of headroom so we
// don't timeout mid-upload.
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// Mirror image-side upload-asset/route.ts but for video: stores the file
// in Supabase Storage (public-images bucket, landing-lab/<userId>/<projectId>/
// path) so the editor can save a durable URL in proj.videos[slot] without
// burning Shopify Files quota during draft iteration. Videos used to live
// in browser blob: URLs that died on reload — that's why dropped video
// blocks lost their content every time the user came back.

const ALLOWED_MIME = new Set([
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/ogg',
]);
// Same cap as the Shopify-direct upload-video endpoint.
const MAX_BYTES = 60 * 1024 * 1024;
const BUCKET = 'public-images';

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: 'Body inválido (esperado multipart/form-data)' },
      { status: 400 },
    );
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Falta el archivo "file"' }, { status: 400 });
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json(
      { error: `Tipo no soportado: ${file.type}` },
      { status: 400 },
    );
  }
  if (file.size === 0) {
    return NextResponse.json({ error: 'Archivo vacío' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `Archivo muy grande (max ${Math.round(MAX_BYTES / 1024 / 1024)}MB)` },
      { status: 413 },
    );
  }

  // Fail loud if the env vars aren't there — same pattern as upload-asset.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[upload-video-draft] Supabase env vars missing');
    return NextResponse.json(
      { error: 'Configuración de Supabase incompleta en el servidor.' },
      { status: 500 },
    );
  }

  const projectId = (form.get('project_id') as string) || 'landing';
  const slot = (form.get('slot') as string) || 'video';

  const ext = mimeToExt(file.type);
  const safeUser = userId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
  const safeProj = projectId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32) || 'landing';
  const safeSlot = slot.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || 'video';
  const objectPath = `landing-lab/${safeUser}/${safeProj}/${safeSlot}-${Date.now()}.${ext}`;

  const supabase = createAdminClient();

  let bytes: ArrayBuffer;
  try {
    bytes = await file.arrayBuffer();
  } catch (e) {
    return NextResponse.json(
      { error: 'No se pudo leer el archivo: ' + (e as Error).message },
      { status: 500 },
    );
  }

  const { error: upErr } = await supabase.storage.from(BUCKET).upload(objectPath, bytes, {
    contentType: file.type,
    cacheControl: '31536000',
    upsert: false,
  });
  if (upErr) {
    const msg = upErr.message || String(upErr);
    console.error('[upload-video-draft] Supabase upload failed:', msg);
    const hint = /not found/i.test(msg)
      ? ' (Asegurate de haber corrido lib/supabase/public-images-storage-setup.sql)'
      : '';
    return NextResponse.json(
      { error: 'Falla al subir a Supabase: ' + msg + hint },
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
    url: pub.publicUrl,
    path: objectPath,
    bucket: BUCKET,
    size: file.size,
    mime: file.type,
  });
}

function mimeToExt(mime: string): string {
  if (mime === 'video/mp4') return 'mp4';
  if (mime === 'video/quicktime') return 'mov';
  if (mime === 'video/webm') return 'webm';
  if (mime === 'video/ogg') return 'ogv';
  return 'bin';
}
