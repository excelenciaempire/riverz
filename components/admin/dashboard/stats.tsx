'use client';

import { useQuery } from '@tanstack/react-query';
import { Users, CreditCard, Video, Image, Package, TrendingUp } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export function DashboardStats() {
  const supabase = createClient();

  const { data: stats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      // Total users
      const { count: totalUsers } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true });

      // Upgraded users
      const { count: upgradedUsers } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .neq('plan_type', 'free');

      // Active subscriptions
      const { count: activeSubscriptions } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .not('stripe_subscription_id', 'is', null);

      // Total generations
      const { count: totalVideos } = await supabase
        .from('generations')
        .select('*', { count: 'exact', head: true })
        .in('type', ['ugc', 'face_swap', 'clips', 'mejorar_calidad_video']);

      const { count: totalImages } = await supabase
        .from('generations')
        .select('*', { count: 'exact', head: true })
        .in('type', [
          'editar_foto_crear',
          'editar_foto_editar',
          'editar_foto_combinar',
          'editar_foto_clonar',
          'mejorar_calidad_imagen',
        ]);

      // Total products
      const { count: totalProducts } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true });

      // Total templates
      const { count: totalTemplates } = await supabase
        .from('templates')
        .select('*', { count: 'exact', head: true });

      // Total credits used
      const { data: creditsData } = await supabase
        .from('generations')
        .select('cost');
      
      const totalCreditsUsed = creditsData?.reduce((acc, gen) => acc + (gen.cost || 0), 0) || 0;

      // Top 10 users by credit usage
      const { data: topUsers } = await supabase
        .from('generations')
        .select('user_id, users(email, plan_type)')
        .not('user_id', 'is', null);

      const userCredits: { [key: string]: { email: string; plan: string; total: number } } = {};
      
      topUsers?.forEach((gen: any) => {
        if (gen.user_id && gen.users) {
          if (!userCredits[gen.user_id]) {
            userCredits[gen.user_id] = {
              email: gen.users.email,
              plan: gen.users.plan_type,
              total: 0,
            };
          }
        }
      });

      const { data: generationsWithCost } = await supabase
        .from('generations')
        .select('user_id, cost')
        .not('user_id', 'is', null);

      generationsWithCost?.forEach((gen) => {
        if (gen.user_id && userCredits[gen.user_id]) {
          userCredits[gen.user_id].total += gen.cost || 0;
        }
      });

      const topUsersList = Object.values(userCredits)
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);

      return {
        totalUsers: totalUsers || 0,
        upgradedUsers: upgradedUsers || 0,
        activeSubscriptions: activeSubscriptions || 0,
        totalVideos: totalVideos || 0,
        totalImages: totalImages || 0,
        totalProducts: totalProducts || 0,
        totalTemplates: totalTemplates || 0,
        totalCreditsUsed,
        topUsers: topUsersList,
      };
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const statCards = [
    {
      title: 'Total Usuarios',
      value: stats?.totalUsers || 0,
      icon: Users,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
    },
    {
      title: 'Usuarios Premium',
      value: stats?.upgradedUsers || 0,
      icon: TrendingUp,
      color: 'text-green-500',
      bg: 'bg-green-500/10',
    },
    {
      title: 'Suscripciones Activas',
      value: stats?.activeSubscriptions || 0,
      icon: CreditCard,
      color: 'text-purple-500',
      bg: 'bg-purple-500/10',
    },
    {
      title: 'Videos Generados',
      value: stats?.totalVideos || 0,
      icon: Video,
      color: 'text-red-500',
      bg: 'bg-red-500/10',
    },
    {
      title: 'Imágenes Generadas',
      value: stats?.totalImages || 0,
      icon: Image,
      color: 'text-yellow-500',
      bg: 'bg-yellow-500/10',
    },
    {
      title: 'Productos Registrados',
      value: stats?.totalProducts || 0,
      icon: Package,
      color: 'text-brand-accent',
      bg: 'bg-brand-accent/10',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.title}
              className="rounded-2xl border border-gray-800 bg-[#141414] p-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">{stat.title}</p>
                  <p className="mt-2 text-3xl font-bold text-white">
                    {stat.value.toLocaleString()}
                  </p>
                </div>
                <div className={`rounded-xl ${stat.bg} p-3`}>
                  <Icon className={`h-6 w-6 ${stat.color}`} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Credits Used */}
      <div className="rounded-2xl border border-gray-800 bg-[#141414] p-6">
        <h3 className="text-lg font-semibold text-white">Créditos Usados Total</h3>
        <p className="mt-4 text-4xl font-bold text-brand-accent">
          {(stats?.totalCreditsUsed || 0).toLocaleString()}
        </p>
        <p className="mt-2 text-sm text-gray-400">
          Créditos consumidos por todos los usuarios
        </p>
      </div>

      {/* Top 10 Users */}
      <div className="rounded-2xl border border-gray-800 bg-[#141414] p-6">
        <h3 className="mb-6 text-lg font-semibold text-white">
          Top 10 Usuarios por Uso de Créditos
        </h3>
        <div className="space-y-3">
          {stats?.topUsers.map((user, index) => (
            <div
              key={index}
              className="flex items-center justify-between rounded-lg border border-gray-800 bg-[#0a0a0a] p-4"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-accent/20 text-sm font-bold text-brand-accent">
                  {index + 1}
                </div>
                <div>
                  <p className="font-medium text-white">{user.email}</p>
                  <p className="text-sm text-gray-400">Plan: {user.plan}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-white">{user.total.toLocaleString()}</p>
                <p className="text-xs text-gray-400">créditos</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

