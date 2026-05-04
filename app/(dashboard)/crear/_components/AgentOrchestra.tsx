'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Lock } from 'lucide-react';
import { AGENTS, type Agent } from '../_lib/agents';
import { useActiveBrand } from '@/hooks/useActiveBrand';
import { cn } from '@/lib/utils';

export function AgentOrchestra() {
  const { brands } = useActiveBrand();
  const hasBrand = brands.length > 0;

  const { data: metaAccounts } = useQuery({
    queryKey: ['meta-accounts'],
    queryFn: async () => {
      const res = await fetch('/api/meta/accounts');
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 60_000,
  });

  const performanceConnected = Array.isArray(metaAccounts) && metaAccounts.length > 0;

  return (
    <section className="space-y-6">
      <header className="app-v2-section-head">
        <div>
          <p className="app-v2-eyebrow">Tu orquesta</p>
          <h2 className="app-v2-page-h2 mt-2">8 agentes cubriendo cada etapa del estudio</h2>
        </div>
        <span className="hidden text-[12px] text-black/55 md:block">
          {hasBrand ? '8 en línea' : '1 en línea · activá una marca'}
        </span>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {AGENTS.map((agent) => {
          const locked = agent.requiresBrand && !hasBrand;
          const showConnected = agent.id === 'performance' && performanceConnected;
          return (
            <AgentTile
              key={agent.id}
              agent={agent}
              locked={locked}
              connected={showConnected}
            />
          );
        })}
      </div>
    </section>
  );
}

function AgentTile({
  agent,
  locked,
  connected,
}: {
  agent: Agent;
  locked: boolean;
  connected: boolean;
}) {
  const Icon = agent.icon;
  const primary = agent.routes[0];

  return (
    <Link
      href={locked ? '/marcas' : primary.href}
      className={cn(
        'card-cream group relative flex h-full flex-col p-5 transition',
        'hover:-translate-y-0.5 hover:border-black/30 hover:shadow-[0_18px_40px_-24px_rgba(0,0,0,0.18)]',
        locked && 'opacity-70',
      )}
    >
      <div className="flex items-start justify-between">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-[#0a0a0a] text-[#f7ff9e]">
          <Icon className="h-4 w-4" />
        </div>
        {locked ? (
          <span className="flex items-center gap-1 rounded-full border border-black/10 bg-black/[0.04] px-2 py-0.5 text-[9px] uppercase tracking-wider text-black/55">
            <Lock className="h-2.5 w-2.5" />
            Marca
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.2em] text-black/45">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {connected ? 'Meta conectado' : 'En línea'}
          </span>
        )}
      </div>

      <div className="mt-4 flex-1">
        <h3 className="text-[18px] font-medium tracking-tight text-black">{agent.name}</h3>
        <p className="app-v2-eyebrow mt-1">{agent.role}</p>
        <p className="mt-3 text-[13px] leading-relaxed text-black/60">{agent.description}</p>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {agent.routes.map((route) => (
          <span
            key={route.href + route.label}
            className="rounded-full border border-black/10 bg-[#fafaf7] px-2 py-0.5 text-[10px] font-medium text-black/65"
          >
            {route.label}
          </span>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-[#eee5d6] pt-3 text-[11px] font-medium text-black/60">
        <span>{locked ? 'Creá una marca primero' : `Abrir ${primary.label}`}</span>
        <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5 group-hover:text-black" />
      </div>
    </Link>
  );
}
