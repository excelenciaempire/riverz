'use client';

import { useCallback } from 'react';
import { ScrollScene } from '../shared/ScrollScene';
import { SectionEyebrow } from '../shared/SectionEyebrow';
import type { SceneBuilder } from '../shared/useGsapScene';

const blocks = [
  { kind: 'hero', label: 'Hero · Producto' },
  { kind: 'features', label: 'Beneficios · 3-up' },
  { kind: 'testimonial', label: 'Testimonio · Press' },
  { kind: 'cta', label: 'CTA · Compra' },
];

export function LandingLabSection() {
  const buildTimeline: SceneBuilder = useCallback(({ timeline, select }) => {
    const eyebrow = select('[data-l-eyebrow]')[0];
    const headline = select('[data-l-headline]')[0];
    const browser = select('[data-l-browser]')[0];
    const url = select('[data-l-url]')[0];
    const blockEls = select('[data-l-block]');
    const badge = select('[data-l-badge]')[0];

    if (eyebrow) timeline.set(eyebrow, { opacity: 0, y: 20 });
    if (headline) timeline.set(headline, { opacity: 0, y: 30 });
    if (browser) timeline.set(browser, { opacity: 0, scale: 0.92, rotateX: 18 });
    if (url) timeline.set(url, { width: 0 });
    timeline.set(blockEls, { opacity: 0, y: -40, scale: 0.9 });
    if (badge) timeline.set(badge, { opacity: 0, scale: 0.7 });

    if (eyebrow) timeline.to(eyebrow, { opacity: 1, y: 0, duration: 0.4 }, 0);
    if (headline) timeline.to(headline, { opacity: 1, y: 0, duration: 0.5 }, 0.05);
    if (browser) timeline.to(browser, { opacity: 1, scale: 1, rotateX: 0, duration: 0.5 }, 0.12);
    if (url) timeline.to(url, { width: '100%', duration: 0.5 }, 0.22);

    timeline.to(
      blockEls,
      { opacity: 1, y: 0, scale: 1, duration: 0.5, stagger: 0.18 },
      0.4
    );
    if (browser) {
      timeline.to(browser, { scale: 0.78, duration: 0.5 }, 0.92);
    }
    if (badge) timeline.to(badge, { opacity: 1, scale: 1, duration: 0.4 }, 0.95);
  }, []);

  return (
    <ScrollScene
      id="landing-lab"
      pinDuration={220}
      pinDurationMobile={160}
      scrub={0.7}
      buildTimeline={buildTimeline}
      className="lv3-bg-cream2"
    >
      <div className="relative h-full w-full">
        <div className="mx-auto max-w-[1480px] px-5 pt-14 md:px-9 md:pt-20">
          <div data-l-eyebrow>
            <SectionEyebrow index="04" label="Landing Lab" />
          </div>
          <h2 data-l-headline className="editorial-h2 mt-5 max-w-[900px]">
            Páginas que se publican solas en Shopify.
          </h2>
        </div>

        <div className="mx-auto mt-8 max-w-[1480px] px-5 md:mt-12 md:px-9">
          <div className="relative mx-auto h-[420px] w-[min(960px,100%)] md:h-[520px]">
            {/* Browser frame with blocks dropping into it */}
            <div
              data-l-browser
              className="lv3-browser absolute inset-0"
              style={{ transformPerspective: 1400, transformOrigin: 'center top' }}
            >
              <div className="lv3-browser-bar">
                <span className="lv3-browser-dot" />
                <span className="lv3-browser-dot" />
                <span className="lv3-browser-dot" />
                <span className="lv3-browser-url overflow-hidden">
                  <span data-l-url className="inline-block whitespace-nowrap">
                    https://lamarca.myshopify.com/landing/coleccion-otono — publicado
                  </span>
                </span>
                <div
                  data-l-badge
                  className="ml-2 hidden items-center gap-1.5 rounded-full bg-[#95bf47] px-2 py-0.5 text-[10px] font-semibold text-white md:flex"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-white/90" />
                  Shopify · Live
                </div>
              </div>

              <div className="grid h-[calc(100%-40px)] grid-cols-1 gap-3 overflow-hidden bg-[#fafaf7] p-4 md:p-5">
                {blocks.map((b) => (
                  <div
                    key={b.kind}
                    data-l-block
                    className="rounded-md ring-1 ring-black/5"
                    style={{
                      background:
                        b.kind === 'hero'
                          ? 'linear-gradient(135deg, #0e0e13 0%, #2a2a36 100%)'
                          : b.kind === 'features'
                            ? '#f5f3ec'
                            : b.kind === 'testimonial'
                              ? '#ffffff'
                              : 'linear-gradient(90deg, #f7ff9e 0%, #f1fa84 100%)',
                      minHeight: b.kind === 'hero' ? '46%' : '14%',
                      color: b.kind === 'hero' ? '#fafaf7' : '#0a0a0a',
                    }}
                  >
                    <div className="flex h-full items-center justify-between px-4 text-[11px] uppercase tracking-[0.18em] opacity-75 md:px-5 md:text-[12px]">
                      <span>{b.label}</span>
                      {b.kind === 'cta' && (
                        <span className="rounded bg-black/10 px-2 py-1 text-[10px] font-bold">
                          Comprar →
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <p className="mx-auto mt-8 max-w-[560px] text-center text-[14px] leading-relaxed text-black/65 md:text-[15px]">
            Riverz arma la landing con tu marca, redacta el copy con la voz aprendida en
            Research, y la publica directo en Shopify. Editás visualmente cuando quieras.
          </p>
        </div>
      </div>
    </ScrollScene>
  );
}
