import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { notFound, redirect } from 'next/navigation';
import ProductClient from './product-client';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) {
    redirect('/sign-in');
  }

  const { id } = await params;

  // Initialize Supabase Admin Client (Service Role)
  // We use this to fetch data bypassing RLS policies that might block the client
  // because the client auth token might be missing or misconfigured.
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: product, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !product) {
    console.error('Error fetching product:', error);
    return notFound();
  }

  // Security check: Ensure the product belongs to the user
  if (product.clerk_user_id !== userId) {
    return notFound();
  }

  return <ProductClient product={product} />;
}
