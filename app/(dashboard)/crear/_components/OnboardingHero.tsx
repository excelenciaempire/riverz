'use client';

import Link from 'next/link';
import { ArrowRight, Brain, Sparkles, Zap } from 'lucide-react';

const steps = [
  {
    icon: Zap,
    title: 'Creá tu marca',
    description: 'Subí fotos del producto, precio, beneficios y sitio web.',
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
    <section className="card-dark relative overflow-hidden px-6 py-12 md:px-12 md:py-16">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#f7ff9e]">
          Bienvenido al estudio
        </p>
        <h2 className="mt-3 text-[clamp(34px,5.5vw,56px)] font-medium leading-[1.0] tracking-tight">
          Empezá por tu marca.
          <br />
          <span className="text-white/60">El estudio se monta solo.</span>
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-[14px] leading-relaxed text-white/65">
          En 3 pasos tenés tu primer anuncio listo para publicar. Riverz necesita conocer tu
          producto antes de que la orquesta empiece a trabajar.
        </p>
      </div>

      <ol className="mx-auto mt-12 grid max-w-3xl gap-3 md:grid-cols-3">
        {steps.map((step, i) => {
          const Icon = step.icon;
          return (
            <li
              key={step.title}
              className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5"
            >
              <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/40">
                Paso 0{i + 1}
              </span>
              <div className="mt-3 flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#f7ff9e] text-black">
                  <Icon className="h-4 w-4" />
                </span>
                <h3 className="text-[16px] font-medium tracking-tight">{step.title}</h3>
              </div>
              <p className="mt-3 text-[12.5px] leading-relaxed text-white/55">
                {step.description}
              </p>
            </li>
          );
        })}
      </ol>

      <div className="mt-12 flex flex-col items-center gap-3">
        <Link href="/marcas" className="app-v2-cta">
          Crear mi primera marca
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
        <p className="text-[11px] text-white/45">
          Tarda 2 minutos · 0 créditos para registrar la marca
        </p>
      </div>
    </section>
  );
}
