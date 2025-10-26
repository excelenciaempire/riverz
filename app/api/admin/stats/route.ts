import { auth, currentUser } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Usar service_role para acceso completo
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

// Verificar si el usuario es admin
async function isAdmin(userEmail: string): Promise<boolean> {
  const adminEmails = process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(',').map(e => e.trim().toLowerCase()) || [];
  return adminEmails.includes(userEmail.toLowerCase());
}

export async function GET() {
  try {
    const { userId } = await auth();
    const user = await currentUser();

    if (!userId || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userEmail = user.emailAddresses[0]?.emailAddress;
    if (!userEmail || !(await isAdmin(userEmail))) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    // Total de usuarios registrados
    const { count: totalUsers } = await supabaseAdmin
      .from('user_credits')
      .select('*', { count: 'exact', head: true });

    // Usuarios con plan pago (no free)
    const { count: paidUsers } = await supabaseAdmin
      .from('user_credits')
      .select('*', { count: 'exact', head: true })
      .neq('plan_type', 'free');

    // Usuarios con suscripción activa
    const { count: activeSubscriptions } = await supabaseAdmin
      .from('user_credits')
      .select('*', { count: 'exact', head: true })
      .eq('subscription_status', 'active');

    // Total de generaciones
    const { count: totalGenerations } = await supabaseAdmin
      .from('generations')
      .select('*', { count: 'exact', head: true });

    // Generaciones completadas
    const { count: completedGenerations } = await supabaseAdmin
      .from('generations')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed');

    // Generaciones fallidas
    const { count: failedGenerations } = await supabaseAdmin
      .from('generations')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'failed');

    // Total de créditos en circulación
    const { data: creditsData } = await supabaseAdmin
      .from('user_credits')
      .select('credits');
    
    const totalCredits = creditsData?.reduce((sum, user) => sum + (user.credits || 0), 0) || 0;

    // Total de créditos consumidos (suma de costos de generaciones completadas)
    const { data: generationsData } = await supabaseAdmin
      .from('generations')
      .select('cost')
      .eq('status', 'completed');
    
    const creditsConsumed = generationsData?.reduce((sum, gen) => sum + (gen.cost || 0), 0) || 0;

    // Generaciones por tipo
    const { data: generationsByType } = await supabaseAdmin
      .from('generations')
      .select('type')
      .eq('status', 'completed');

    const typeBreakdown = generationsByType?.reduce((acc: any, gen) => {
      acc[gen.type] = (acc[gen.type] || 0) + 1;
      return acc;
    }, {}) || {};

    // Usuarios más activos (top 10)
    const { data: topUsers } = await supabaseAdmin
      .from('generations')
      .select('clerk_user_id')
      .eq('status', 'completed');

    const userActivity = topUsers?.reduce((acc: any, gen) => {
      acc[gen.clerk_user_id] = (acc[gen.clerk_user_id] || 0) + 1;
      return acc;
    }, {}) || {};

    const topUsersArray = Object.entries(userActivity)
      .sort(([, a]: any, [, b]: any) => b - a)
      .slice(0, 10)
      .map(([userId, count]) => ({ userId, generationCount: count }));

    // Plantillas más populares
    const { data: templates } = await supabaseAdmin
      .from('templates')
      .select('id, name, view_count, edit_count')
      .order('view_count', { ascending: false })
      .limit(10);

    return NextResponse.json({
      users: {
        total: totalUsers || 0,
        paid: paidUsers || 0,
        activeSubscriptions: activeSubscriptions || 0,
      },
      generations: {
        total: totalGenerations || 0,
        completed: completedGenerations || 0,
        failed: failedGenerations || 0,
        byType: typeBreakdown,
      },
      credits: {
        inCirculation: totalCredits,
        consumed: creditsConsumed,
      },
      topUsers: topUsersArray,
      topTemplates: templates || [],
    });
  } catch (error: any) {
    console.error('Error fetching admin stats:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}

