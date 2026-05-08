'use client';

import { useCallback } from 'react';
import { ScrollScene } from '../shared/ScrollScene';
import { SectionEyebrow } from '../shared/SectionEyebrow';
import type { SceneBuilder } from '../shared/useGsapScene';

const knowledgeCards: { title: string; chip: string; sample: string }[] = [
  { title: 'Voz de marca', chip: 'Tono', sample: 'Cercana, técnica, sin jerga.' },
  { title: 'Audiencia', chip: 'Segmentos', sample: 'Mujer 28–42, busca rendimiento sin químicos.' },
  { title: 'Paleta', chip: 'Sistema', sample: '#0E342E · #F4E9D8 · #E26A4A · neutros' },
  { title: 'Posicionamiento', chip: 'Eje', sample: '"Skincare clínico que se siente artesanal."' },
  { title: 'Competencia', chip: 'Mapa', sample: '6 players · gaps en educación + UGC' },
  { title: 'Argumentos', chip: 'Ángulos', sample: '12 hooks priorizados · 3 ganadores' },
];

export function ResearchSection() {
  const buildTimeline: SceneBuilder = useCallback(({ timeline, select }) => {
    const eyebrow = select('[data-r-eyebrow]')[0];
    const headline = select('[data-r-headline]')[0];
    const browser = select('[data-r-browser]')[0];
    const url = select('[data-r-url]')[0];
    const cards = select('[data-r-card]');
    const summary = select('[data-r-summary]')[0];

    if (eyebrow) timeline.set(eyebrow, { opacity: 0, y: 20 });
    if (headline) timeline.set(headline, { opacity: 0, y: 30 });
    if (browser) timeline.set(browser, { opacity: 0, scale: 0.95, y: 40 });
    if (url) timeline.set(url, { width: 0 });
    timeline.set(cards, { opacity: 0, y: 60, scale: 0.92 });
    if (summary) timeline.set(summary, { opacity: 0 });

    if (eyebrow) timeline.to(eyebrow, { opacity: 1, y: 0, duration: 0.4 }, 0);
    if (headline) timeline.to(headline, { opacity: 1, y: 0, duration: 0.5 }, 0.05);
    if (browser) timeline.to(browser, { opacity: 1, scale: 1, y: 0, duration: 0.5 }, 0.1);
    if (url) timeline.to(url, { width: '100%', duration: 0.6 }, 0.2);

    if (browser) {
      timeline.to(
        browser,
        { x: -240, opacity: 0.55, scale: 0.85, duration: 0.6 },
        0.45
      );
    }

    timeline.to(
      cards,
      { opacity: 1, y: 0, scale: 1, duration: 0.5, stagger: 0.08 },
      0.55
    );
    if (summary) timeline.to(summary, { opacity: 1, duration: 0.4 }, 0.95);
  }, []);

  return (
    <ScrollScene
      id="research"
      pinDuration={180}
      pinDurationMobile={140}
      scrub={0.5}
      buildTimeline={buildTimeline}
      className="lv3-bg-cream"
    >
      <div className="relative h-full w-full">
        <div className="mx-auto max-w-[1480px] px-5 pt-14 md:px-9 md:pt-20">
          <div data-r-eyebrow>
            <SectionEyebrow index="01" label="Research" />
          </div>
          <h2 data-r-headline className="editorial-h2 mt-5 max-w-[840px]">
            De una URL a un brief de marca.
          </h2>
          <p className="mt-5 max-w-[560px] text-[14px] leading-relaxed text-black/65 md:text-[15px]">
            Pegás la URL de tu tienda. Riverz lee, escucha y devuelve el ADN: voz,
            audiencias, paleta, posicionamiento y los ángulos creativos que ganan en tu
            categoría — listos para alimentar al resto del estudio.
          </p>
        </div>

        {/* Stage with browser → cards transformation */}
        <div className="mx-auto mt-8 max-w-[1480px] px-5 md:mt-12 md:px-9">
          <div className="relative h-[440px] md:h-[520px]">
            {/* The browser that scrolls in, types URL, then exits left */}
            <div
              data-r-browser
              className="lv3-browser absolute left-1/2 top-1/2 w-[min(560px,90%)] -translate-x-1/2 -translate-y-1/2"
            >
              <div className="lv3-browser-bar">
                <span className="lv3-browser-dot" />
                <span className="lv3-browser-dot" />
                <span className="lv3-browser-dot" />
                <span className="lv3-browser-url overflow-hidden">
                  <span data-r-url className="inline-block whitespace-nowrap">
                    https://lamarca.com — analizando voz, paleta y posicionamiento…
                  </span>
                </span>
              </div>
              <div className="grid h-[200px] place-items-center bg-gradient-to-b from-[#fafaf7] to-[#f0ede4] md:h-[260px]">
                <div className="flex items-center gap-3 text-[12px] uppercase tracking-[0.18em] text-black/40">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-[#14e0cc]" />
                  Crawling
                </div>
              </div>
            </div>

            {/* The research output cards */}
            <div className="absolute inset-0 grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-5">
              {knowledgeCards.map((c) => (
                <div
                  key={c.title}
                  data-r-card
                  className="lv3-frame flex flex-col justify-between bg-white p-4 md:p-5"
                >
                  <div>
                    <div className="lv3-pill">{c.chip}</div>
                    <div className="mt-3 text-[15px] font-semibold tracking-tight text-black md:text-[16px]">
                      {c.title}
                    </div>
                  </div>
                  <p className="mt-3 text-[12px] leading-snug text-black/55 md:text-[13px]">
                    {c.sample}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Summary tagline */}
          <div data-r-summary className="mt-10 flex flex-wrap items-center gap-3">
            <span className="lv3-pill bg-[#0a0a0a] text-[#f7ff9e]">
              Listo en 90 segundos
            </span>
            <span className="lv3-pill">Alimenta a todo el estudio</span>
            <span className="lv3-pill">Editable por vos</span>
          </div>
        </div>
      </div>
    </ScrollScene>
  );
}
