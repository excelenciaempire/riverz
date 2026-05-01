'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';

type AdminUser = {
  id: string;
  clerk_user_id: string;
  email: string | null;
  full_name: string | null;
  plan_type: string;
  credits: number;
  subscription_status: string | null;
  is_active: boolean;
  created_at: string;
  stats: {
    products: number;
    generations: number;
    completed: number;
    creditsSpent: number;
  };
};

type UsersResponse = {
  users: AdminUser[];
  pagination: { total: number; page: number; limit: number; totalPages: number };
};

const PAGE_SIZE = 50;

export function UsersTable() {
  const [searchTerm, setSearchTerm] = useState('');
  const [planFilter, setPlanFilter] = useState('all');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery<UsersResponse>({
    queryKey: ['admin-users', searchTerm, planFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
      });
      if (searchTerm) params.set('search', searchTerm);
      if (planFilter !== 'all') params.set('plan', planFilter);

      const res = await fetch(`/api/admin/users?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch users');
      return res.json();
    },
    refetchInterval: 30000,
  });

  const users = data?.users || [];
  const pagination = data?.pagination;

  const planBadgeColor = (plan: string) => {
    switch (plan) {
      case 'free': return 'bg-gray-700 text-gray-300';
      case 'basic': return 'bg-blue-600 text-white';
      case 'pro': return 'bg-purple-600 text-white';
      case 'premium': return 'bg-yellow-600 text-white';
      case 'admin': return 'bg-brand-accent text-white';
      default: return 'bg-gray-700 text-gray-300';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            type="text"
            placeholder="Buscar por email o nombre..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
            className="pl-10"
          />
        </div>
        <select
          value={planFilter}
          onChange={(e) => { setPlanFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-800 bg-[#1a1a1a] px-4 py-2 text-white"
        >
          <option value="all">Todos los planes</option>
          <option value="free">Free</option>
          <option value="basic">Basic</option>
          <option value="pro">Pro</option>
          <option value="premium">Premium</option>
          <option value="admin">Admin</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-gray-800 bg-[#141414]">
        <table className="w-full">
          <thead className="border-b border-gray-800 bg-[#0a0a0a]">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold text-white">Usuario</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-white">Plan</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-white">Suscripción</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-white">Créditos</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-white">Productos</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-white">Generaciones</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-white">Créditos Usados</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-white">Registro</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {isLoading ? (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-gray-400">Cargando usuarios...</td>
              </tr>
            ) : users.length > 0 ? (
              users.map((user) => (
                <tr key={user.id} className="transition hover:bg-[#0a0a0a]">
                  <td className="px-6 py-4">
                    <p className="font-medium text-white">{user.email || '(sin email)'}</p>
                    <p className="text-xs text-gray-500">{user.full_name || user.clerk_user_id}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${planBadgeColor(user.plan_type)}`}>
                      {user.plan_type}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${
                      user.subscription_status === 'active'
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-gray-700 text-gray-400'
                    }`}>
                      {user.subscription_status || 'inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-semibold text-brand-accent">{(user.credits ?? 0).toLocaleString()}</p>
                  </td>
                  <td className="px-6 py-4 text-white">{user.stats.products}</td>
                  <td className="px-6 py-4">
                    <p className="text-white">{user.stats.generations}</p>
                    <p className="text-xs text-gray-500">{user.stats.completed} OK</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-semibold text-white">{user.stats.creditsSpent.toLocaleString()}</p>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-400">
                    {new Date(user.created_at).toLocaleDateString('es-ES')}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-gray-400">No se encontraron usuarios</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-400">
            Página {pagination.page} de {pagination.totalPages} · {pagination.total} usuarios
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-lg border border-gray-800 bg-[#141414] px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= pagination.totalPages}
              className="rounded-lg border border-gray-800 bg-[#141414] px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {pagination && (
        <div className="rounded-2xl border border-gray-800 bg-[#141414] p-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-sm text-gray-400">Usuarios en esta página</p>
              <p className="mt-1 text-2xl font-bold text-white">{users.length}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Total filtrados</p>
              <p className="mt-1 text-2xl font-bold text-white">{pagination.total.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Créditos usados (página)</p>
              <p className="mt-1 text-2xl font-bold text-brand-accent">
                {users.reduce((acc, u) => acc + u.stats.creditsSpent, 0).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
