'use client';

import Link from 'next/link';
import { useUser } from '@clerk/nextjs';
import { useQuery } from '@tanstack/react-query';
import { Coins, Package, Sparkles, ArrowUpRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useCredits } from '@/hooks/useCredits';
import { useActiveBrand } from '@/hooks/useActiveBrand';
import { ActiveBrandSwitcher } from './ActiveBrandSwitcher';
import { cn } from '@/lib/utils';

function greetingFor(date: Date) {
  const h = date.getHours();
  if (h < 6) return 'Buenas noches';
  if (h < 13) return 'Buenos días';
  if (h < 20) return 'Buenas tardes';
  return 'Buenas noches';
}

const PLAN_LABEL: Record<string, string> = {
  free: 'Free',
  basic: 'Basic',
  pro: 'Pro',
  premium: 'Premium',
};

export function StudioHero() {
  const { user } = useUser();
  const { credits, planType, subscriptionStatus } = useCredits();
  const { brands, isLoading: brandsLoading } = useActiveBrand();

  const supabase = createClient();
  const { data: monthlyCount = 0 } = useQuery({
    queryKey: ['generations-month', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const start = new Date();
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      const { count } = await supabase
        .from('generations')
        .select('id', { count: 'exact', head: true })
        .eq('clerk_user_id', user.id)
        .gte('created_at', start.toISOString());
      return count ?? 0;
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  const firstName = (user?.firstName || user?.username || '').trim();
  const greeting = greetingFor(new Date());

  const subscriptionInactive =
    planType === 'free' || (subscriptionStatus !== 'active' && planType !== 'free');

  return (
    <section className="relative isolate -mx-8 -mt-8 overflow-hidden border-b border-white/5 px-8 pb-10 pt-10 md:pt-14">
      {/* Fondo: aurora + grid + noise */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="aurora opacity-60" />
        <div className="absolute inset-0 bg-grid bg-grid-fade opacity-70" />
        <div className="absolute inset-0 bg-noise mix-blend-overlay opacity-30" />
        <div className="absolute inset-x-0 top-0 h-[70%] bg-[radial-gradient(ellipse_60%_45%_at_50%_0%,rgba(20,224,204,0.14),transparent_75%)]" />
      </div>

      <div className="grid items-start gap-6 md:grid-cols-[1.1fr_minmax(320px,420px)]">
        {/* Saludo */}
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-white/65 backdrop-blur">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#14E0CC] opacity-70" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#14E0CC]" />
            </span>
            Tu estudio · 8 agentes en línea
          </div>

          <h1 className="font-display mt-4 text-[clamp(28px,4.4vw,48px)] font-semibold leading-[1.05] tracking-tight">
            <span className="block text-white">
              {greeting}
              {firstName ? `, ${firstName}` : ''}.
            </span>
            <span className="block text-gradient-primary">
              ¿Qué creamos hoy para tu marca?
            </span>
          </h1>

          <p className="mt-4 max-w-xl text-[14px] leading-relaxed text-white/60">
            Tu estudio creativo está montado. Activa una marca, asigna un agente y entrega
            piezas listas para Meta, TikTok y tu tienda — sin set, sin freelancers.
          </p>
        </div>

        {/* Brand switcher */}
        <div className="flex justify-start md:justify-end">
          <ActiveBrandSwitcher />
        </div>
      </div>

      {/* Stats */}
      <div className="relative mt-8 grid gap-3 sm:grid-cols-3">
        <StatTile
          icon={<Coins className="h-4 w-4" />}
          label="Créditos"
          value={credits.toLocaleString('es-CO')}
          hint={`Plan ${PLAN_LABEL[planType] ?? planType}`}
          accent="#14E0CC"
          href="/configuracion"
          badge={
            subscriptionInactive ? (
              <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-200">
                Activa tu plan
              </span>
            ) : null
          }
        />
        <StatTile
          icon={<Package className="h-4 w-4" />}
          label="Marcas"
          value={brandsLoading ? '—' : brands.length}
          hint="Productos en tu estudio"
          accent="#A78BFA"
          href="/marcas"
        />
        <StatTile
          icon={<Sparkles className="h-4 w-4" />}
          label="Generaciones este mes"
          value={monthlyCount}
          hint="Piezas producidas"
          accent="#F472B6"
          href="/historial"
        />
      </div>
    </section>
  );
}

function StatTile({
  icon,
  label,
  value,
  hint,
  accent,
  href,
  badge,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  hint: string;
  accent: string;
  href: string;
  badge?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'group glass-strong relative flex items-center justify-between overflow-hidden rounded-2xl px-5 py-4 transition',
        'hover:border-white/15',
      )}
    >
      <div className="flex items-center gap-3">
        <span
          className="grid h-9 w-9 place-items-center rounded-xl"
          style={{
            background: `linear-gradient(160deg, ${accent}33, ${accent}10)`,
            border: `1px solid ${accent}33`,
            color: accent,
          }}
        >
          {icon}
        </span>
        <div>
          <div className="flex items-center gap-2">
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/45">
              {label}
            </p>
            {badge}
          </div>
          <p className="font-display mt-0.5 text-2xl font-semibold leading-none text-white">
            {value}
          </p>
          <p className="mt-1 text-[11px] text-white/45">{hint}</p>
        </div>
      </div>
      <ArrowUpRight className="h-4 w-4 text-white/30 transition group-hover:translate-x-0.5 group-hover:text-white" />
    </Link>
  );
}
