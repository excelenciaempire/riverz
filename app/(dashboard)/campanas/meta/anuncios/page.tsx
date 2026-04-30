'use client';

import { Suspense, useState, useMemo, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, RefreshCcw, Trophy, Filter } from 'lucide-react';
import Link from 'next/link';
import { Loading } from '@/components/ui/loading';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CampaignSection } from '@/components/meta-ads/campaign-section';
import { AdDetailPanel } from '@/components/meta-ads/ad-detail-panel';
import type { AccountsResponse, MetaAdSummary } from '@/types/meta';

const DATE_PRESETS = [
  { value: 'today', label: 'Hoy' },
  { value: 'yesterday', label: 'Ayer' },
  { value: 'last_7d', label: 'Últimos 7 días' },
  { value: 'last_14d', label: 'Últimos 14 días' },
  { value: 'last_30d', label: 'Últimos 30 días' },
  { value: 'last_90d', label: 'Últimos 90 días' },
  { value: 'maximum', label: 'Máximo' },
];

type WinnerFilter = 'all' | 'winners' | 'losers' | 'unmarked';
type MediaFilter = 'all' | 'video' | 'image' | 'carousel';

function AnunciosContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [adAccountId, setAdAccountId] = useState<string>(searchParams.get('adAccountId') || '');
  const [datePreset, setDatePreset] = useState<string>('last_30d');
  const [winnerFilter, setWinnerFilter] = useState<WinnerFilter>('all');
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>('all');
  const [selectedAd, setSelectedAd] = useState<MetaAdSummary | null>(null);

  const accountsQuery = useQuery<AccountsResponse>({
    queryKey: ['meta-accounts'],
    queryFn: async () => {
      const res = await fetch('/api/meta/accounts');
      if (!res.ok) throw new Error('Reconectar Meta');
      return res.json();
    },
    retry: false,
  });

  // Initialize ad account from connection defaults
  useEffect(() => {
    if (!adAccountId && accountsQuery.data?.default_ad_account_id) {
      setAdAccountId(accountsQuery.data.default_ad_account_id);
    }
  }, [adAccountId, accountsQuery.data]);

  const adsQuery = useQuery<{ ads: MetaAdSummary[] }>({
    queryKey: ['meta-ads', adAccountId, datePreset],
    queryFn: async () => {
      const res = await fetch(
        `/api/meta/ads?adAccountId=${encodeURIComponent(adAccountId)}&datePreset=${datePreset}&limit=50`,
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || 'No se pudieron cargar anuncios');
      }
      return res.json();
    },
    enabled: !!adAccountId,
  });

  const filteredAds = useMemo(() => {
    if (!adsQuery.data?.ads) return [] as MetaAdSummary[];
    return adsQuery.data.ads.filter((ad) => {
      if (mediaFilter !== 'all' && ad.media_kind !== mediaFilter) return false;
      if (winnerFilter === 'winners' && ad.intel?.is_winner !== true) return false;
      if (winnerFilter === 'losers' && ad.intel?.is_winner !== false) return false;
      if (winnerFilter === 'unmarked' && ad.intel?.is_winner != null) return false;
      return true;
    });
  }, [adsQuery.data, winnerFilter, mediaFilter]);

  // Group filtered ads by campaign — preserves API order so the most recently
  // active / paid campaigns show first.
  const campaignGroups = useMemo(() => {
    const groups = new Map<string, { id: string; name: string; ads: MetaAdSummary[]; spend: number }>();
    for (const ad of filteredAds) {
      const id = ad.campaign_id || 'unknown';
      const name = ad.campaign_name || 'Sin campaña';
      let g = groups.get(id);
      if (!g) {
        g = { id, name, ads: [], spend: 0 };
        groups.set(id, g);
      }
      g.ads.push(ad);
      if (ad.insights?.spend) g.spend += Number(ad.insights.spend) || 0;
    }
    // Sort campaigns: highest spend first, then by ad count.
    return Array.from(groups.values()).sort((a, b) => {
      if (b.spend !== a.spend) return b.spend - a.spend;
      return b.ads.length - a.ads.length;
    });
  }, [filteredAds]);

  // Keep selectedAd in sync with the latest fetched data so detail panel
  // reflects mutations (intel updates / transcript) without manual refetch.
  useEffect(() => {
    if (!selectedAd) return;
    const fresh = adsQuery.data?.ads.find((a) => a.id === selectedAd.id);
    if (fresh) setSelectedAd(fresh);
  }, [adsQuery.data, selectedAd]);

  return (
    <div className="space-y-5 pb-12">
      <div className="flex items-center gap-3">
        <Link
          href="/campanas/meta"
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Volver
        </Link>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Tus anuncios</h1>
          <p className="mt-0.5 text-sm text-gray-400">
            Reproduce, transcribe y marca winners para enseñar a tu IA qué funciona.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          {accountsQuery.data && accountsQuery.data.accounts.length > 1 && (
            <FilterBox label="Cuenta">
              <Select value={adAccountId} onValueChange={setAdAccountId}>
                <SelectTrigger className="border-gray-700 bg-[#0a0a0a] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-gray-800 bg-[#141414] text-white">
                  {accountsQuery.data.accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id} className="focus:bg-brand-accent/20 focus:text-white">
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterBox>
          )}
          <FilterBox label="Periodo">
            <Select value={datePreset} onValueChange={setDatePreset}>
              <SelectTrigger className="border-gray-700 bg-[#0a0a0a] text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-gray-800 bg-[#141414] text-white">
                {DATE_PRESETS.map((p) => (
                  <SelectItem key={p.value} value={p.value} className="focus:bg-brand-accent/20 focus:text-white">
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterBox>
          <FilterBox label="Tipo">
            <Select value={mediaFilter} onValueChange={(v) => setMediaFilter(v as MediaFilter)}>
              <SelectTrigger className="border-gray-700 bg-[#0a0a0a] text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-gray-800 bg-[#141414] text-white">
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="video">Videos</SelectItem>
                <SelectItem value="image">Imágenes</SelectItem>
                <SelectItem value="carousel">Carruseles</SelectItem>
              </SelectContent>
            </Select>
          </FilterBox>
          <FilterBox label="Resultado">
            <Select value={winnerFilter} onValueChange={(v) => setWinnerFilter(v as WinnerFilter)}>
              <SelectTrigger className="border-gray-700 bg-[#0a0a0a] text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-gray-800 bg-[#141414] text-white">
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="winners">Winners</SelectItem>
                <SelectItem value="losers">No funcionan</SelectItem>
                <SelectItem value="unmarked">Sin marcar</SelectItem>
              </SelectContent>
            </Select>
          </FilterBox>
          <button
            onClick={() => adsQuery.refetch()}
            disabled={adsQuery.isFetching}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-700 bg-[#0a0a0a] px-3 py-2 text-xs text-gray-300 hover:text-white"
          >
            <RefreshCcw className={`h-3.5 w-3.5 ${adsQuery.isFetching ? 'animate-spin' : ''}`} />
            Refrescar
          </button>
        </div>
      </div>

      {!adAccountId ? (
        <div className="rounded-xl border border-gray-800 bg-[#141414] p-8 text-center">
          <p className="text-gray-400">Configura tu cuenta publicitaria primero.</p>
          <Link
            href="/campanas/meta"
            className="mt-3 inline-flex items-center gap-1.5 text-sm text-brand-accent hover:underline"
          >
            Ir a configuración
          </Link>
        </div>
      ) : adsQuery.isLoading ? (
        <Loading text="Cargando anuncios desde Meta..." />
      ) : adsQuery.error ? (
        <div className="rounded-xl border border-red-900 bg-red-900/20 p-6 text-center">
          <p className="text-sm text-red-300">{(adsQuery.error as Error).message}</p>
          <p className="mt-1 text-xs text-red-400/80">
            Si ves "acceso API bloqueado", desconecta y reconecta para autorizar los nuevos permisos (ads_read, insights, pages, instagram).
          </p>
        </div>
      ) : filteredAds.length === 0 ? (
        <div className="rounded-xl border border-gray-800 bg-[#141414] p-8 text-center">
          <p className="text-gray-400">No hay anuncios que cumplan los filtros.</p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Filter className="h-3 w-3" />
            {campaignGroups.length} campaña{campaignGroups.length === 1 ? '' : 's'} · {filteredAds.length} ad{filteredAds.length === 1 ? '' : 's'}
            {' · '}
            <Trophy className="h-3 w-3 text-amber-400" />
            {filteredAds.filter((a) => a.intel?.is_winner === true).length} winners
          </div>
          <div className="space-y-3">
            {campaignGroups.map((g, i) => (
              <CampaignSection
                key={g.id}
                campaignId={g.id}
                campaignName={g.name}
                ads={g.ads}
                onAdClick={(ad) => setSelectedAd(ad)}
                selectedAdId={selectedAd?.id}
                defaultOpen={i < 3 || g.spend > 0}
              />
            ))}
          </div>
        </>
      )}

      {selectedAd && <AdDetailPanel ad={selectedAd} onClose={() => setSelectedAd(null)} />}
    </div>
  );
}

function FilterBox({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-[140px]">
      <div className="mb-1 text-[10px] uppercase tracking-wide text-gray-500">{label}</div>
      {children}
    </div>
  );
}

export default function AnunciosPage() {
  return (
    <Suspense fallback={<Loading text="Cargando..." />}>
      <AnunciosContent />
    </Suspense>
  );
}
