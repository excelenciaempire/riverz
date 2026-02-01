import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/products/[id] - Fetch single product
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const { data: product, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // Verify ownership
    if (product.clerk_user_id !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json(product);

  } catch (error: any) {
    console.error('Get Product API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { id } = await params;

    // Verify ownership before deleting
    const { data: product, error: fetchError } = await supabase
      .from('products')
      .select('clerk_user_id')
      .eq('id', id)
      .single();

    if (fetchError || !product) {
      return new NextResponse('Product not found', { status: 404 });
    }

    if (product.clerk_user_id !== userId) {
      return new NextResponse('Forbidden', { status: 403 });
    }

    const { error: deleteError } = await supabase
      .from('products')
      .delete()
      .eq('id', id);

    if (deleteError) {
      return new NextResponse(`Delete failed: ${deleteError.message}`, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Delete Product API Error:', error);
    return new NextResponse(`Internal Error: ${error.message}`, { status: 500 });
  }
}
