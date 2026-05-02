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
  pending: { dot: 'bg-white/40 animate-pulse', label: 'En cola' },
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
    <section className="space-y-4">
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#14E0CC]">
            Continúa donde lo dejaste
          </p>
          <h2 className="font-display mt-2 text-xl font-semibold tracking-tight text-white md:text-2xl">
            Trabajo reciente
          </h2>
        </div>
        <Link
          href="/historial"
          className="inline-flex items-center gap-1 text-xs font-medium text-white/60 transition hover:text-white"
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
      className={cn(
        'group glass-strong relative flex w-[200px] shrink-0 flex-col overflow-hidden rounded-2xl transition',
        'hover:-translate-y-0.5 hover:border-white/15',
      )}
    >
      <div className="relative aspect-square overflow-hidden bg-black/40">
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
          <div className="flex h-full items-center justify-center text-white/30">
            <Clock className="h-6 w-6" />
          </div>
        )}

        <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full border border-white/10 bg-black/60 px-2 py-0.5 text-[10px] font-medium backdrop-blur">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: agent.hue, boxShadow: `0 0 6px ${agent.hue}` }}
          />
          <span className="text-white/85">{getTypeLabel(item.type)}</span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 px-3 py-2.5">
        <div className="flex items-center gap-1.5 text-[10px] text-white/55">
          <span className={cn('h-1.5 w-1.5 rounded-full', tone.dot)} />
          {tone.label}
        </div>
        <p className="truncate text-[10px] text-white/45">{created}</p>
      </div>
    </Link>
  );
}
