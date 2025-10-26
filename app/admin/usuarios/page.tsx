'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Search, Eye, Plus, Minus } from 'lucide-react';

export default function UsuariosPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'free' | 'paid'>('all');

  useEffect(() => {
    loadUsers();
  }, [filter]);

  const loadUsers = async () => {
    try {
      let query = supabase.from('users').select('*').order('created_at', { ascending: false });

      if (filter === 'free') {
        query = query.eq('plan_type', 'free');
      } else if (filter === 'paid') {
        query = query.neq('plan_type', 'free');
      }

      const { data } = await query;
      setUsers(data || []);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const adjustCredits = async (userId: string, amount: number) => {
    try {
      const user = users.find((u) => u.id === userId);
      if (!user) return;

      await supabase
        .from('users')
        .update({ credits: user.credits + amount })
        .eq('id', userId);

      loadUsers();
    } catch (error) {
      console.error('Error adjusting credits:', error);
    }
  };

  const filteredUsers = users.filter(
    (user) =>
      user.email.toLowerCase().includes(search.toLowerCase()) ||
      user.clerk_id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Usuarios</h1>
        <p className="mt-2 text-gray-400">Gestión de usuarios de la plataforma</p>
      </div>

      {/* Filters & Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por email o ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-700 bg-brand-dark-secondary py-2 pl-10 pr-4 text-white placeholder:text-gray-500"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`rounded-lg px-4 py-2 ${
              filter === 'all'
                ? 'bg-brand-accent text-white'
                : 'bg-brand-dark-secondary text-gray-400'
            }`}
          >
            Todos ({users.length})
          </button>
          <button
            onClick={() => setFilter('free')}
            className={`rounded-lg px-4 py-2 ${
              filter === 'free'
                ? 'bg-brand-accent text-white'
                : 'bg-brand-dark-secondary text-gray-400'
            }`}
          >
            Gratis
          </button>
          <button
            onClick={() => setFilter('paid')}
            className={`rounded-lg px-4 py-2 ${
              filter === 'paid'
                ? 'bg-brand-accent text-white'
                : 'bg-brand-dark-secondary text-gray-400'
            }`}
          >
            Pagos
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="rounded-lg border border-gray-700 bg-brand-dark-secondary">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-400">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-400">
                  Plan
                </th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-400">
                  Créditos
                </th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-400">
                  Idioma
                </th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-400">
                  Fecha Registro
                </th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-400">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-800">
                  <td className="px-6 py-4 text-sm text-white">{user.email}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`rounded-full px-3 py-1 text-xs ${
                        user.plan_type === 'free'
                          ? 'bg-gray-700 text-gray-300'
                          : 'bg-brand-accent/20 text-brand-accent'
                      }`}
                    >
                      {user.plan_type.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-white">{user.credits}</td>
                  <td className="px-6 py-4 text-sm text-white uppercase">{user.language}</td>
                  <td className="px-6 py-4 text-sm text-gray-400">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => adjustCredits(user.id, 100)}
                        className="rounded p-1 hover:bg-gray-700"
                        title="Agregar 100 créditos"
                      >
                        <Plus className="h-4 w-4 text-green-400" />
                      </button>
                      <button
                        onClick={() => adjustCredits(user.id, -100)}
                        className="rounded p-1 hover:bg-gray-700"
                        title="Remover 100 créditos"
                      >
                        <Minus className="h-4 w-4 text-red-400" />
                      </button>
                      <button className="rounded p-1 hover:bg-gray-700" title="Ver detalles">
                        <Eye className="h-4 w-4 text-brand-accent" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

