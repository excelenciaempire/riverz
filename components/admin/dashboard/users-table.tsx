'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/input';
import { Search, Filter } from 'lucide-react';

export function UsersTable() {
  const [searchTerm, setSearchTerm] = useState('');
  const [planFilter, setPlanFilter] = useState('all');
  const supabase = createClient();

  const { data: users, isLoading } = useQuery({
    queryKey: ['admin-users', searchTerm, planFilter],
    queryFn: async () => {
      let query = supabase
        .from('users')
        .select(`
          *,
          products(count),
          generations(count, cost)
        `)
        .order('created_at', { ascending: false });

      if (searchTerm) {
        query = query.ilike('email', `%${searchTerm}%`);
      }

      if (planFilter !== 'all') {
        query = query.eq('plan_type', planFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Calculate total cost per user
      return data.map((user: any) => {
        const totalCost = user.generations?.reduce(
          (acc: number, gen: any) => acc + (gen.cost || 0),
          0
        ) || 0;
        
        return {
          ...user,
          totalGenerations: user.generations?.length || 0,
          totalProducts: user.products?.length || 0,
          totalCost,
        };
      });
    },
    refetchInterval: 30000,
  });

  const planBadgeColor = (plan: string) => {
    switch (plan) {
      case 'free':
        return 'bg-gray-700 text-gray-300';
      case 'basic':
        return 'bg-blue-600 text-white';
      case 'pro':
        return 'bg-purple-600 text-white';
      case 'premium':
        return 'bg-yellow-600 text-white';
      default:
        return 'bg-gray-700 text-gray-300';
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            type="text"
            placeholder="Buscar por email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <select
          value={planFilter}
          onChange={(e) => setPlanFilter(e.target.value)}
          className="rounded-lg border border-gray-800 bg-[#1a1a1a] px-4 py-2 text-white"
        >
          <option value="all">Todos los planes</option>
          <option value="free">Gratis</option>
          <option value="basic">Basic ($19)</option>
          <option value="pro">Pro ($49)</option>
          <option value="premium">Premium ($99)</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-gray-800 bg-[#141414]">
        <table className="w-full">
          <thead className="border-b border-gray-800 bg-[#0a0a0a]">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold text-white">
                Email
              </th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-white">
                Plan
              </th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-white">
                Créditos
              </th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-white">
                Productos
              </th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-white">
                Generaciones
              </th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-white">
                Costo Total
              </th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-white">
                Registro
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                  Cargando usuarios...
                </td>
              </tr>
            ) : users && users.length > 0 ? (
              users.map((user: any) => (
                <tr key={user.id} className="transition hover:bg-[#0a0a0a]">
                  <td className="px-6 py-4">
                    <p className="font-medium text-white">{user.email}</p>
                    <p className="text-xs text-gray-500">{user.clerk_id}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${planBadgeColor(
                        user.plan_type
                      )}`}
                    >
                      {user.plan_type}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-semibold text-brand-accent">
                      {user.credits.toLocaleString()}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-white">{user.totalProducts}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-white">{user.totalGenerations}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-semibold text-white">
                      {user.totalCost.toLocaleString()}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-gray-400">
                      {new Date(user.created_at).toLocaleDateString('es-ES')}
                    </p>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                  No se encontraron usuarios
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      {users && users.length > 0 && (
        <div className="rounded-2xl border border-gray-800 bg-[#141414] p-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-sm text-gray-400">Total Usuarios Mostrados</p>
              <p className="mt-1 text-2xl font-bold text-white">{users.length}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Total Generaciones</p>
              <p className="mt-1 text-2xl font-bold text-white">
                {users.reduce((acc, u) => acc + u.totalGenerations, 0)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Costo Acumulado</p>
              <p className="mt-1 text-2xl font-bold text-brand-accent">
                {users.reduce((acc, u) => acc + u.totalCost, 0).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

