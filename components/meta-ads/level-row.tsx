'use client';

import { ChevronRight, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';

const STATUS_DOT: Record<string, string> = {
  ACTIVE: 'bg-emerald-400',
  PAUSED: 'bg-gray-400',
  DELETED: 'bg-red-400',
  ARCHIVED: 'bg-amber-400',
};

interface Props {
  name: string;
  status: string;
  childCountLabel: string;        // "12 ad sets · 3 activos" or "8 ads · 2 activos"
  winners?: number;
  spend: number;
  purchases: number;
  roas: number;
  onClick: () => void;
}

function fmtCurrency(n: number): string {
  if (!Number.isFinite(n) || n === 0) return '$0';
  return `$${n.toFixed(n >= 100 ? 0 : 2)}`;
}

export function LevelRow({
  name,
  status,
  childCountLabel,
  winners = 0,
  spend,
  purchases,
  roas,
  onClick,
}: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center justify-between gap-4 rounded-xl border border-[var(--rvz-card-border)] bg-[var(--rvz-card)] px-4 py-3 text-left transition hover:border-[var(--rvz-ink)] hover:bg-[#181818]"
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span
          className={cn('h-2 w-2 shrink-0 rounded-full', STATUS_DOT[status] || 'bg-gray-500')}
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[var(--rvz-ink)]">{name}</p>
          <p className="text-[11px] text-[var(--rvz-ink-muted)]">
            {childCountLabel}
            {winners > 0 && (
              <span className="ml-2 inline-flex items-center gap-0.5 text-amber-400">
                <Trophy className="h-3 w-3" /> {winners}
              </span>
            )}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-5 text-right text-xs">
        <Stat label="Gastado" value={fmtCurrency(spend)} />
        <Stat label="Compras" value={purchases ? String(purchases) : '—'} />
        <Stat label="ROAS" value={roas ? `${roas.toFixed(2)}x` : '—'} />
        <ChevronRight className="h-4 w-4 text-[var(--rvz-ink-muted)] transition group-hover:translate-x-0.5 group-hover:text-[var(--rvz-ink)]" />
      </div>
    </button>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="hidden sm:block">
      <div className="text-[9px] uppercase tracking-wide text-[var(--rvz-ink-muted)]">{label}</div>
      <div className="text-sm font-semibold text-[var(--rvz-ink)]">{value}</div>
    </div>
  );
}
