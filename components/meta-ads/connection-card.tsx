'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { LogOut, CheckCircle2, AlertTriangle, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AccountsResponse } from '@/types/meta';

interface Props {
  data?: AccountsResponse;
  error?: { message: string; requiresReconnect?: boolean };
  isLoading?: boolean;
}

export function ConnectionCard({ data, error, isLoading }: Props) {
  const queryClient = useQueryClient();

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/meta/auth/disconnect', { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || 'No se pudo desconectar');
      }
    },
    onSuccess: () => {
      toast.success('Conexión con Meta eliminada');
      // Wipe every Meta-related query so stale `data` doesn't keep the
      // picker / actions / uploads list visible after disconnecting.
      queryClient.removeQueries({ queryKey: ['meta-accounts'] });
      queryClient.removeQueries({ queryKey: ['meta-pages'] });
      queryClient.removeQueries({ queryKey: ['meta-instagram'] });
      queryClient.removeQueries({ queryKey: ['meta-uploads-list'] });
      queryClient.removeQueries({ queryKey: ['meta-ads'] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  if (isLoading) {
    return (
      <div className="rounded-xl border border-gray-800 bg-[#141414] p-6">
        <p className="text-gray-400">Verificando conexión con Meta...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-gray-800 bg-[#141414] p-6">
        <div className="mb-3 flex items-center gap-2 text-amber-400">
          <AlertTriangle className="h-5 w-5" />
          <h3 className="text-lg font-semibold">No conectado</h3>
        </div>
        <p className="mb-4 text-sm text-gray-400">
          {error?.message || 'Conecta tu cuenta de Meta para subir tus assets a la biblioteca de medios de tu ad account.'}
        </p>
        <a
          href="/api/meta/auth/start"
          className="inline-flex items-center gap-2 rounded-md bg-brand-accent px-4 py-2 text-sm font-medium text-white hover:bg-brand-accent/90"
        >
          <ExternalLink className="h-4 w-4" />
          Conectar con Meta
        </a>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-[#141414] p-6">
      <div className="mb-2 flex items-center gap-2 text-green-400">
        <CheckCircle2 className="h-5 w-5" />
        <h3 className="text-lg font-semibold">Conectado</h3>
      </div>
      <p className="mb-1 text-sm text-gray-400">Usuario de Meta</p>
      <p className="mb-4 text-base font-medium text-white">{data.fb_user_name || '—'}</p>
      <p className="mb-1 text-sm text-gray-400">Cuentas de anuncios disponibles</p>
      <p className="mb-4 text-base font-medium text-white">{data.accounts.length}</p>
      <Button
        variant="outline"
        size="sm"
        onClick={() => disconnectMutation.mutate()}
        disabled={disconnectMutation.isPending}
      >
        <LogOut className="mr-2 h-4 w-4" />
        {disconnectMutation.isPending ? 'Desconectando...' : 'Desconectar'}
      </Button>
    </div>
  );
}
