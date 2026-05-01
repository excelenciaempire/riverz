import { auth, currentUser } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAdminEmail } from '@/lib/admin-emails';

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

export async function GET() {
  try {
    const { userId } = await auth();
    const user = await currentUser();

    if (!userId || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userEmail = user.emailAddresses[0]?.emailAddress;
    if (!isAdminEmail(userEmail)) {
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

    // Generaciones completadas con costo + clerk_user_id (una sola pasada)
    const { data: completedRows } = await supabaseAdmin
      .from('generations')
      .select('clerk_user_id, type, cost')
      .eq('status', 'completed');

    const completed = completedRows || [];
    const creditsConsumed = completed.reduce((sum, g) => sum + (g.cost || 0), 0);

    const typeBreakdown = completed.reduce((acc: Record<string, number>, gen) => {
      if (gen.type) acc[gen.type] = (acc[gen.type] || 0) + 1;
      return acc;
    }, {});

    // Top 10 usuarios por créditos gastados (refleja consumo real, no solo conteo)
    const userSpend: Record<string, { generationCount: number; creditsSpent: number }> = {};
    for (const gen of completed) {
      const cid = gen.clerk_user_id;
      if (!cid) continue;
      if (!userSpend[cid]) userSpend[cid] = { generationCount: 0, creditsSpent: 0 };
      userSpend[cid].generationCount += 1;
      userSpend[cid].creditsSpent += gen.cost || 0;
    }

    const topClerkIds = Object.entries(userSpend)
      .sort(([, a], [, b]) => b.creditsSpent - a.creditsSpent)
      .slice(0, 10)
      .map(([cid]) => cid);

    // Resolver email + plan_type desde user_credits (única fuente de verdad)
    const userInfoByClerkId: Record<string, { email: string | null; plan_type: string | null }> = {};
    if (topClerkIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from('user_credits')
        .select('clerk_user_id, email, plan_type')
        .in('clerk_user_id', topClerkIds);
      for (const p of profiles || []) {
        userInfoByClerkId[p.clerk_user_id] = { email: p.email, plan_type: p.plan_type };
      }
    }

    const topUsersArray = topClerkIds.map((cid) => ({
      clerkUserId: cid,
      email: userInfoByClerkId[cid]?.email || null,
      planType: userInfoByClerkId[cid]?.plan_type || null,
      generationCount: userSpend[cid].generationCount,
      creditsSpent: userSpend[cid].creditsSpent,
    }));

    // Plantillas más populares
    const { data: templates } = await supabaseAdmin
      .from('templates')
      .select('id, name, view_count, edit_count')
      .order('view_count', { ascending: false })
      .limit(10);

    // Conteos crudos: productos y plantillas totales
    const { count: totalProducts } = await supabaseAdmin
      .from('products')
      .select('*', { count: 'exact', head: true });

    const { count: totalTemplates } = await supabaseAdmin
      .from('templates')
      .select('*', { count: 'exact', head: true });

    // Clasificación video/imagen calculada a partir del breakdown real,
    // no a partir de un set hardcodeado de tipos
    const VIDEO_TYPES = new Set([
      'ugc',
      'ugc_video',
      'face_swap',
      'clips',
      'mejorar_calidad_video',
    ]);
    const IMAGE_TYPES = new Set([
      'static_ad_generation',
      'static_ad_edit',
      'editar_foto_crear',
      'editar_foto_editar',
      'editar_foto_combinar',
      'editar_foto_clonar',
      'editar_foto_draw_edit',
      'mejorar_calidad_imagen',
    ]);

    let totalVideos = 0;
    let totalImages = 0;
    for (const [type, count] of Object.entries(typeBreakdown)) {
      if (VIDEO_TYPES.has(type)) totalVideos += count as number;
      else if (IMAGE_TYPES.has(type)) totalImages += count as number;
    }

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
        videos: totalVideos,
        images: totalImages,
        byType: typeBreakdown,
      },
      credits: {
        inCirculation: totalCredits,
        consumed: creditsConsumed,
      },
      counts: {
        products: totalProducts || 0,
        templates: totalTemplates || 0,
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


