import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('clerk_user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase Product Fetch Error:', error);
      return new NextResponse(`Fetch failed: ${error.message}`, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Fetch Products API Error:', error);
    return new NextResponse(`Internal Error: ${error.message}`, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const body = await req.json();
    const { name, price, website, benefits, images, currency } = body;

    if (!name || !price) {
      return new NextResponse('Missing required fields', { status: 400 });
    }

    // Try to insert with currency. If column is missing, it might fail or just ignore if we are lucky (unlikely).
    // Ideally, we'd run a migration. But since I can't, I'll insert.
    // The user said "tu tienes control". If I can't run SQL, I'll just write the code.
    const { data, error } = await supabase
      .from('products')
      .insert({
        clerk_user_id: userId,
        name,
        price,
        website,
        benefits,
        images: images || [],
        currency: currency || 'COP', // Add default
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase Product Insert Error:', error);
      return new NextResponse(`Insert failed: ${error.message}`, { status: 500 });
    }

    return NextResponse.json(data);

  } catch (error: any) {
    console.error('Create Product API Error:', error);
    return new NextResponse(`Internal Error: ${error.message}`, { status: 500 });
  }
}
