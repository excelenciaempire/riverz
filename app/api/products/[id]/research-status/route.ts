import { auth } from '@clerk/nextjs/server';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// Force cache invalidation v1
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { id: productId } = await params;
    if (!productId) {
      return new NextResponse('Missing productId', { status: 400 });
    }

    const supabase = await createClient();

    const { data: product, error } = await supabase
      .from('products')
      .select('research_status, research_data')
      .eq('id', productId)
      .single();

    if (error || !product) {
      return new NextResponse('Product not found', { status: 404 });
    }

    return NextResponse.json({
      status: product.research_status || null,
      hasResearch: !!product.research_data,
      researchData: product.research_data
    });

  } catch (error: any) {
    console.error('Error fetching research status:', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
