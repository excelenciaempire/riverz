'use client';

import { useCallback } from 'react';
import { ScrollScene } from '../shared/ScrollScene';
import { SectionEyebrow } from '../shared/SectionEyebrow';
import type { SceneBuilder } from '../shared/useGsapScene';

const pains = [
  {
    title: 'Cuatro herramientas distintas para una sola campaña.',
    detail: 'Foto en Photoshop, ad en Canva, video en CapCut, copy en ChatGPT.',
  },
  {
    title: 'Agencias caras y lentas.',
    detail: 'Brief el lunes, primera versión en dos semanas, A/B en un mes.',
  },
  {
    title: 'Branding inconsistente.',
    detail: 'Cada freelancer interpreta tu marca distinto. La voz se diluye.',
  },
  {
    title: 'Tiempo perdido entre archivos y exports.',
    detail: 'Más horas operando software que pensando creatividad.',
  },
];

const stats = [
  { value: '4×', label: 'herramientas reemplazadas' },
  { value: '12', label: 'modelos en una sola plataforma' },
  { value: '30→3', label: 'días para llevar idea al feed' },
  { value: '0', label: 'archivos sueltos: todo orquestado' },
];

export function WhySection() {
  const buildTimeline: SceneBuilder = useCallback(({ timeline, select }) => {
    const eyebrow = select('[data-why-eyebrow]')[0];
    const headline = select('[data-why-headline]')[0];
    const painCards = select('[data-why-pain]');
    const statRows = select('[data-why-stat]');
    const collapse = select('[data-why-collapse]')[0];

    if (eyebrow) timeline.set(eyebrow, { opacity: 0, y: 20 });
    if (headline) timeline.set(headline, { opacity: 0, y: 40 });
    timeline.set(painCards, { opacity: 0, x: -30 });
    timeline.set(statRows, { opacity: 0, y: 30 });
    if (collapse) timeline.set(collapse, { opacity: 0, scale: 0.8 });

    if (eyebrow) timeline.to(eyebrow, { opacity: 1, y: 0, duration: 0.4 }, 0);
    if (headline) timeline.to(headline, { opacity: 1, y: 0, duration: 0.6 }, 0.05);

    timeline.to(
      painCards,
      { opacity: 1, x: 0, duration: 0.5, stagger: 0.18 },
      0.15
    );
    timeline.to(
      statRows,
      { opacity: 1, y: 0, duration: 0.5, stagger: 0.15 },
      0.3
    );

    // Final beat — pains and stats fade to make room for the collapse.
    timeline.to(
      [...painCards, ...statRows],
      { opacity: 0.25, duration: 0.4 },
      0.85
    );
    if (collapse) {
      timeline.to(collapse, { opacity: 1, scale: 1, duration: 0.5 }, 0.9);
    }
  }, []);

  return (
    <ScrollScene
      id="why"
      pinDuration={220}
      pinDurationMobile={150}
      scrub={0.7}
      buildTimeline={buildTimeline}
      className="lv3-bg-cream2"
    >
      <div className="relative h-full w-full">
        {/* Header band */}
        <div className="mx-auto max-w-[1480px] px-5 pt-12 md:px-9 md:pt-20">
          <div data-why-eyebrow>
            <SectionEyebrow index="00" label="Por qué Riverz" />
          </div>
          <h2
            data-why-headline
            className="editorial-h2 mt-5 max-w-[900px]"
          >
            Tu marca se mueve a la velocidad de tu peor herramienta.
          </h2>
        </div>

        {/* Two-column body */}
        <div className="mx-auto mt-10 grid max-w-[1480px] grid-cols-1 gap-10 px-5 md:mt-14 md:grid-cols-2 md:gap-16 md:px-9">
          <div className="space-y-6 md:space-y-7">
            {pains.map((p, i) => (
              <div
                key={p.title}
                data-why-pain
                className="border-l-2 border-black/15 pl-5"
              >
                <div className="editorial-eyebrow text-black/40">
                  Dolor 0{i + 1}
                </div>
                <p className="mt-2 text-[19px] font-medium leading-snug text-black md:text-[22px]">
                  {p.title}
                </p>
                <p className="mt-2 text-[13px] leading-relaxed text-black/55 md:text-[14px]">
                  {p.detail}
                </p>
              </div>
            ))}
          </div>

          <div className="space-y-5 md:space-y-7">
            {stats.map((s) => (
              <div
                key={s.label}
                data-why-stat
                className="flex items-baseline gap-5 border-b border-black/10 pb-5"
              >
                <div className="editorial-h2 text-[clamp(48px,7vw,84px)] leading-none text-black">
                  {s.value}
                </div>
                <div className="text-[13px] leading-snug text-black/60 md:text-[14px]">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Final collapse — Riverz takes the stage */}
        <div
          data-why-collapse
          className="pointer-events-none absolute inset-0 grid place-items-center"
        >
          <div className="text-center">
            <div className="editorial-eyebrow text-black/45">Una plataforma</div>
            <div className="editorial-h1 mt-3 inline-block bg-[#f7ff9e] px-5 py-1 leading-[0.9] text-black">
              Riverz
            </div>
          </div>
        </div>
      </div>
    </ScrollScene>
  );
}
