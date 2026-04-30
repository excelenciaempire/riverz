'use client';

import { Suspense, useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, RefreshCcw, Trophy, Filter, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { Loading } from '@/components/ui/loading';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AdCard } from '@/components/meta-ads/ad-card';
import { LevelRow } from '@/components/meta-ads/level-row';
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

interface Group {
  id: string;
  name: string;
  status: string;
  spend: number;
  purchases: number;
  purchaseValue: number;
  roas: number;
  active: number;
  winners: number;
  childCount: number;
}

function rollUp(ads: MetaAdSummary[]): Omit<Group, 'id' | 'name' | 'childCount'> {
  let spend = 0;
  let purchases = 0;
  let purchaseValue = 0;
  let active = 0;
  let winners = 0;
  let anyActive = false;
  let firstStatus = 'PAUSED';
  for (const ad of ads) {
    const s = ad.effective_status || ad.status || 'PAUSED';
    if (firstStatus === 'PAUSED' && s) firstStatus = s;
    if (s === 'ACTIVE') {
      active += 1;
      anyActive = true;
    }
    if (ad.intel?.is_winner === true) winners += 1;
    if (ad.insights?.spend) spend += Number(ad.insights.spend) || 0;
    if (ad.insights?.purchases) purchases += Number(ad.insights.purchases) || 0;
    if (ad.insights?.purchase_value) purchaseValue += Number(ad.insights.purchase_value) || 0;
  }
  return {
    status: anyActive ? 'ACTIVE' : firstStatus,
    spend,
    purchases,
    purchaseValue,
    roas: spend > 0 ? purchaseValue / spend : 0,
    active,
    winners,
  };
}

function AnunciosContent() {
  const searchParams = useSearchParams();
  const [adAccountId, setAdAccountId] = useState<string>(searchParams.get('adAccountId') || '');
  const [datePreset, setDatePreset] = useState<string>('last_30d');
  const [winnerFilter, setWinnerFilter] = useState<WinnerFilter>('all');
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>('all');
  const [selectedAd, setSelectedAd] = useState<MetaAdSummary | null>(null);

  // Drill-down navigation
  const [activeCampaign, setActiveCampaign] = useState<{ id: string; name: string } | null>(null);
  const [activeAdSet, setActiveAdSet] = useState<{ id: string; name: string } | null>(null);

  const accountsQuery = useQuery<AccountsResponse>({
    queryKey: ['meta-accounts'],
    queryFn: async () => {
      const res = await fetch('/api/meta/accounts');
      if (!res.ok) throw new Error('Reconectar Meta');
      return res.json();
    },
    retry: false,
  });

  const urlAdAccountId = searchParams.get('adAccountId');
  useEffect(() => {
    if (urlAdAccountId) {
      if (urlAdAccountId !== adAccountId) setAdAccountId(urlAdAccountId);
      return;
    }
    const def = accountsQuery.data?.default_ad_account_id;
    if (def && def !== adAccountId) setAdAccountId(def);
  }, [urlAdAccountId, accountsQuery.data?.default_ad_account_id, adAccountId]);

  // Reset drill-down when account or filters change so we don't end up
  // looking at a stale campaign that's no longer in the result set.
  useEffect(() => {
    setActiveCampaign(null);
    setActiveAdSet(null);
  }, [adAccountId, datePreset]);

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

  // Filter doesn't depend on drill level — apply once.
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

  // Level 1 — campaigns (rollup of all ads grouped by campaign_id).
  const campaignGroups: Group[] = useMemo(() => {
    const buckets = new Map<string, { id: string; name: string; ads: MetaAdSummary[] }>();
    for (const ad of filteredAds) {
      const id = ad.campaign_id || 'unknown';
      const name = ad.campaign_name || 'Sin campaña';
      let g = buckets.get(id);
      if (!g) {
        g = { id, name, ads: [] };
        buckets.set(id, g);
      }
      g.ads.push(ad);
    }
    return Array.from(buckets.values())
      .map((g) => {
        const adSetIds = new Set(g.ads.map((a) => a.adset_id || 'unknown'));
        return {
          id: g.id,
          name: g.name,
          childCount: adSetIds.size,
          ...rollUp(g.ads),
        };
      })
      .sort((a, b) => b.spend - a.spend || b.childCount - a.childCount);
  }, [filteredAds]);

  // Level 2 — ad sets within the active campaign.
  const adSetGroups: Group[] = useMemo(() => {
    if (!activeCampaign) return [];
    const buckets = new Map<string, { id: string; name: string; ads: MetaAdSummary[] }>();
    for (const ad of filteredAds) {
      if ((ad.campaign_id || 'unknown') !== activeCampaign.id) continue;
      const id = ad.adset_id || 'unknown';
      const name = ad.adset_name || 'Sin ad set';
      let g = buckets.get(id);
      if (!g) {
        g = { id, name, ads: [] };
        buckets.set(id, g);
      }
      g.ads.push(ad);
    }
    return Array.from(buckets.values())
      .map((g) => ({
        id: g.id,
        name: g.name,
        childCount: g.ads.length,
        ...rollUp(g.ads),
      }))
      .sort((a, b) => b.spend - a.spend || b.childCount - a.childCount);
  }, [filteredAds, activeCampaign]);

  // Level 3 — ads inside the active ad set.
  const adsInActiveSet: MetaAdSummary[] = useMemo(() => {
    if (!activeCampaign || !activeAdSet) return [];
    return filteredAds.filter(
      (ad) =>
        (ad.campaign_id || 'unknown') === activeCampaign.id &&
        (ad.adset_id || 'unknown') === activeAdSet.id,
    );
  }, [filteredAds, activeCampaign, activeAdSet]);

  // Detail panel: keep the selected ad in sync with refreshed data.
  useEffect(() => {
    if (!selectedAd) return;
    const fresh = adsQuery.data?.ads.find((a) => a.id === selectedAd.id);
    if (fresh) setSelectedAd(fresh);
  }, [adsQuery.data, selectedAd]);

  // Derived stats for the header line + filter chip
  const totalCampaigns = campaignGroups.length;
  const totalAds = filteredAds.length;
  const totalWinners = filteredAds.filter((a) => a.intel?.is_winner === true).length;

  const level: 'campaigns' | 'adsets' | 'ads' = activeAdSet
    ? 'ads'
    : activeCampaign
      ? 'adsets'
      : 'campaigns';

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

      {/* Breadcrumb */}
      {(activeCampaign || activeAdSet) && (
        <Breadcrumb
          activeCampaign={activeCampaign}
          activeAdSet={activeAdSet}
          onResetAll={() => {
            setActiveCampaign(null);
            setActiveAdSet(null);
          }}
          onResetAdSet={() => setActiveAdSet(null)}
        />
      )}

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
      ) : (
        <>
          {/* Stats line */}
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Filter className="h-3 w-3" />
            {level === 'campaigns'
              ? `${totalCampaigns} campaña${totalCampaigns === 1 ? '' : 's'} · ${totalAds} ad${totalAds === 1 ? '' : 's'}`
              : level === 'adsets'
                ? `${adSetGroups.length} ad set${adSetGroups.length === 1 ? '' : 's'} · ${campaignGroups.find((c) => c.id === activeCampaign?.id)?.spend ? `$${campaignGroups.find((c) => c.id === activeCampaign?.id)!.spend.toFixed(2)} gastado` : ''}`
                : `${adsInActiveSet.length} ad${adsInActiveSet.length === 1 ? '' : 's'} en este conjunto`}
            {' · '}
            <Trophy className="h-3 w-3 text-amber-400" />
            {totalWinners} winners
          </div>

          {/* Level: Campaigns */}
          {level === 'campaigns' && (
            <div className="space-y-2">
              {campaignGroups.length === 0 ? (
                <Empty>No hay campañas que cumplan los filtros.</Empty>
              ) : (
                campaignGroups.map((c) => (
                  <LevelRow
                    key={c.id}
                    name={c.name}
                    status={c.status}
                    childCountLabel={`${c.childCount} ad set${c.childCount === 1 ? '' : 's'} · ${c.active} ad${c.active === 1 ? '' : 's'} activo${c.active === 1 ? '' : 's'}`}
                    winners={c.winners}
                    spend={c.spend}
                    purchases={c.purchases}
                    roas={c.roas}
                    onClick={() => setActiveCampaign({ id: c.id, name: c.name })}
                  />
                ))
              )}
            </div>
          )}

          {/* Level: Ad sets */}
          {level === 'adsets' && (
            <div className="space-y-2">
              {adSetGroups.length === 0 ? (
                <Empty>Esta campaña no tiene ad sets que cumplan los filtros.</Empty>
              ) : (
                adSetGroups.map((s) => (
                  <LevelRow
                    key={s.id}
                    name={s.name}
                    status={s.status}
                    childCountLabel={`${s.childCount} ad${s.childCount === 1 ? '' : 's'} · ${s.active} activo${s.active === 1 ? '' : 's'}`}
                    winners={s.winners}
                    spend={s.spend}
                    purchases={s.purchases}
                    roas={s.roas}
                    onClick={() => setActiveAdSet({ id: s.id, name: s.name })}
                  />
                ))
              )}
            </div>
          )}

          {/* Level: Ads */}
          {level === 'ads' && (
            <>
              {adsInActiveSet.length === 0 ? (
                <Empty>Este ad set no tiene anuncios que cumplan los filtros.</Empty>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
                  {adsInActiveSet.map((ad) => (
                    <AdCard
                      key={ad.id}
                      ad={ad}
                      onClick={() => setSelectedAd(ad)}
                      selected={selectedAd?.id === ad.id}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}

      {selectedAd && <AdDetailPanel ad={selectedAd} onClose={() => setSelectedAd(null)} />}
    </div>
  );
}

interface BreadcrumbProps {
  activeCampaign: { id: string; name: string } | null;
  activeAdSet: { id: string; name: string } | null;
  onResetAll: () => void;
  onResetAdSet: () => void;
}

function Breadcrumb({ activeCampaign, activeAdSet, onResetAll, onResetAdSet }: BreadcrumbProps) {
  return (
    <nav className="flex flex-wrap items-center gap-1.5 text-sm">
      <button
        onClick={onResetAll}
        className="text-gray-400 hover:text-white"
      >
        Todas las campañas
      </button>
      {activeCampaign && (
        <>
          <ChevronRight className="h-3.5 w-3.5 text-gray-600" />
          {activeAdSet ? (
            <button
              onClick={onResetAdSet}
              className="max-w-[260px] truncate text-gray-400 hover:text-white"
              title={activeCampaign.name}
            >
              {activeCampaign.name}
            </button>
          ) : (
            <span className="max-w-[260px] truncate font-medium text-white" title={activeCampaign.name}>
              {activeCampaign.name}
            </span>
          )}
        </>
      )}
      {activeAdSet && (
        <>
          <ChevronRight className="h-3.5 w-3.5 text-gray-600" />
          <span className="max-w-[260px] truncate font-medium text-white" title={activeAdSet.name}>
            {activeAdSet.name}
          </span>
        </>
      )}
    </nav>
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

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-[#141414] p-8 text-center text-sm text-gray-400">
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
