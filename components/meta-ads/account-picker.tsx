'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, Building2, Facebook, Instagram, ChevronDown } from 'lucide-react';
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
  const [adAccountId, setAdAccountId] = useState<string>(
    accounts.default_ad_account_id || accounts.accounts[0]?.id || '',
  );
  const [pageId, setPageId] = useState<string>(accounts.default_page_id || '');
  const [instagramId, setInstagramId] = useState<string>(accounts.default_instagram_id || '');
  const [expanded, setExpanded] = useState<boolean>(false);

  // Sync local state with whatever the server most recently returned. Fixes
  // the case where the OAuth callback (or another tab) updated defaults.
  useEffect(() => {
    setAdAccountId(accounts.default_ad_account_id || accounts.accounts[0]?.id || '');
    setPageId(accounts.default_page_id || '');
    setInstagramId(accounts.default_instagram_id || '');
  }, [
    accounts.default_ad_account_id,
    accounts.default_page_id,
    accounts.default_instagram_id,
    accounts.accounts,
  ]);

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
      // Refresh every consumer of the defaults.
      queryClient.invalidateQueries({ queryKey: ['meta-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['meta-ads'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const dirty =
    adAccountId !== (accounts.default_ad_account_id || '') ||
    pageId !== (accounts.default_page_id || '') ||
    instagramId !== (accounts.default_instagram_id || '');

  const selectedAccount = useMemo(
    () => accounts.accounts.find((a) => a.id === adAccountId) || null,
    [accounts.accounts, adAccountId],
  );
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
      default_page_name: selectedPage?.name || accounts.default_page_name || null,
      default_instagram_id: instagramId || null,
      default_instagram_username:
        selectedIg?.username || accounts.default_instagram_username || null,
    });
  };

  // Decide whether to render the compact one-liner or the full picker:
  //   - Multiple ad accounts OR multiple pages → full picker (user needs choice).
  //   - Otherwise → compact summary. The user can still expand if they want.
  const accountCount = accounts.accounts.length;
  const pageCount = pagesQuery.data?.pages.length ?? 0;
  const hasChoice = accountCount > 1 || pageCount > 1;
  const compact = !hasChoice && !expanded;

  // Compact view: show the resolved selection as a one-line status.
  if (compact && selectedAccount) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-800 bg-[#141414] px-5 py-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
          <Pill icon={<Building2 className="h-3.5 w-3.5" />} label={selectedAccount.name} />
          {accounts.default_page_name && (
            <Pill icon={<Facebook className="h-3.5 w-3.5" />} label={accounts.default_page_name} />
          )}
          {accounts.default_instagram_username && (
            <Pill
              icon={<Instagram className="h-3.5 w-3.5" />}
              label={`@${accounts.default_instagram_username}`}
            />
          )}
          {!accounts.default_instagram_username && (
            <span className="text-xs text-gray-500">Solo Facebook (sin IG)</span>
          )}
        </div>
        <button
          onClick={() => setExpanded(true)}
          className="text-xs text-gray-400 hover:text-white"
        >
          Cambiar
        </button>
      </div>
    );
  }

  // Full picker
  return (
    <div className="rounded-xl border border-gray-800 bg-[#141414] p-6">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-white">Cuenta de trabajo</h3>
          <p className="mt-1 text-sm text-gray-400">
            Estos defaults se usan en todas las pantallas de Meta Ads.
            {hasChoice && ' Puedes cambiarlos cuando quieras.'}
          </p>
        </div>
        {!hasChoice && expanded && (
          <button
            onClick={() => setExpanded(false)}
            className="text-xs text-gray-400 hover:text-white"
          >
            Colapsar
          </button>
        )}
      </div>

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
                <SelectItem
                  key={a.id}
                  value={a.id}
                  className="focus:bg-brand-accent/20 focus:text-white"
                >
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
                  <SelectItem
                    key={p.id}
                    value={p.id}
                    className="focus:bg-brand-accent/20 focus:text-white"
                  >
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
            <p className="text-xs text-gray-500">
              Esta página no tiene IG vinculado (los anuncios saldrán solo en Facebook).
            </p>
          ) : (
            <Select value={instagramId} onValueChange={setInstagramId}>
              <SelectTrigger className="border-gray-700 bg-[#0a0a0a] text-white">
                <SelectValue placeholder="Elegir IG" />
              </SelectTrigger>
              <SelectContent className="border-gray-800 bg-[#141414] text-white">
                {(igQuery.data?.accounts || []).map((ig) => (
                  <SelectItem
                    key={ig.id}
                    value={ig.id}
                    className="focus:bg-brand-accent/20 focus:text-white"
                  >
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
          {saveMutation.isPending ? 'Guardando...' : dirty ? 'Guardar' : 'Guardado'}
        </button>
      </div>
    </div>
  );
}

function Pill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-gray-700 bg-black/40 px-2.5 py-1 text-xs text-white">
      {icon}
      {label}
    </span>
  );
}
