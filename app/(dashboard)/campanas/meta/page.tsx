'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Loading } from '@/components/ui/loading';
import { ConnectionCard } from '@/components/meta-ads/connection-card';
import { UploadStatusRow } from '@/components/meta-ads/upload-status-row';
import type { AccountsResponse, MetaUpload } from '@/types/meta';

interface UploadsListResponse {
  items: Array<MetaUpload & { generations?: { result_url?: string; type?: string } | null }>;
  total: number;
}

function MetaCampaignsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const connected = searchParams.get('connected');
    const error = searchParams.get('error');
    if (connected) {
      toast.success('Conexión con Meta establecida');
      const url = new URL(window.location.href);
      url.searchParams.delete('connected');
      router.replace(url.pathname);
    } else if (error) {
      toast.error(`Meta: ${error}`);
      const url = new URL(window.location.href);
      url.searchParams.delete('error');
      router.replace(url.pathname);
    }
  }, [searchParams, router]);

  const accountsQuery = useQuery<AccountsResponse, Error & { requiresReconnect?: boolean }>({
    queryKey: ['meta-accounts'],
    queryFn: async () => {
      const res = await fetch('/api/meta/accounts');
      if (res.status === 401) {
        const body = await res.json().catch(() => ({}));
        const err = new Error(body?.error || 'Reconectar') as Error & { requiresReconnect?: boolean };
        err.requiresReconnect = true;
        throw err;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || 'Error al cargar cuentas');
      }
      return res.json();
    },
    retry: false,
  });

  const uploadsQuery = useQuery<UploadsListResponse>({
    queryKey: ['meta-uploads-list'],
    queryFn: async () => {
      const res = await fetch('/api/meta/uploads/list?page=1&pageSize=30');
      if (!res.ok) throw new Error('Error al cargar historial');
      return res.json();
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Meta Ads</h1>
        <p className="mt-1 text-sm text-gray-400">
          Conecta tu cuenta de Meta y sube tus generaciones a la biblioteca de medios para usarlas al crear anuncios.
        </p>
      </div>

      <ConnectionCard
        data={accountsQuery.data}
        isLoading={accountsQuery.isLoading}
        error={
          accountsQuery.error
            ? {
                message: accountsQuery.error.message,
                requiresReconnect: (accountsQuery.error as any)?.requiresReconnect,
              }
            : undefined
        }
      />

      <section>
        <h2 className="mb-3 text-xl font-semibold text-white">Historial de subidas</h2>
        {uploadsQuery.isLoading ? (
          <Loading text="Cargando subidas..." />
        ) : uploadsQuery.error ? (
          <p className="rounded-lg border border-red-900 bg-red-900/20 p-4 text-sm text-red-400">
            {(uploadsQuery.error as Error).message}
          </p>
        ) : !uploadsQuery.data || uploadsQuery.data.items.length === 0 ? (
          <div className="rounded-lg border border-gray-800 bg-[#141414] p-8 text-center">
            <p className="text-gray-400">Aún no has subido nada a Meta Ads.</p>
            <p className="mt-1 text-xs text-gray-500">
              Ve a Historial, selecciona varios assets y pulsa "Subir a Meta Ads".
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {uploadsQuery.data.items.map((u) => (
              <div key={u.id} className="space-y-1">
                <UploadStatusRow
                  upload={u}
                  thumbnailUrl={u.generations?.result_url}
                  label={`${u.generations?.type?.replace(/_/g, ' ') || u.asset_type} · ${u.ad_account_id}`}
                />
                <p className="pl-1 text-[10px] text-gray-500">
                  {format(new Date(u.created_at), 'PPp', { locale: es })}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default function MetaCampaignsPage() {
  return (
    <Suspense fallback={<Loading text="Cargando..." />}>
      <MetaCampaignsContent />
    </Suspense>
  );
}
