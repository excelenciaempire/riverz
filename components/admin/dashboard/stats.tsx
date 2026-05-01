'use client';

import { useQuery } from '@tanstack/react-query';
import { Users, CreditCard, Video, Image, Package, TrendingUp, Zap, AlertTriangle, RefreshCw, FileImage } from 'lucide-react';
import { useState } from 'react';

type TopUser = {
  clerkUserId: string;
  email: string | null;
  planType: string | null;
  generationCount: number;
  creditsSpent: number;
};

type AdminStats = {
  users: { total: number; paid: number; activeSubscriptions: number };
  generations: {
    total: number;
    completed: number;
    failed: number;
    videos: number;
    images: number;
    byType: Record<string, number>;
  };
  credits: { inCirculation: number; consumed: number };
  counts: { products: number; templates: number };
  topUsers: TopUser[];
  topTemplates: Array<{ id: string; name: string; view_count: number; edit_count: number }>;
};

export function DashboardStats() {
  const [isRefreshingBalance, setIsRefreshingBalance] = useState(false);

  const { data: providerBalance, refetch: refetchBalance } = useQuery({
    queryKey: ['provider-balance'],
    queryFn: async () => {
      const res = await fetch('/api/admin/kie-balance');
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    refetchInterval: 60000,
  });

  const handleRefreshBalance = async () => {
    setIsRefreshingBalance(true);
    await refetchBalance();
    setIsRefreshingBalance(false);
  };

  const { data: stats } = useQuery<AdminStats>({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const res = await fetch('/api/admin/stats');
      if (!res.ok) throw new Error('Failed to fetch admin stats');
      return res.json();
    },
    refetchInterval: 30000,
  });

  const statCards = [
    {
      title: 'Total Usuarios',
      value: stats?.users.total ?? 0,
      icon: Users,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
    },
    {
      title: 'Usuarios Premium',
      value: stats?.users.paid ?? 0,
      icon: TrendingUp,
      color: 'text-green-500',
      bg: 'bg-green-500/10',
    },
    {
      title: 'Suscripciones Activas',
      value: stats?.users.activeSubscriptions ?? 0,
      icon: CreditCard,
      color: 'text-purple-500',
      bg: 'bg-purple-500/10',
    },
    {
      title: 'Videos Generados',
      value: stats?.generations.videos ?? 0,
      icon: Video,
      color: 'text-red-500',
      bg: 'bg-red-500/10',
    },
    {
      title: 'Imágenes Generadas',
      value: stats?.generations.images ?? 0,
      icon: Image,
      color: 'text-yellow-500',
      bg: 'bg-yellow-500/10',
    },
    {
      title: 'Productos Registrados',
      value: stats?.counts.products ?? 0,
      icon: Package,
      color: 'text-brand-accent',
      bg: 'bg-brand-accent/10',
    },
    {
      title: 'Plantillas Activas',
      value: stats?.counts.templates ?? 0,
      icon: FileImage,
      color: 'text-pink-500',
      bg: 'bg-pink-500/10',
    },
    {
      title: 'Generaciones Totales',
      value: stats?.generations.total ?? 0,
      icon: Zap,
      color: 'text-cyan-500',
      bg: 'bg-cyan-500/10',
    },
  ];

  const balance = providerBalance?.balance || 0;
  const isLowBalance = balance < 1000;
  const isCriticalBalance = balance < 200;

  const successRate = stats && stats.generations.total > 0
    ? Math.round((stats.generations.completed / stats.generations.total) * 100)
    : 0;

  const typeBreakdown = stats?.generations.byType
    ? Object.entries(stats.generations.byType).sort(([, a], [, b]) => b - a)
    : [];

  return (
    <div className="space-y-8">
      <div className={`rounded-2xl border p-6 ${
        isCriticalBalance
          ? 'border-red-500/50 bg-red-500/10'
          : isLowBalance
            ? 'border-yellow-500/50 bg-yellow-500/10'
            : 'border-brand-accent/50 bg-brand-accent/10'
      }`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Zap className={`h-5 w-5 ${isCriticalBalance ? 'text-red-500' : isLowBalance ? 'text-yellow-500' : 'text-brand-accent'}`} />
              <p className="text-sm font-medium text-gray-300">Balance Proveedor IA (Solo Admin)</p>
              {isCriticalBalance && (
                <span className="flex items-center gap-1 rounded-full bg-red-500/20 px-2 py-0.5 text-xs text-red-400">
                  <AlertTriangle className="h-3 w-3" /> CRÍTICO
                </span>
              )}
              {isLowBalance && !isCriticalBalance && (
                <span className="flex items-center gap-1 rounded-full bg-yellow-500/20 px-2 py-0.5 text-xs text-yellow-400">
                  <AlertTriangle className="h-3 w-3" /> BAJO
                </span>
              )}
            </div>
            <p className={`mt-2 text-4xl font-bold ${
              isCriticalBalance ? 'text-red-500' : isLowBalance ? 'text-yellow-500' : 'text-white'
            }`}>
              {balance.toLocaleString()} créditos
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Actualizado: {providerBalance?.lastChecked ? new Date(providerBalance.lastChecked).toLocaleTimeString() : 'N/A'}
            </p>
          </div>
          <div className="text-right">
            <button
              onClick={handleRefreshBalance}
              disabled={isRefreshingBalance}
              className="mb-3 rounded-lg bg-white/10 p-2 hover:bg-white/20 transition disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 text-white ${isRefreshingBalance ? 'animate-spin' : ''}`} />
            </button>
            <div className="space-y-1 text-sm">
              <p className="text-gray-400">~{providerBalance?.estimates?.static_ads?.toLocaleString() || 0} static ads</p>
              <p className="text-gray-400">~{providerBalance?.estimates?.ugc_videos?.toLocaleString() || 0} videos UGC</p>
            </div>
          </div>
        </div>
        {isCriticalBalance && (
          <div className="mt-4 rounded-lg bg-red-500/20 p-3">
            <p className="text-sm text-red-300">
              ⚠️ El balance está muy bajo. Recarga en <a href="https://kie.ai" target="_blank" rel="noopener noreferrer" className="underline font-medium">kie.ai</a> para evitar interrupciones del servicio.
            </p>
          </div>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
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

      <div className="grid gap-6 md:grid-cols-3">
        <div className="rounded-2xl border border-gray-800 bg-[#141414] p-6">
          <h3 className="text-sm text-gray-400">Créditos en Circulación</h3>
          <p className="mt-2 text-3xl font-bold text-white">
            {(stats?.credits.inCirculation || 0).toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-gray-500">Saldo total en cuentas de usuarios</p>
        </div>
        <div className="rounded-2xl border border-gray-800 bg-[#141414] p-6">
          <h3 className="text-sm text-gray-400">Créditos Consumidos</h3>
          <p className="mt-2 text-3xl font-bold text-brand-accent">
            {(stats?.credits.consumed || 0).toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-gray-500">Suma de costos de generaciones completadas</p>
        </div>
        <div className="rounded-2xl border border-gray-800 bg-[#141414] p-6">
          <h3 className="text-sm text-gray-400">Tasa de Éxito</h3>
          <p className="mt-2 text-3xl font-bold text-green-500">{successRate}%</p>
          <p className="mt-1 text-xs text-gray-500">
            {stats?.generations.completed ?? 0} OK · {stats?.generations.failed ?? 0} fallidas
          </p>
        </div>
      </div>

      {typeBreakdown.length > 0 && (
        <div className="rounded-2xl border border-gray-800 bg-[#141414] p-6">
          <h3 className="mb-4 text-lg font-semibold text-white">Generaciones Completadas por Tipo</h3>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {typeBreakdown.map(([type, count]) => (
              <div
                key={type}
                className="flex items-center justify-between rounded-lg border border-gray-800 bg-[#0a0a0a] px-4 py-3"
              >
                <span className="text-sm text-gray-300">{type}</span>
                <span className="font-bold text-brand-accent">{count.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-gray-800 bg-[#141414] p-6">
        <h3 className="mb-6 text-lg font-semibold text-white">
          Top 10 Usuarios por Uso de Créditos
        </h3>
        <div className="space-y-3">
          {(stats?.topUsers || []).length === 0 ? (
            <p className="text-sm text-gray-500">Sin datos todavía.</p>
          ) : (
            (stats?.topUsers || []).map((user, index) => (
              <div
                key={user.clerkUserId}
                className="flex items-center justify-between rounded-lg border border-gray-800 bg-[#0a0a0a] p-4"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-accent/20 text-sm font-bold text-brand-accent">
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-medium text-white">{user.email || user.clerkUserId}</p>
                    <p className="text-sm text-gray-400">
                      Plan: {user.planType || '—'} · {user.generationCount} generaciones
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-white">{user.creditsSpent.toLocaleString()}</p>
                  <p className="text-xs text-gray-400">créditos</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
