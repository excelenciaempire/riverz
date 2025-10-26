'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Search, Plus, Minus } from 'lucide-react';

export function CreditsManager() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [creditAmount, setCreditAmount] = useState('');
  const supabase = createClient();
  const queryClient = useQueryClient();

  const { data: users } = useQuery({
    queryKey: ['admin-users-credits', searchTerm],
    queryFn: async () => {
      let query = supabase.from('users').select('*').order('email');
      if (searchTerm) query = query.ilike('email', `%${searchTerm}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const updateCredits = useMutation({
    mutationFn: async ({ userId, amount, operation }: { userId: string; amount: number; operation: 'add' | 'subtract' }) => {
      const user = users?.find((u: any) => u.id === userId);
      const newCredits = operation === 'add' 
        ? user.credits + amount 
        : Math.max(0, user.credits - amount);
      
      const { error } = await supabase
        .from('users')
        .update({ credits: newCredits })
        .eq('id', userId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users-credits'] });
      setCreditAmount('');
      setSelectedUser(null);
      toast.success('Créditos actualizados');
    },
  });

  const handleUpdateCredits = (operation: 'add' | 'subtract') => {
    const amount = parseInt(creditAmount);
    if (!selectedUser || !amount || amount < 0) {
      toast.error('Selecciona un usuario e ingresa una cantidad válida');
      return;
    }
    updateCredits.mutate({ userId: selectedUser.id, amount, operation });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Gestión de Créditos</h2>
        <p className="mt-2 text-gray-400">Otorgar o remover créditos a usuarios</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          placeholder="Buscar usuario por email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-800 bg-[#141414] p-6">
          <h3 className="mb-4 font-semibold text-white">Usuarios</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {users?.map((user: any) => (
              <button
                key={user.id}
                onClick={() => setSelectedUser(user)}
                className={`w-full rounded-lg border p-3 text-left transition ${
                  selectedUser?.id === user.id
                    ? 'border-brand-accent bg-brand-accent/10'
                    : 'border-gray-800 hover:border-gray-700'
                }`}
              >
                <p className="font-medium text-white">{user.email}</p>
                <p className="text-sm text-brand-accent">{user.credits} créditos</p>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-800 bg-[#141414] p-6">
          <h3 className="mb-4 font-semibold text-white">Modificar Créditos</h3>
          {selectedUser ? (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-400">Usuario seleccionado:</p>
                <p className="font-medium text-white">{selectedUser.email}</p>
                <p className="text-lg font-bold text-brand-accent">{selectedUser.credits} créditos actuales</p>
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
                  onClick={() => handleUpdateCredits('subtract')}
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
    </div>
  );
}

