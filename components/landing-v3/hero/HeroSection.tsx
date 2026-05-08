'use client';

import { useCallback } from 'react';
import Link from 'next/link';
import { ScrollScene } from '../shared/ScrollScene';
import { HeroCanvas } from './HeroCanvas';
import { setHeroProgress } from './useScrollProgress';
import type { SceneBuilder } from '../shared/useGsapScene';

export function HeroSection() {
  const buildTimeline: SceneBuilder = useCallback(({ timeline, select }) => {
    const eyebrow = select('[data-hero-eyebrow]')[0];
    const headlines = select('[data-hero-headline]');
    const sub = select('[data-hero-sub]')[0];
    const ctas = select('[data-hero-ctas]')[0];

    // Initial states.
    if (eyebrow) timeline.set(eyebrow, { opacity: 0, y: 24 });
    timeline.set(headlines, { opacity: 0, y: 60, letterSpacing: '0.04em' });
    if (sub) timeline.set(sub, { opacity: 0, y: 24 });
    if (ctas) timeline.set(ctas, { opacity: 0, y: 24 });

    // Master scrubbed timeline. Internal labels mark beats.
    if (eyebrow) timeline.to(eyebrow, { opacity: 1, y: 0, duration: 0.5 }, 0.05);
    timeline.to(
      headlines,
      {
        opacity: 1,
        y: 0,
        letterSpacing: '-0.045em',
        duration: 1,
        stagger: 0.15,
      },
      0.2
    );
    if (sub) timeline.to(sub, { opacity: 1, y: 0, duration: 0.6 }, 0.7);
    if (ctas) timeline.to(ctas, { opacity: 1, y: 0, duration: 0.5 }, 0.85);

    // Mirror the timeline progress out to the WebGL scene.
    timeline.eventCallback('onUpdate', () => setHeroProgress(timeline.progress()));
  }, []);

  return (
    <ScrollScene
      id="hero"
      pinDuration={170}
      pinDurationMobile={130}
      scrub={0.2}
      buildTimeline={buildTimeline}
      className="lv3-bg-cream"
    >
      {/* WebGL canvas (or poster fallback) — full-bleed. */}
      <HeroCanvas />

      {/* Foreground type — sits above the canvas. */}
      <div className="relative z-10 flex h-full w-full flex-col">
        <div className="mx-auto flex w-full max-w-[1480px] flex-1 flex-col justify-end px-5 pb-12 pt-32 md:px-9 md:pb-20 md:pt-36">
          <p
            data-hero-eyebrow
            className="editorial-eyebrow text-black/55"
          >
            El estudio creativo para e-commerce
          </p>

          <div className="mt-6 grid items-end gap-2 md:mt-10 md:grid-cols-2 md:gap-12">
            <h1 data-hero-headline className="editorial-h1">
              Riverz
            </h1>
            <h1 data-hero-headline className="editorial-h1 text-black/85">
              Estudio Creativo IA
            </h1>
          </div>

          <p
            data-hero-sub
            className="mt-8 max-w-[640px] text-[15px] leading-relaxed text-black/65 md:mt-10 md:text-[17px]"
          >
            Investigación profunda, anuncios estáticos, UGC con avatares y foto de
            producto — orquestado por agentes, controlado por vos. Una plataforma para
            todo el ciclo creativo de tu marca.
          </p>

          <div
            data-hero-ctas
            className="mt-9 flex flex-wrap items-center gap-3"
          >
            <Link
              href="/sign-up"
              className="lv2-yellow editorial-eyebrow inline-flex items-center gap-2 rounded-md px-5 py-3 text-[12px] font-bold transition hover:scale-[1.02]"
            >
              Únete a la lista de espera →
            </Link>
            <a
              href="#why"
              className="editorial-eyebrow inline-flex items-center gap-2 rounded-md border border-black/15 bg-white/40 px-5 py-3 text-black/70 backdrop-blur-sm transition hover:border-black/30 hover:text-black"
            >
              Por qué Riverz
            </a>
          </div>
        </div>
      </div>
    </ScrollScene>
  );
}
