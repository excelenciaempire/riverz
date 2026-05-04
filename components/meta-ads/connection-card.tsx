'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { LogOut, CheckCircle2, AlertTriangle, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RateLimitBanner } from '@/components/meta-ads/rate-limit-banner';
import type { AccountsResponse } from '@/types/meta';

interface Props {
  data?: AccountsResponse;
  error?: {
    message: string;
    requiresReconnect?: boolean;
    rateLimited?: boolean;
    retryAfterSec?: number;
  };
  isLoading?: boolean;
  /** Called when the rate-limit countdown reaches 0 — used to refetch. */
  onRateLimitExpire?: () => void;
}

export function ConnectionCard({ data, error, isLoading, onRateLimitExpire }: Props) {
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
      <div className="rounded-xl border border-[var(--rvz-card-border)] bg-[var(--rvz-card)] p-6">
        <p className="text-[var(--rvz-ink-muted)]">Verificando conexión con Meta...</p>
      </div>
    );
  }

  // Rate-limited: show ONLY the banner — the user is fully connected,
  // we just can't talk to Meta right now. Don't render "No conectado".
  if (error?.rateLimited && error.retryAfterSec) {
    return (
      <RateLimitBanner
        retryAfterSec={error.retryAfterSec}
        message={error.message}
        onExpire={onRateLimitExpire}
      />
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-[var(--rvz-card-border)] bg-[var(--rvz-card)] p-6">
        <div className="mb-3 flex items-center gap-2 text-amber-400">
          <AlertTriangle className="h-5 w-5" />
          <h3 className="text-lg font-semibold">No conectado</h3>
        </div>
        <p className="mb-4 text-sm text-[var(--rvz-ink-muted)]">
          {error?.message || 'Conecta tu cuenta de Meta para subir tus assets a la biblioteca de medios de tu ad account.'}
        </p>
        <a
          href="/api/meta/auth/start"
          className="inline-flex items-center gap-2 rounded-md bg-[var(--rvz-accent)] px-4 py-2 text-sm font-medium text-[var(--rvz-ink)] hover:bg-[var(--rvz-accent)]/90"
        >
          <ExternalLink className="h-4 w-4" />
          Conectar con Meta
        </a>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--rvz-card-border)] bg-[var(--rvz-card)] p-6">
      <div className="mb-2 flex items-center gap-2 text-green-400">
        <CheckCircle2 className="h-5 w-5" />
        <h3 className="text-lg font-semibold">Conectado</h3>
      </div>
      <p className="mb-1 text-sm text-[var(--rvz-ink-muted)]">Usuario de Meta</p>
      <p className="mb-4 text-base font-medium text-[var(--rvz-ink)]">{data.fb_user_name || '—'}</p>
      <p className="mb-1 text-sm text-[var(--rvz-ink-muted)]">Cuentas de anuncios disponibles</p>
      <p className="mb-4 text-base font-medium text-[var(--rvz-ink)]">{data.accounts.length}</p>
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
