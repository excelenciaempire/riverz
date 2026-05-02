import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Knowledge Base API for a single product.
 *
 *   GET    /api/products/[id]/knowledge        — list all KB items
 *   POST   /api/products/[id]/knowledge        — add a text/brief or a link
 *                                                Body: { kind, title, content?, source_url? }
 *                                                kind ∈ 'text' | 'link'
 *   (Document upload uses a separate /knowledge/upload route to handle the
 *   file, extract text, and write the row.)
 *
 * KB items are read by the ideation pipeline alongside `products.research_data`
 * to form the prompt context. Authorization: the product must belong to the
 * authenticated user.
 */
async function assertProductOwnership(productId: string, userId: string) {
  const { data: product } = await supabaseAdmin
    .from('products')
    .select('id, clerk_user_id')
    .eq('id', productId)
    .single();
  if (!product) return { ok: false as const, status: 404, error: 'Product not found' };
  if (product.clerk_user_id !== userId)
    return { ok: false as const, status: 403, error: 'Forbidden' };
  return { ok: true as const };
}

export async function GET(_req: Request, ctx: { params: { id: string } }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const productId = ctx.params.id;
  const own = await assertProductOwnership(productId, userId);
  if (!own.ok) return NextResponse.json({ error: own.error }, { status: own.status });

  const { data, error } = await supabaseAdmin
    .from('product_knowledge')
    .select('*')
    .eq('product_id', productId)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data || [] });
}

export async function POST(req: Request, ctx: { params: { id: string } }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const productId = ctx.params.id;
  const own = await assertProductOwnership(productId, userId);
  if (!own.ok) return NextResponse.json({ error: own.error }, { status: own.status });

  const body = await req.json();
  const { kind, title, content, source_url } = body;

  if (!kind || !['text', 'link'].includes(kind)) {
    return NextResponse.json(
      { error: "kind debe ser 'text' o 'link' (los documentos usan /knowledge/upload)" },
      { status: 400 }
    );
  }
  if (!title?.trim()) {
    return NextResponse.json({ error: 'title es requerido' }, { status: 400 });
  }
  if (kind === 'text' && !content?.trim()) {
    return NextResponse.json({ error: 'content es requerido para kind=text' }, { status: 400 });
  }
  if (kind === 'link' && !source_url?.trim()) {
    return NextResponse.json({ error: 'source_url es requerido para kind=link' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('product_knowledge')
    .insert({
      product_id: productId,
      clerk_user_id: userId,
      kind,
      title: title.trim().slice(0, 300),
      content: content?.trim().slice(0, 50_000) || null,
      source_url: source_url?.trim().slice(0, 1000) || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data });
}

export async function DELETE(req: Request, ctx: { params: { id: string } }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const productId = ctx.params.id;
  const own = await assertProductOwnership(productId, userId);
  if (!own.ok) return NextResponse.json({ error: own.error }, { status: own.status });

  const url = new URL(req.url);
  const itemId = url.searchParams.get('itemId');
  if (!itemId) return NextResponse.json({ error: 'Missing itemId query param' }, { status: 400 });

  const { data: existing } = await supabaseAdmin
    .from('product_knowledge')
    .select('id, file_storage_path')
    .eq('id', itemId)
    .eq('product_id', productId)
    .single();
  if (!existing) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

  // If this was a document upload, also clean up the storage object so we
  // don't accumulate orphans in the bucket.
  if (existing.file_storage_path) {
    await supabaseAdmin.storage
      .from('products')
      .remove([existing.file_storage_path])
      .catch((err) => console.error('[KB DELETE] storage cleanup failed:', err));
  }

  const { error } = await supabaseAdmin
    .from('product_knowledge')
    .delete()
    .eq('id', itemId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
