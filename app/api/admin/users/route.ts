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


export async function GET(req: Request) {
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

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const search = searchParams.get('search') || '';
    const planFilter = searchParams.get('plan') || '';

    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('user_credits')
      .select('*', { count: 'exact' });

    // Filtros
    if (search) {
      query = query.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`);
    }

    if (planFilter && planFilter !== 'all') {
      query = query.eq('plan_type', planFilter);
    }

    // Paginación
    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching users:', error);
      throw error;
    }

    // Enriquecer cada user con conteos reales: productos, generaciones (todas
    // y completadas) y créditos consumidos. Todos via clerk_user_id porque el
    // legacy users.id (uuid) está vacío y nunca se enlaza.
    const rows = data || [];
    const clerkIds = rows.map((u: any) => u.clerk_user_id).filter(Boolean);

    const counts: Record<string, {
      products: number;
      generations: number;
      completed: number;
      creditsSpent: number;
    }> = {};

    if (clerkIds.length > 0) {
      const [{ data: prods }, { data: gens }] = await Promise.all([
        supabaseAdmin
          .from('products')
          .select('clerk_user_id')
          .in('clerk_user_id', clerkIds),
        supabaseAdmin
          .from('generations')
          .select('clerk_user_id, status, cost')
          .in('clerk_user_id', clerkIds),
      ]);

      for (const cid of clerkIds) {
        counts[cid] = { products: 0, generations: 0, completed: 0, creditsSpent: 0 };
      }
      for (const p of prods || []) {
        if (p.clerk_user_id && counts[p.clerk_user_id]) counts[p.clerk_user_id].products += 1;
      }
      for (const g of gens || []) {
        const c = counts[g.clerk_user_id];
        if (!c) continue;
        c.generations += 1;
        if (g.status === 'completed') {
          c.completed += 1;
          c.creditsSpent += g.cost || 0;
        }
      }
    }

    const enriched = rows.map((u: any) => ({
      ...u,
      stats: counts[u.clerk_user_id] || { products: 0, generations: 0, completed: 0, creditsSpent: 0 },
    }));

    return NextResponse.json({
      users: enriched,
      pagination: {
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error: any) {
    console.error('Error in admin users route:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch users' },
      { status: 500 }
    );
  }
}


