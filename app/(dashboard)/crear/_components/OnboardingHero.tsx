'use client';

import Link from 'next/link';
import { ArrowRight, Brain, Sparkles, Zap } from 'lucide-react';

const steps = [
  {
    icon: Zap,
    title: 'Crea tu marca',
    description: 'Sube fotos del producto, precio, beneficios y sitio web.',
  },
  {
    icon: Brain,
    title: 'Investigación IA',
    description: 'El Investigador analiza audiencia, competencia y ángulos.',
  },
  {
    icon: Sparkles,
    title: 'Tu primera pieza',
    description: 'Static Ads, UGC o clips listos para Meta y TikTok.',
  },
];

export function OnboardingHero() {
  return (
    <section className="glass-strong relative isolate overflow-hidden rounded-3xl px-6 py-10 md:px-10 md:py-14">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="aurora opacity-50" />
        <div className="absolute inset-0 bg-grid bg-grid-fade opacity-50" />
      </div>

      <div className="mx-auto max-w-3xl text-center">
        <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[#A78BFA]">
          Bienvenido al estudio
        </p>
        <h2 className="font-display mt-3 text-[clamp(28px,4.5vw,44px)] font-semibold leading-[1.05] tracking-tight">
          <span className="block text-white">Empieza por tu marca.</span>
          <span className="block text-gradient-primary">El estudio se monta solo.</span>
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-[14px] leading-relaxed text-white/65">
          En 3 pasos tienes tu primer anuncio listo para publicar. Riverz necesita
          conocer tu producto antes de que la orquesta empiece a trabajar.
        </p>
      </div>

      <ol className="mx-auto mt-10 grid max-w-3xl gap-3 md:grid-cols-3">
        {steps.map((step, i) => {
          const Icon = step.icon;
          return (
            <li
              key={step.title}
              className="relative rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5"
            >
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/35">
                paso 0{i + 1}
              </span>
              <div className="mt-3 flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-[#14E0CC]">
                  <Icon className="h-4 w-4" />
                </span>
                <h3 className="font-display text-base font-semibold tracking-tight text-white">
                  {step.title}
                </h3>
              </div>
              <p className="mt-3 text-[12.5px] leading-relaxed text-white/55">
                {step.description}
              </p>
            </li>
          );
        })}
      </ol>

      <div className="mt-10 flex flex-col items-center gap-3">
        <Link
          href="/marcas"
          className="group inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-[14px] font-semibold text-black shadow-[0_18px_40px_-12px_rgba(20,224,204,0.55)] transition hover:translate-y-[-1px]"
        >
          Crear mi primera marca
          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
        </Link>
        <p className="text-[11px] text-white/40">
          Tarda 2 minutos · 0 créditos para registrar la marca
        </p>
      </div>
    </section>
  );
}
