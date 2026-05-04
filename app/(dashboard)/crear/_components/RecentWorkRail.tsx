'use client';

import Link from 'next/link';
import { useUser } from '@clerk/nextjs';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { createClient } from '@/lib/supabase/client';
import { useActiveBrand } from '@/hooks/useActiveBrand';
import { getAgentForType, getTypeLabel, getTypeRoute, isVideoType } from '../_lib/agents';
import type { Generation } from '@/types';
import { cn } from '@/lib/utils';

const STATUS_TONE: Record<Generation['status'], { dot: string; label: string }> = {
  completed: { dot: 'bg-emerald-400', label: 'Listo' },
  processing: { dot: 'bg-amber-300 animate-pulse', label: 'En proceso' },
  pending: { dot: 'bg-[var(--rvz-ink-faint)] animate-pulse', label: 'En cola' },
  failed: { dot: 'bg-rose-400', label: 'Falló' },
};

export function RecentWorkRail() {
  const { user } = useUser();
  const { activeBrandId } = useActiveBrand();
  const supabase = createClient();

  const { data: items = [], isLoading } = useQuery<Generation[]>({
    queryKey: ['recent-generations', user?.id, activeBrandId],
    queryFn: async () => {
      if (!user?.id) return [];
      let query = supabase
        .from('generations')
        .select('*')
        .eq('clerk_user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(8);
      if (activeBrandId) {
        // Generations link to product via input_data->>product_id when applicable.
        query = query.filter('input_data->>product_id', 'eq', activeBrandId);
      }
      const { data } = await query;
      return (data ?? []) as Generation[];
    },
    enabled: !!user,
    staleTime: 15_000,
  });

  if (isLoading || items.length === 0) return null;

  return (
    <section className="space-y-5">
      <header className="app-v2-section-head">
        <div>
          <p className="app-v2-eyebrow">Continúa donde lo dejaste</p>
          <h2 className="app-v2-page-h2 mt-2">Trabajo reciente</h2>
        </div>
        <Link
          href="/historial"
          className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--rvz-ink-muted)] transition hover:text-[var(--rvz-ink)]"
        >
          Ver todo
          <ArrowRight className="h-3 w-3" />
        </Link>
      </header>

      <div className="-mx-2 overflow-x-auto pb-2">
        <div className="flex gap-3 px-2">
          {items.map((item) => (
            <RecentCard key={item.id} item={item} />
          ))}
        </div>
      </div>
    </section>
  );
}

function RecentCard({ item }: { item: Generation }) {
  const agent = getAgentForType(item.type);
  const tone = STATUS_TONE[item.status] ?? STATUS_TONE.pending;
  const href = `${getTypeRoute(item.type)}?regenerate=${item.id}`;
  const created = formatDistanceToNow(new Date(item.created_at), {
    addSuffix: true,
    locale: es,
  });

  return (
    <Link
      href={href}
      className="card-cream group relative flex w-[200px] shrink-0 flex-col overflow-hidden p-0 transition hover:-translate-y-0.5 hover:border-[var(--rvz-card-hover-border)]"
    >
      <div className="relative aspect-square overflow-hidden bg-[var(--rvz-bg-soft)]">
        {item.result_url ? (
          isVideoType(item.type) ? (
            <video
              src={item.result_url}
              muted
              playsInline
              className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.result_url}
              alt={getTypeLabel(item.type)}
              className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            />
          )
        ) : (
          <div className="flex h-full items-center justify-center text-[var(--rvz-ink-faint)]">
            <Clock className="h-6 w-6" />
          </div>
        )}

        <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full border border-[var(--rvz-card-border)] bg-[var(--rvz-card)] px-2 py-0.5 text-[10px] font-medium backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--rvz-ink)]" />
          <span className="text-[var(--rvz-ink)]">{getTypeLabel(item.type)}</span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 px-3 py-2.5">
        <div className="flex items-center gap-1.5 text-[10px] text-[var(--rvz-ink-muted)]">
          <span className={cn('h-1.5 w-1.5 rounded-full', tone.dot)} />
          {tone.label}
        </div>
        <p className="truncate text-[10px] text-[var(--rvz-ink-faint)]">{created}</p>
      </div>
    </Link>
  );
}
