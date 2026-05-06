import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

// Supabase Storage upload for landing-lab assets (images + small media).
// Multi-tenant: every authed clerk user gets a folder under user-uploads/<userId>
// so files are auto-namespaced. Returns the public URL — that's what the
// editor stores in proj.images[slot] instead of a base64 data URL.
//
// This endpoint exists because:
// 1. localStorage was overflowing on users with many uploaded images
//    (each base64 data URL is ~300-400KB; 5MB cap fills fast).
// 2. localStorage is per-browser, not per-user — so a user logging in
//    on a second device couldn't see their landings.
// Storing in Supabase Storage gives us multi-tenant durable URLs that
// fit in localStorage as ~120-char strings.

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);
// public-images is the Riverz convention for static, publicly-readable
// assets. Setup SQL lives in lib/supabase/public-images-storage-setup.sql
// (bucket public=true + RLS policies for authenticated upload). Pinned
// here instead of using user-uploads because the user-uploads bucket
// has a 50MB private cap and inconsistent public-access policy across
// environments — uploads succeeded server-side but the returned URL
// 403'd at the browser, making it look like the image "didn't save".
const BUCKET = 'public-images';
const MAX_BYTES = 15 * 1024 * 1024;

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

  // Fail loud (and visibly) if the Supabase env vars aren't configured.
  // Without this the createAdminClient() call returns a client with
  // undefined creds and the upload silently fails ~30s later — looking
  // exactly like "the image didn't save" from the user's side.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[upload-asset] Supabase env vars missing');
    return NextResponse.json(
      { error: 'Configuración de Supabase incompleta en el servidor (falta SUPABASE_SERVICE_ROLE_KEY o NEXT_PUBLIC_SUPABASE_URL).' },
      { status: 500 },
    );
  }

  const projectId = (form.get('project_id') as string) || 'landing';
  const slot = (form.get('slot') as string) || 'image';

  // Path: public-images/landing-lab/<userId>/<projectId>/<slot>-<timestamp>.<ext>
  // landing-lab/ prefix scopes our usage of the shared public-images
  // bucket. <userId> sub-path keeps every user's assets separate even
  // though the bucket itself is public-read. Timestamp prevents
  // overwrites between rapid uploads to the same slot.
  const ext = (file.type.split('/')[1] || 'bin').replace('jpeg', 'jpg');
  const safeUser = userId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
  const safeProj = projectId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32) || 'landing';
  const safeSlot = slot.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || 'image';
  const objectPath =
    `landing-lab/${safeUser}/${safeProj}/${safeSlot}-${Date.now()}.${ext}`;

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
    // Surface the underlying error message + hint at the most common
    // root cause so the user (or a dev tailing logs) can fix it
    // immediately. "Bucket not found" → run the SQL migration.
    const msg = upErr.message || String(upErr);
    console.error('[upload-asset] Supabase upload failed:', msg);
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
