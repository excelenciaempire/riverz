'use client';

import Link from 'next/link';
import { useUser } from '@clerk/nextjs';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Compass } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useActiveBrand } from '@/hooks/useActiveBrand';

type Step = {
  eyebrow: string;
  title: string;
  description: string;
  cta: string;
  href: string;
};

export function NextStepCard() {
  const { user } = useUser();
  const { activeBrand, brands } = useActiveBrand();
  const supabase = createClient();

  const { data: stats } = useQuery({
    queryKey: ['next-step-stats', user?.id, activeBrand?.id],
    queryFn: async () => {
      if (!user?.id) {
        return { staticAds: 0, metaAccounts: 0 };
      }
      const adsPromise = supabase
        .from('generations')
        .select('id', { count: 'exact', head: true })
        .eq('clerk_user_id', user.id)
        .eq('type', 'static_ad_generation');

      const metaPromise = fetch('/api/meta/accounts')
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []);

      const [adsRes, metaData] = await Promise.all([adsPromise, metaPromise]);
      return {
        staticAds: adsRes.count ?? 0,
        metaAccounts: Array.isArray(metaData) ? metaData.length : 0,
      };
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  const step = decideStep({
    hasBrands: brands.length > 0,
    activeBrand,
    staticAds: stats?.staticAds ?? 0,
    metaAccounts: stats?.metaAccounts ?? 0,
  });

  return (
    <Link
      href={step.href}
      className="card-dark group flex flex-col gap-5 overflow-hidden p-6 transition hover:border-[var(--rvz-accent)]/30 md:flex-row md:items-center md:justify-between md:p-7"
    >
      <div className="flex items-start gap-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-[var(--rvz-accent)] text-[var(--rvz-accent-fg)]">
          <Compass className="h-5 w-5" />
        </span>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--rvz-accent)]">
            {step.eyebrow}
          </p>
          <h3 className="mt-1.5 text-[22px] font-medium tracking-tight md:text-[26px] text-[var(--rvz-card-dark-fg)]">
            {step.title}
          </h3>
          <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-[var(--rvz-card-dark-muted)]">
            {step.description}
          </p>
        </div>
      </div>

      <div className="app-v2-cta self-start md:self-auto">
        {step.cta}
        <ArrowRight className="h-3.5 w-3.5" />
      </div>
    </Link>
  );
}

function decideStep({
  hasBrands,
  activeBrand,
  staticAds,
  metaAccounts,
}: {
  hasBrands: boolean;
  activeBrand: ReturnType<typeof useActiveBrand>['activeBrand'];
  staticAds: number;
  metaAccounts: number;
}): Step {
  if (!hasBrands) {
    return {
      eyebrow: 'Próximo paso',
      title: 'Crea tu primera marca',
      description:
        'Sube fotos, precio y beneficios. El Investigador hará el research que alimenta a los demás agentes.',
      cta: 'Crear marca',
      href: '/marcas',
    };
  }
  if (activeBrand && activeBrand.research_status !== 'completed') {
    return {
      eyebrow: 'Próximo paso',
      title: `Termina la investigación de ${activeBrand.name}`,
      description:
        'El Investigador necesita completar el research para que el resto de la orquesta trabaje con tu voz de marca.',
      cta: 'Continuar research',
      href: `/marcas/${activeBrand.id}`,
    };
  }
  if (staticAds === 0) {
    return {
      eyebrow: 'Próximo paso',
      title: 'Genera tu primer anuncio estático',
      description:
        'Activa al Diseñador. En minutos tienes piezas listas para Meta, TikTok y catálogo de tu tienda.',
      cta: 'Crear Static Ad',
      href: activeBrand
        ? `/crear/static-ads?brand=${activeBrand.id}`
        : '/crear/static-ads',
    };
  }
  if (metaAccounts === 0) {
    return {
      eyebrow: 'Próximo paso',
      title: 'Conecta Meta para lanzar tus piezas',
      description:
        'Activa Performance: sube los ganadores directo a tu cuenta y deja que el agente aprenda de los resultados.',
      cta: 'Conectar Meta',
      href: '/campanas/meta',
    };
  }
  return {
    eyebrow: 'Próximo paso',
    title: 'Lanza una campaña',
    description:
      'Tu marca, tus piezas y tu cuenta de Meta están en línea. Pasa a publicar y deja que Performance haga el resto.',
    cta: 'Ir a campañas',
    href: '/campanas/meta',
  };
}
