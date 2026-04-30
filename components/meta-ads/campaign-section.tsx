'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, Trophy } from 'lucide-react';
import { AdCard } from '@/components/meta-ads/ad-card';
import type { MetaAdSummary } from '@/types/meta';
import { cn } from '@/lib/utils';

interface Props {
  campaignId: string;
  campaignName: string;
  ads: MetaAdSummary[];
  onAdClick: (ad: MetaAdSummary) => void;
  selectedAdId?: string;
  defaultOpen?: boolean;
}

const STATUS_DOT: Record<string, string> = {
  ACTIVE: 'bg-emerald-400',
  PAUSED: 'bg-gray-400',
  DELETED: 'bg-red-400',
  ARCHIVED: 'bg-amber-400',
};

function fmtCurrency(n: number): string {
  if (!Number.isFinite(n) || n === 0) return '$0';
  return `$${n.toFixed(n >= 100 ? 0 : 2)}`;
}

export function CampaignSection({
  campaignId,
  campaignName,
  ads,
  onAdClick,
  selectedAdId,
  defaultOpen = true,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);

  const stats = useMemo(() => {
    let spend = 0;
    let purchases = 0;
    let purchaseValue = 0;
    let active = 0;
    let winners = 0;
    for (const ad of ads) {
      if ((ad.effective_status || ad.status) === 'ACTIVE') active += 1;
      if (ad.intel?.is_winner === true) winners += 1;
      if (ad.insights?.spend) spend += Number(ad.insights.spend) || 0;
      if (ad.insights?.purchases) purchases += Number(ad.insights.purchases) || 0;
      if (ad.insights?.purchase_value) purchaseValue += Number(ad.insights.purchase_value) || 0;
    }
    const roas = spend > 0 ? purchaseValue / spend : 0;
    return { spend, purchases, purchaseValue, roas, active, winners };
  }, [ads]);

  // Campaign-level effective status: if any ad is active, treat as active.
  const campaignStatus = ads.some((a) => (a.effective_status || a.status) === 'ACTIVE')
    ? 'ACTIVE'
    : ads[0]?.effective_status || ads[0]?.status || 'PAUSED';

  return (
    <section className="overflow-hidden rounded-xl border border-gray-800 bg-[#0d0d0d]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 border-b border-gray-800 bg-[#141414] px-4 py-3 text-left transition hover:bg-[#181818]"
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <ChevronDown className={cn('h-4 w-4 shrink-0 text-gray-400 transition', !open && '-rotate-90')} />
          <span
            className={cn('h-2 w-2 shrink-0 rounded-full', STATUS_DOT[campaignStatus] || 'bg-gray-500')}
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{campaignName || campaignId}</p>
            <p className="text-[11px] text-gray-500">
              {ads.length} ad{ads.length === 1 ? '' : 's'} · {stats.active} activo{stats.active === 1 ? '' : 's'}
              {stats.winners > 0 && (
                <span className="ml-2 inline-flex items-center gap-0.5 text-amber-400">
                  <Trophy className="h-3 w-3" /> {stats.winners}
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-4 text-right text-xs">
          <Stat label="Gastado" value={fmtCurrency(stats.spend)} />
          <Stat label="Compras" value={stats.purchases ? String(stats.purchases) : '—'} />
          <Stat label="ROAS" value={stats.roas ? `${stats.roas.toFixed(2)}x` : '—'} />
        </div>
      </button>

      {open && (
        <div className="grid gap-4 p-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
          {ads.map((ad) => (
            <AdCard key={ad.id} ad={ad} onClick={() => onAdClick(ad)} selected={selectedAdId === ad.id} />
          ))}
        </div>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="hidden sm:block">
      <div className="text-[9px] uppercase tracking-wide text-gray-500">{label}</div>
      <div className="text-sm font-semibold text-white">{value}</div>
    </div>
  );
}
