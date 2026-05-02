import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { extractFileText, detectFileKind } from '@/lib/file-extract';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Upload a document (PDF / DOCX / TXT / MD) to a product's knowledge base.
 *
 * Multipart form fields:
 *   file:  the document binary
 *   title: human label shown in the KB UI
 *
 * Behaviour:
 *   - The ORIGINAL file is stored in Supabase Storage so the user can
 *     download it back exactly as uploaded. `source_url` and
 *     `file_storage_path` point at it.
 *   - The text content is extracted to markdown (PDF via unpdf, DOCX via
 *     mammoth, TXT/MD passthrough) and stored in `content`. This is what
 *     the ideation pipeline reads — never the binary. Text is capped at
 *     50k chars to keep prompts bounded.
 *   - The user always sees the original file in the UI; the markdown is
 *     internal-only.
 *
 * Errors:
 *   - Unsupported types → 400 with hint listing accepted formats.
 *   - Files > 25MB → 400 (matches lib/file-extract MAX_FILE_BYTES).
 *   - PDF that's a scan with no extractable text → 422 "no text extracted".
 */
export async function POST(req: Request, ctx: { params: { id: string } }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const productId = ctx.params.id;

  const { data: product } = await supabaseAdmin
    .from('products')
    .select('id, clerk_user_id')
    .eq('id', productId)
    .single();
  if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  if (product.clerk_user_id !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const form = await req.formData();
  const file = form.get('file');
  const title = (form.get('title') as string) || '';

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file es requerido' }, { status: 400 });
  }
  if (!title.trim()) {
    return NextResponse.json({ error: 'title es requerido' }, { status: 400 });
  }
  if (detectFileKind(file) === 'unknown') {
    return NextResponse.json(
      { error: 'Solo se aceptan archivos .pdf, .docx, .txt o .md' },
      { status: 400 }
    );
  }

  // Extract text first — if the file is unreadable we want to fail BEFORE
  // committing storage, so we don't leave orphan binaries when a scanned
  // PDF arrives.
  let extracted: { text: string; kind: string; bytes: number };
  try {
    extracted = await extractFileText(file);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'No se pudo leer el archivo' }, { status: 400 });
  }

  if (!extracted.text || extracted.text.trim().length < 20) {
    return NextResponse.json(
      {
        error:
          'No se pudo extraer texto del archivo. Si es un PDF escaneado, conviértelo a texto (OCR) antes de subirlo.',
      },
      { status: 422 }
    );
  }

  const markdownContent = extracted.text.slice(0, 50_000);

  // Persist the ORIGINAL file (not the markdown) so the user can download
  // exactly what they uploaded. Path: knowledge/{userId}/{timestamp}_{filename}
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200);
  const storagePath = `knowledge/${userId}/${Date.now()}_${safeName}`;
  const fileBytes = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await supabaseAdmin.storage
    .from('products')
    .upload(storagePath, fileBytes, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    });
  if (upErr) {
    return NextResponse.json({ error: `Storage upload failed: ${upErr.message}` }, { status: 500 });
  }

  const { data: pub } = supabaseAdmin.storage.from('products').getPublicUrl(storagePath);

  const { data: row, error: insertErr } = await supabaseAdmin
    .from('product_knowledge')
    .insert({
      product_id: productId,
      clerk_user_id: userId,
      kind: 'document',
      title: title.trim().slice(0, 300),
      content: markdownContent,
      source_url: pub.publicUrl,
      file_storage_path: storagePath,
    })
    .select()
    .single();

  if (insertErr) {
    await supabaseAdmin.storage.from('products').remove([storagePath]);
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json({
    item: row,
    extractedKind: extracted.kind,
    extractedChars: markdownContent.length,
  });
}
