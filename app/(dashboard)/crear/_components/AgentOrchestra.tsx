'use client';

import Link from 'next/link';
import { useRef } from 'react';
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
    <section className="space-y-5">
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#A78BFA]">
            Tu orquesta
          </p>
          <h2 className="font-display mt-2 text-2xl font-semibold tracking-tight text-white md:text-3xl">
            8 agentes cubriendo cada etapa del estudio
          </h2>
        </div>
        <span className="hidden text-xs text-white/45 md:block">
          {hasBrand ? '8 en línea' : '1 en línea · activa una marca'}
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
  const ref = useRef<HTMLAnchorElement>(null);
  const Icon = agent.icon;
  const primary = agent.routes[0];

  const handleMove = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    el.style.setProperty('--mx', `${x}%`);
    el.style.setProperty('--my', `${y}%`);
  };

  return (
    <Link
      ref={ref}
      href={locked ? '/marcas' : primary.href}
      onMouseMove={handleMove}
      className={cn(
        'group relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/[0.07] p-5 transition',
        'bg-gradient-to-br from-white/[0.04] to-white/[0.01] backdrop-blur',
        'hover:-translate-y-0.5 hover:border-white/15',
        locked && 'opacity-70',
      )}
      style={{ borderLeft: `2px solid ${agent.hue}40` }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{
          background: `radial-gradient(280px circle at var(--mx,50%) var(--my,50%), ${agent.hue}22, transparent 60%)`,
        }}
      />

      <div className="relative flex items-start justify-between">
        <div
          className="grid h-11 w-11 place-items-center rounded-2xl"
          style={{
            background: `linear-gradient(160deg, ${agent.hue}40, ${agent.hue}10)`,
            border: `1px solid ${agent.hue}40`,
            color: agent.hue,
            boxShadow: `0 10px 32px -16px ${agent.hue}80`,
          }}
        >
          <Icon className="h-5 w-5" />
        </div>
        {locked ? (
          <span className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[9px] uppercase tracking-wider text-white/55">
            <Lock className="h-2.5 w-2.5" />
            Marca
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-white/45">
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{
                background: agent.hue,
                boxShadow: `0 0 8px ${agent.hue}`,
              }}
            />
            {connected ? 'Meta conectado' : 'En línea'}
          </span>
        )}
      </div>

      <div className="relative mt-4">
        <h3 className="font-display text-lg font-semibold tracking-tight text-white">
          {agent.name}
        </h3>
        <p
          className="text-[11px] font-medium uppercase tracking-[0.18em]"
          style={{ color: agent.hue }}
        >
          {agent.role}
        </p>
        <p className="mt-2 text-[12.5px] leading-relaxed text-white/60">
          {agent.description}
        </p>
      </div>

      <div className="relative mt-4 flex flex-wrap gap-1.5">
        {agent.routes.map((route) => (
          <span
            key={route.href + route.label}
            className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-white/65"
          >
            {route.label}
          </span>
        ))}
      </div>

      <div className="relative mt-4 flex items-center justify-between text-[11px] font-medium text-white/55">
        <span>{locked ? 'Crea una marca primero' : `Abrir ${primary.label}`}</span>
        <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5 group-hover:text-white" />
      </div>
    </Link>
  );
}
