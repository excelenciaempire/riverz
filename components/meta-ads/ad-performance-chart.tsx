'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { Loader2 } from 'lucide-react';
import type { AdTimeSeriesRow } from '@/types/meta';
import { cn } from '@/lib/utils';

type Metric = 'spend' | 'roas' | 'ctr' | 'cpm';

const METRICS: Array<{
  key: Metric;
  label: string;
  color: string;
  format: (n: number) => string;
}> = [
  { key: 'spend', label: 'Spend', color: '#07A498', format: (n) => `$${n.toFixed(2)}` },
  { key: 'roas', label: 'ROAS', color: '#FACC15', format: (n) => `${n.toFixed(2)}x` },
  { key: 'ctr', label: 'CTR', color: '#60A5FA', format: (n) => `${n.toFixed(2)}%` },
  { key: 'cpm', label: 'CPM', color: '#F472B6', format: (n) => `$${n.toFixed(2)}` },
];

interface Props {
  adId: string;
  datePreset: string;
}

export function AdPerformanceChart({ adId, datePreset }: Props) {
  const [metric, setMetric] = useState<Metric>('spend');
  const query = useQuery<{ series: AdTimeSeriesRow[] }>({
    queryKey: ['meta-ad-timeseries', adId, datePreset],
    queryFn: async () => {
      const r = await fetch(
        `/api/meta/ads/${adId}/timeseries?datePreset=${encodeURIComponent(datePreset)}`,
      );
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body?.error || 'No se pudieron cargar las series');
      }
      return r.json();
    },
  });

  const config = METRICS.find((m) => m.key === metric)!;
  const data = useMemo(() => {
    if (!query.data) return [];
    return query.data.series.map((row) => ({
      date: row.date,
      // Surface 0 instead of undefined so the line doesn't break.
      value: typeof row[metric] === 'number' ? Number(row[metric]) : 0,
    }));
  }, [query.data, metric]);

  const allZero = data.length > 0 && data.every((d) => !d.value);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {METRICS.map((m) => (
          <button
            key={m.key}
            onClick={() => setMetric(m.key)}
            className={cn(
              'rounded-md border px-2 py-1 text-[11px] font-medium transition',
              metric === m.key
                ? 'border-[var(--rvz-ink)] bg-[var(--rvz-accent)]/20 text-[var(--rvz-ink)]'
                : 'border-[var(--rvz-card-border)] bg-black/30 text-[var(--rvz-ink-muted)] hover:text-[var(--rvz-ink)]',
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-[var(--rvz-card-border)] bg-black/30 p-3">
        {query.isLoading ? (
          <div className="flex h-48 items-center justify-center text-xs text-[var(--rvz-ink-muted)]">
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Cargando…
          </div>
        ) : query.error ? (
          <div className="flex h-48 items-center justify-center text-xs text-red-400">
            {(query.error as Error).message}
          </div>
        ) : data.length === 0 ? (
          <div className="flex h-48 items-center justify-center text-xs text-[var(--rvz-ink-muted)]">
            Sin datos en este periodo.
          </div>
        ) : allZero ? (
          <div className="flex h-48 items-center justify-center text-xs text-[var(--rvz-ink-muted)]">
            Todos los valores de {config.label} son 0 en este rango.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: '#6b7280' }}
                tickFormatter={(v: string) => v.slice(5)}
                stroke="#374151"
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#6b7280' }}
                tickFormatter={(v: number) => config.format(v)}
                stroke="#374151"
                width={64}
              />
              <Tooltip
                contentStyle={{
                  background: '#0a0a0a',
                  border: '1px solid #1f2937',
                  borderRadius: 8,
                  fontSize: 12,
                  color: '#fff',
                }}
                labelStyle={{ color: '#9ca3af' }}
                formatter={(v: number) => config.format(v)}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={config.color}
                strokeWidth={2}
                dot={{ r: 2, fill: config.color }}
                activeDot={{ r: 4 }}
                name={config.label}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
