'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

const FinalScene = dynamic(() => import('./final-scene').then((m) => m.FinalScene), {
  ssr: false,
  loading: () => null,
});

export function FinalCTA() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      const chars = el.querySelectorAll<HTMLElement>('[data-fcta-char]');
      gsap.set(chars, { yPercent: 100, opacity: 0 });
      gsap.to(chars, {
        yPercent: 0,
        opacity: 1,
        duration: 1.1,
        ease: 'expo.out',
        stagger: 0.015,
        scrollTrigger: { trigger: el, start: 'top 70%' },
      });
      gsap.from('[data-fcta-fade]', {
        opacity: 0,
        y: 24,
        duration: 1,
        stagger: 0.12,
        ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 70%' },
      });
    }, el);
    return () => ctx.revert();
  }, []);

  const lines = [
    { text: 'Tu próxima campaña', tone: 'white' },
    { text: 'empieza hoy.',       tone: 'gradient' },
  ] as const;

  return (
    <section ref={ref} className="relative overflow-hidden py-32 md:py-44">
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-grid bg-grid-fade opacity-30" />
        <div className="aurora opacity-90" />
      </div>

      {/* Escena 3D ambiental detrás */}
      <div className="pointer-events-none absolute inset-0 -z-[5] opacity-90">
        <FinalScene />
      </div>

      <div className="relative mx-auto max-w-4xl px-5 text-center md:px-8">
        <span data-fcta-fade className="relative inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.24em] text-white/70 backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-[#14E0CC] shadow-[0_0_10px_#14E0CC]" />
          Listo para tu marca
        </span>

        <h2 className="font-display mt-7 text-[clamp(40px,9vw,120px)] font-semibold leading-[0.95] tracking-[-0.04em]">
          {lines.map((line, li) => (
            <span key={li} className="block overflow-hidden pb-[0.06em]">
              <span className="inline-block">
                {Array.from(line.text).map((ch, ci) => (
                  <span
                    key={ci}
                    data-fcta-char
                    className={`inline-block ${line.tone === 'gradient' ? 'text-gradient-primary' : 'text-white'}`}
                  >
                    {ch === ' ' ? ' ' : ch}
                  </span>
                ))}
              </span>
            </span>
          ))}
        </h2>

        <p data-fcta-fade className="mx-auto mt-7 max-w-xl text-[15px] leading-relaxed text-white/60 md:text-[18px]">
          Crea tu primera pieza con Riverz en menos de 10 minutos. Sin tarjeta,
          sin shootings, sin esperar.
        </p>

        <div data-fcta-fade className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/sign-up"
            className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-8 py-4 text-[15px] font-semibold text-black shadow-[0_28px_60px_-14px_rgba(20,224,204,0.55)] transition hover:translate-y-[-1px] sm:w-auto"
          >
            Empieza gratis
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="transition group-hover:translate-x-0.5">
              <path d="M5 12h14M13 5l7 7-7 7" />
            </svg>
          </Link>
          <Link
            href="/sign-in"
            className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.03] px-7 py-4 text-[15px] font-medium text-white/85 backdrop-blur transition hover:border-white/25 hover:bg-white/[0.06] sm:w-auto"
          >
            Iniciar sesión
          </Link>
        </div>

        <p data-fcta-fade className="mt-6 text-[12px] text-white/40">
          312 marcas activas · 1.2M+ assets entregados · Soporte humano en español
        </p>
      </div>
    </section>
  );
}
