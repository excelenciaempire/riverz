'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, Building2, Facebook, Instagram } from 'lucide-react';
import { Loading } from '@/components/ui/loading';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { AccountsResponse, MetaPage, MetaInstagramAccount } from '@/types/meta';

interface Props {
  accounts: AccountsResponse;
}

export function AccountPicker({ accounts }: Props) {
  const queryClient = useQueryClient();
  const [adAccountId, setAdAccountId] = useState<string>(accounts.default_ad_account_id || accounts.accounts[0]?.id || '');
  const [pageId, setPageId] = useState<string>(accounts.default_page_id || '');
  const [instagramId, setInstagramId] = useState<string>(accounts.default_instagram_id || '');

  const pagesQuery = useQuery<{ pages: MetaPage[] }>({
    queryKey: ['meta-pages'],
    queryFn: async () => {
      const res = await fetch('/api/meta/pages');
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || 'No se pudieron cargar páginas');
      }
      return res.json();
    },
  });

  const igQuery = useQuery<{ accounts: MetaInstagramAccount[] }>({
    queryKey: ['meta-instagram', pageId],
    queryFn: async () => {
      const res = await fetch(`/api/meta/instagram?pageId=${encodeURIComponent(pageId)}`);
      if (!res.ok) return { accounts: [] };
      return res.json();
    },
    enabled: !!pageId,
  });

  // Auto-select IG when page changes and only one is available.
  useEffect(() => {
    if (!pageId) {
      setInstagramId('');
      return;
    }
    if (igQuery.data?.accounts.length === 1) {
      setInstagramId(igQuery.data.accounts[0].id);
    } else if (igQuery.data?.accounts.length === 0) {
      setInstagramId('');
    }
  }, [pageId, igQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async (payload: Record<string, string | null>) => {
      const res = await fetch('/api/meta/connection', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || 'No se pudo guardar');
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success('Configuración guardada');
      queryClient.invalidateQueries({ queryKey: ['meta-accounts'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const dirty =
    adAccountId !== (accounts.default_ad_account_id || '') ||
    pageId !== (accounts.default_page_id || '') ||
    instagramId !== (accounts.default_instagram_id || '');

  const selectedPage = useMemo(
    () => pagesQuery.data?.pages.find((p) => p.id === pageId) || null,
    [pagesQuery.data, pageId],
  );
  const selectedIg = useMemo(
    () => igQuery.data?.accounts.find((a) => a.id === instagramId) || null,
    [igQuery.data, instagramId],
  );

  const handleSave = () => {
    saveMutation.mutate({
      default_ad_account_id: adAccountId || null,
      default_page_id: pageId || null,
      default_page_name: selectedPage?.name || null,
      default_instagram_id: instagramId || null,
      default_instagram_username: selectedIg?.username || null,
    });
  };

  return (
    <div className="rounded-xl border border-gray-800 bg-[#141414] p-6">
      <h3 className="mb-1 text-lg font-semibold text-white">Cuenta de trabajo</h3>
      <p className="mb-5 text-sm text-gray-400">
        Elige tu cuenta publicitaria, fan page e Instagram. Estos defaults se usan en toda la sección Meta Ads.
      </p>

      <div className="grid gap-4 md:grid-cols-3">
        {/* Ad account */}
        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-xs uppercase tracking-wide text-gray-500">
            <Building2 className="h-3.5 w-3.5" />
            Cuenta publicitaria
          </label>
          <Select value={adAccountId} onValueChange={setAdAccountId}>
            <SelectTrigger className="border-gray-700 bg-[#0a0a0a] text-white">
              <SelectValue placeholder="Elegir cuenta" />
            </SelectTrigger>
            <SelectContent className="border-gray-800 bg-[#141414] text-white">
              {accounts.accounts.map((a) => (
                <SelectItem key={a.id} value={a.id} className="focus:bg-brand-accent/20 focus:text-white">
                  {a.name}
                  {a.business_name ? ` · ${a.business_name}` : ''}
                  {a.currency ? ` · ${a.currency}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Page */}
        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-xs uppercase tracking-wide text-gray-500">
            <Facebook className="h-3.5 w-3.5" />
            Fan Page
          </label>
          {pagesQuery.isLoading ? (
            <Loading text="Cargando páginas..." />
          ) : pagesQuery.error ? (
            <p className="text-sm text-red-400">{(pagesQuery.error as Error).message}</p>
          ) : pagesQuery.data?.pages.length === 0 ? (
            <p className="text-xs text-amber-400">
              No vimos ninguna página. Asegúrate de tener acceso a una Facebook Page.
            </p>
          ) : (
            <Select value={pageId} onValueChange={setPageId}>
              <SelectTrigger className="border-gray-700 bg-[#0a0a0a] text-white">
                <SelectValue placeholder="Elegir página" />
              </SelectTrigger>
              <SelectContent className="border-gray-800 bg-[#141414] text-white">
                {(pagesQuery.data?.pages || []).map((p) => (
                  <SelectItem key={p.id} value={p.id} className="focus:bg-brand-accent/20 focus:text-white">
                    {p.name}
                    {p.has_instagram ? ' · IG conectado' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Instagram */}
        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-xs uppercase tracking-wide text-gray-500">
            <Instagram className="h-3.5 w-3.5" />
            Instagram
          </label>
          {!pageId ? (
            <p className="text-xs text-gray-500">Elige primero la página.</p>
          ) : igQuery.isLoading ? (
            <Loading text="..." />
          ) : (igQuery.data?.accounts.length || 0) === 0 ? (
            <p className="text-xs text-gray-500">Esta página no tiene IG vinculado (los anuncios saldrán solo en Facebook).</p>
          ) : (
            <Select value={instagramId} onValueChange={setInstagramId}>
              <SelectTrigger className="border-gray-700 bg-[#0a0a0a] text-white">
                <SelectValue placeholder="Elegir IG" />
              </SelectTrigger>
              <SelectContent className="border-gray-800 bg-[#141414] text-white">
                {(igQuery.data?.accounts || []).map((ig) => (
                  <SelectItem key={ig.id} value={ig.id} className="focus:bg-brand-accent/20 focus:text-white">
                    @{ig.username}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      <div className="mt-5 flex items-center justify-end">
        <button
          onClick={handleSave}
          disabled={!dirty || saveMutation.isPending}
          className="inline-flex items-center gap-2 rounded-md bg-brand-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Check className="h-4 w-4" />
          {saveMutation.isPending ? 'Guardando...' : dirty ? 'Guardar configuración' : 'Guardado'}
        </button>
      </div>
    </div>
  );
}
