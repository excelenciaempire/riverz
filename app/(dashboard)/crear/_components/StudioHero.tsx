'use client';

import Link from 'next/link';
import { useUser } from '@clerk/nextjs';
import { useQuery } from '@tanstack/react-query';
import { Coins, Package, Sparkles, ArrowUpRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useCredits } from '@/hooks/useCredits';
import { useActiveBrand } from '@/hooks/useActiveBrand';
import { ActiveBrandSwitcher } from './ActiveBrandSwitcher';

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
    <section className="page-hero relative pb-10">
      <div className="grid items-end gap-6 md:grid-cols-[1.2fr_minmax(320px,420px)]">
        <div>
          <p className="app-v2-eyebrow">
            Tu estudio · 8 agentes en línea
          </p>
          <h1 className="app-v2-page-h1 mt-3">
            {greeting}
            {firstName ? `, ${firstName}` : ''}.
            <br />
            <span className="text-[var(--rvz-ink-muted)]">¿Qué creamos hoy?</span>
          </h1>
          <p className="mt-4 max-w-xl text-[14px] leading-relaxed text-[var(--rvz-ink-muted)]">
            Tu estudio creativo está montado. Activá una marca, asigná un agente y entregá
            piezas listas para Meta, TikTok y tu tienda — sin set, sin freelancers.
          </p>
        </div>

        <div className="flex justify-start md:justify-end">
          <ActiveBrandSwitcher />
        </div>
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        <StatTile
          icon={<Coins className="h-4 w-4" />}
          label="Créditos"
          value={credits.toLocaleString('es-CO')}
          hint={`Plan ${PLAN_LABEL[planType] ?? planType}`}
          href="/configuracion"
          badge={
            subscriptionInactive ? (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-800">
                Activá tu plan
              </span>
            ) : null
          }
        />
        <StatTile
          icon={<Package className="h-4 w-4" />}
          label="Marcas"
          value={brandsLoading ? '—' : brands.length}
          hint="Productos en tu estudio"
          href="/marcas"
        />
        <StatTile
          icon={<Sparkles className="h-4 w-4" />}
          label="Generaciones este mes"
          value={monthlyCount}
          hint="Piezas producidas"
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
  href,
  badge,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  hint: string;
  href: string;
  badge?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="card-cream group relative flex items-center justify-between p-5 transition hover:border-[var(--rvz-card-hover-border)]"
    >
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--rvz-ink)] text-[var(--rvz-accent)]">
          {icon}
        </span>
        <div>
          <div className="flex items-center gap-2">
            <p className="app-v2-eyebrow">{label}</p>
            {badge}
          </div>
          <p className="mt-1 text-[26px] font-medium leading-none tracking-tight text-[var(--rvz-ink)]">
            {value}
          </p>
          <p className="mt-1.5 text-[11px] text-[var(--rvz-ink-faint)]">{hint}</p>
        </div>
      </div>
      <ArrowUpRight className="h-4 w-4 text-[var(--rvz-ink-faint)] transition group-hover:translate-x-0.5 group-hover:text-[var(--rvz-ink)]" />
    </Link>
  );
}
