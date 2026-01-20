import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { productId, salesAngle } = await req.json();
    const supabase = await createClient();

    // Get product data
    const { data: product } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .single();

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // In production, this would call an AI service or N8N webhook
    // For now, return a template script
    const script = `¡Hola! Hoy quiero compartir con ustedes ${product.name}.

${salesAngle ? `${salesAngle} - ` : ''}${product.benefits}

El precio es de solo $${product.price}, y puedes conseguirlo en ${product.website}.

¡No te lo pierdas!`;

    return NextResponse.json({ script });
  } catch (error) {
    console.error('Error generating script:', error);
    return NextResponse.json(
      { error: 'Failed to generate script' },
      { status: 500 }
    );
  }
}

