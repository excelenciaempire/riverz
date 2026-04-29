'use client';

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

const sentence =
  'Tu marca produce más contenido en una semana que el último año entero. Con la misma identidad. Sin contratar a nadie.';

/**
 * Manifiesto sticky con word-by-word scroll-scrub. Cada palabra cambia de color
 * de gris suave a blanco a medida que el usuario hace scroll dentro del contenedor.
 */
export function ScrollManifesto() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      const words = el.querySelectorAll<HTMLElement>('[data-word]');
      gsap.fromTo(
        words,
        { color: 'rgba(255,255,255,0.10)' },
        {
          color: 'rgba(255,255,255,1)',
          stagger: 0.05,
          ease: 'none',
          scrollTrigger: {
            trigger: el,
            start: 'top 70%',
            end: 'bottom 25%',
            scrub: 0.8,
          },
        }
      );

      // Side titles parallax
      gsap.utils.toArray<HTMLElement>('[data-side]').forEach((s) => {
        gsap.to(s, {
          yPercent: -25,
          ease: 'none',
          scrollTrigger: {
            trigger: el,
            start: 'top bottom',
            end: 'bottom top',
            scrub: true,
          },
        });
      });
    }, el);
    return () => ctx.revert();
  }, []);

  const words = sentence.split(' ');

  return (
    <section ref={ref} className="relative overflow-hidden py-32 md:py-48">
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-grid bg-grid-fade opacity-30" />
        <div className="absolute inset-x-0 top-1/2 h-[60%] -translate-y-1/2 bg-[radial-gradient(ellipse_50%_60%_at_50%_50%,rgba(20,224,204,0.06),transparent_70%)]" />
      </div>

      {/* Etiquetas verticales en parallax */}
      <div data-side className="pointer-events-none absolute left-3 top-1/2 hidden -translate-y-1/2 -rotate-90 text-[10px] uppercase tracking-[0.36em] text-white/25 md:block">
        manifesto · 2026
      </div>
      <div data-side className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rotate-90 text-[10px] uppercase tracking-[0.36em] text-white/25 md:block">
        riverz · studio
      </div>

      <div className="mx-auto max-w-6xl px-5 md:px-8">
        <span className="block text-center text-[11px] font-semibold uppercase tracking-[0.32em] text-white/40">
          Estudio creativo, repensado
        </span>
        <p className="font-display mt-8 text-balance text-center text-[clamp(28px,5.4vw,72px)] font-semibold leading-[1.06] tracking-[-0.02em]">
          {words.map((w, i) => (
            <span key={i} data-word className="mr-[0.22em] inline-block transition-colors will-change-[color]">
              {w}
            </span>
          ))}
        </p>
      </div>
    </section>
  );
}
