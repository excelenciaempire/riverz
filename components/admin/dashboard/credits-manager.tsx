'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Search, Plus, Minus, History } from 'lucide-react';

type AdminUser = {
  id: string;
  clerk_user_id: string;
  email: string | null;
  full_name: string | null;
  plan_type: string;
  credits: number;
};

type CreditTransaction = {
  id: string;
  amount: number;
  transaction_type: string;
  description: string | null;
  balance_after: number;
  created_at: string;
};

export function CreditsManager() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [creditAmount, setCreditAmount] = useState('');
  const [reason, setReason] = useState('');
  const queryClient = useQueryClient();

  const { data: usersResp } = useQuery({
    queryKey: ['admin-users-credits', searchTerm],
    queryFn: async () => {
      const params = new URLSearchParams({ page: '1', limit: '100' });
      if (searchTerm) params.set('search', searchTerm);
      const res = await fetch(`/api/admin/users?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch users');
      return res.json();
    },
    refetchInterval: 30000,
  });

  const users: AdminUser[] = usersResp?.users || [];

  const { data: transactions } = useQuery<CreditTransaction[]>({
    queryKey: ['credit-transactions', selectedUser?.clerk_user_id],
    enabled: !!selectedUser,
    queryFn: async () => {
      const res = await fetch(`/api/admin/users/${selectedUser!.clerk_user_id}/transactions`);
      if (!res.ok) return [];
      const json = await res.json();
      return json.transactions || [];
    },
  });

  const updateCredits = useMutation({
    mutationFn: async ({ clerkUserId, amount, action }: { clerkUserId: string; amount: number; action: 'add' | 'remove' }) => {
      const res = await fetch(`/api/admin/users/${clerkUserId}/credits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, action, reason: reason || undefined }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to update credits');
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users-credits'] });
      queryClient.invalidateQueries({ queryKey: ['credit-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      if (selectedUser) {
        setSelectedUser({ ...selectedUser, credits: data.newBalance });
      }
      setCreditAmount('');
      setReason('');
      toast.success('Créditos actualizados');
    },
    onError: (e: any) => toast.error(e.message || 'Error actualizando créditos'),
  });

  const handleUpdateCredits = (action: 'add' | 'remove') => {
    const amount = parseInt(creditAmount);
    if (!selectedUser || !amount || amount <= 0) {
      toast.error('Selecciona un usuario e ingresa una cantidad válida');
      return;
    }
    updateCredits.mutate({ clerkUserId: selectedUser.clerk_user_id, amount, action });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Gestión de Créditos</h2>
        <p className="mt-2 text-gray-400">Otorgar o remover créditos a usuarios. Cada cambio queda registrado en credit_transactions.</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          placeholder="Buscar usuario por email o nombre..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-800 bg-[#141414] p-6">
          <h3 className="mb-4 font-semibold text-white">Usuarios</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {users.length === 0 ? (
              <p className="text-sm text-gray-500">Sin usuarios.</p>
            ) : (
              users.map((user) => (
                <button
                  key={user.id}
                  onClick={() => setSelectedUser(user)}
                  className={`w-full rounded-lg border p-3 text-left transition ${
                    selectedUser?.id === user.id
                      ? 'border-brand-accent bg-brand-accent/10'
                      : 'border-gray-800 hover:border-gray-700'
                  }`}
                >
                  <p className="font-medium text-white">{user.email || user.clerk_user_id}</p>
                  <p className="text-sm text-brand-accent">
                    {(user.credits ?? 0).toLocaleString()} créditos · {user.plan_type}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-800 bg-[#141414] p-6">
          <h3 className="mb-4 font-semibold text-white">Modificar Créditos</h3>
          {selectedUser ? (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-400">Usuario seleccionado:</p>
                <p className="font-medium text-white">{selectedUser.email || selectedUser.clerk_user_id}</p>
                <p className="text-lg font-bold text-brand-accent">
                  {(selectedUser.credits ?? 0).toLocaleString()} créditos actuales
                </p>
              </div>

              <div>
                <Label>Cantidad de créditos</Label>
                <Input
                  type="number"
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(e.target.value)}
                  placeholder="1000"
                  min="0"
                />
              </div>

              <div>
                <Label>Razón (opcional)</Label>
                <Input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="ej. Compensación por error en generación"
                />
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={() => handleUpdateCredits('add')}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  disabled={updateCredits.isPending}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Agregar
                </Button>
                <Button
                  onClick={() => handleUpdateCredits('remove')}
                  variant="outline"
                  className="flex-1"
                  disabled={updateCredits.isPending}
                >
                  <Minus className="mr-2 h-4 w-4" />
                  Remover
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-center text-gray-500">Selecciona un usuario</p>
          )}
        </div>
      </div>

      {selectedUser && (
        <div className="rounded-2xl border border-gray-800 bg-[#141414] p-6">
          <div className="mb-4 flex items-center gap-2">
            <History className="h-4 w-4 text-gray-400" />
            <h3 className="font-semibold text-white">Historial de transacciones</h3>
          </div>
          {transactions && transactions.length > 0 ? (
            <div className="space-y-2">
              {transactions.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between rounded-lg border border-gray-800 bg-[#0a0a0a] px-4 py-3"
                >
                  <div>
                    <p className="text-sm text-white">
                      {t.transaction_type} · {t.description || 'sin descripción'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(t.created_at).toLocaleString('es-ES')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold ${t.amount >= 0 ? 'text-green-500' : 'text-red-400'}`}>
                      {t.amount > 0 ? '+' : ''}{t.amount.toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-500">
                      saldo: {t.balance_after.toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">Este usuario aún no tiene transacciones registradas.</p>
          )}
        </div>
      )}
    </div>
  );
}
