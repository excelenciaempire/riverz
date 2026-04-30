import { auth, currentUser } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAdminEmail } from '@/lib/admin-emails';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);


export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();
    const user = await currentUser();

    if (!userId || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userEmail = user.emailAddresses[0]?.emailAddress;
    if (!isAdminEmail(userEmail)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = params;

    // Obtener datos del usuario
    const { data: userData, error: userError } = await supabaseAdmin
      .from('user_credits')
      .select('*')
      .eq('clerk_user_id', id)
      .single();

    if (userError) {
      console.error('Error fetching user:', userError);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Obtener generaciones del usuario
    const { data: generations, count: generationsCount } = await supabaseAdmin
      .from('generations')
      .select('*', { count: 'exact' })
      .eq('clerk_user_id', id)
      .order('created_at', { ascending: false })
      .limit(10);

    // Obtener productos del usuario
    const { data: products, count: productsCount } = await supabaseAdmin
      .from('products')
      .select('*', { count: 'exact' })
      .eq('clerk_user_id', id);

    // Obtener transacciones de créditos
    const { data: transactions } = await supabaseAdmin
      .from('credit_transactions')
      .select('*')
      .eq('clerk_user_id', id)
      .order('created_at', { ascending: false })
      .limit(20);

    return NextResponse.json({
      user: userData,
      stats: {
        totalGenerations: generationsCount || 0,
        totalProducts: productsCount || 0,
      },
      recentGenerations: generations || [],
      recentTransactions: transactions || [],
    });
  } catch (error: any) {
    console.error('Error fetching user details:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch user details' },
      { status: 500 }
    );
  }
}


