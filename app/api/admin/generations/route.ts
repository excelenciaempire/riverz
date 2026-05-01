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
    const typeFilter = searchParams.get('type') || '';
    const statusFilter = searchParams.get('status') || '';

    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('generations')
      .select('*', { count: 'exact' });

    // Filtros
    if (typeFilter && typeFilter !== 'all') {
      query = query.eq('type', typeFilter);
    }

    if (statusFilter && statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    // Paginación
    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching generations:', error);
      throw error;
    }

    // Enrich with user emails. The runtime source of truth is `user_credits`
    // (keyed by clerk_user_id) — the legacy `users` table is empty.
    const rows = data || [];
    const clerkIds = Array.from(
      new Set(rows.map((r: any) => r.clerk_user_id).filter(Boolean))
    );

    const emailByClerkId: Record<string, string> = {};
    if (clerkIds.length > 0) {
      const { data: usersByClerk } = await supabaseAdmin
        .from('user_credits')
        .select('clerk_user_id, email')
        .in('clerk_user_id', clerkIds);
      for (const u of usersByClerk || []) {
        if (u.clerk_user_id && u.email) emailByClerkId[u.clerk_user_id] = u.email;
      }
    }

    const enriched = rows.map((r: any) => ({
      ...r,
      users: {
        email: (r.clerk_user_id && emailByClerkId[r.clerk_user_id]) || null,
      },
    }));

    return NextResponse.json({
      generations: enriched,
      pagination: {
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error: any) {
    console.error('Error in admin generations route:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch generations' },
      { status: 500 }
    );
  }
}


