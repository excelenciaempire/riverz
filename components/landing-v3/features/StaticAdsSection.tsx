'use client';

import { useCallback } from 'react';
import { ScrollScene } from '../shared/ScrollScene';
import { SectionEyebrow } from '../shared/SectionEyebrow';
import type { SceneBuilder } from '../shared/useGsapScene';

const variantGrid = Array.from({ length: 9 }).map((_, i) => i);

export function StaticAdsSection() {
  const buildTimeline: SceneBuilder = useCallback(({ timeline, select }) => {
    const eyebrow = select('[data-sa-eyebrow]')[0];
    const headline = select('[data-sa-headline]')[0];
    const canvas = select('[data-sa-canvas]')[0];
    const layerBg = select('[data-sa-layer="bg"]')[0];
    const layerProduct = select('[data-sa-layer="product"]')[0];
    const layerHeadline = select('[data-sa-layer="headline"]')[0];
    const layerStamp = select('[data-sa-layer="stamp"]')[0];
    const layerLogo = select('[data-sa-layer="logo"]')[0];
    const variants = select('[data-sa-variant]');
    const layersRail = select('[data-sa-rail]')[0];
    const propsRail = select('[data-sa-props]')[0];

    if (eyebrow) timeline.set(eyebrow, { opacity: 0, y: 20 });
    if (headline) timeline.set(headline, { opacity: 0, y: 30 });
    if (canvas) timeline.set(canvas, { opacity: 0, scale: 0.92, rotateX: 12 });
    if (layerBg) timeline.set(layerBg, { opacity: 0 });
    if (layerProduct) timeline.set(layerProduct, { opacity: 0, y: 80, rotateX: -25 });
    if (layerHeadline) timeline.set(layerHeadline, { opacity: 0, y: 20 });
    if (layerStamp) timeline.set(layerStamp, { opacity: 0, scale: 0.4, rotate: -25 });
    if (layerLogo) timeline.set(layerLogo, { opacity: 0 });
    if (layersRail) timeline.set(layersRail, { opacity: 0, x: -30 });
    if (propsRail) timeline.set(propsRail, { opacity: 0, x: 30 });
    timeline.set(variants, { opacity: 0, scale: 0.6 });

    if (eyebrow) timeline.to(eyebrow, { opacity: 1, y: 0, duration: 0.3 }, 0);
    if (headline) timeline.to(headline, { opacity: 1, y: 0, duration: 0.45 }, 0.04);
    if (canvas) timeline.to(canvas, { opacity: 1, scale: 1, rotateX: 0, duration: 0.5 }, 0.1);
    if (layersRail) timeline.to(layersRail, { opacity: 1, x: 0, duration: 0.4 }, 0.18);
    if (propsRail) timeline.to(propsRail, { opacity: 1, x: 0, duration: 0.4 }, 0.18);

    if (layerBg) timeline.to(layerBg, { opacity: 1, duration: 0.3 }, 0.25);
    if (layerProduct) timeline.to(layerProduct, { opacity: 1, y: 0, rotateX: 0, duration: 0.5 }, 0.32);
    if (layerHeadline) timeline.to(layerHeadline, { opacity: 1, y: 0, duration: 0.4 }, 0.45);
    if (layerStamp) timeline.to(layerStamp, { opacity: 1, scale: 1, rotate: -12, duration: 0.4 }, 0.55);
    if (layerLogo) timeline.to(layerLogo, { opacity: 1, duration: 0.3 }, 0.65);

    // Canvas shrinks back to make room for the variant grid.
    if (canvas) {
      timeline.to(
        canvas,
        { scale: 0.32, x: '-32%', y: '-12%', duration: 0.6 },
        0.78
      );
    }
    timeline.to(
      variants,
      { opacity: 1, scale: 1, duration: 0.5, stagger: 0.05 },
      0.85
    );
  }, []);

  return (
    <ScrollScene
      id="static-ads"
      pinDuration={260}
      pinDurationMobile={180}
      scrub={0.25}
      buildTimeline={buildTimeline}
      className="lv3-bg-dark"
    >
      <div className="relative h-full w-full text-white">
        <div className="mx-auto max-w-[1480px] px-5 pt-14 md:px-9 md:pt-20">
          <div data-sa-eyebrow>
            <SectionEyebrow index="02" label="Static Ads" tone="dark" />
          </div>
          <h2
            data-sa-headline
            className="editorial-h2 mt-5 max-w-[900px] text-white"
          >
            Un brief, decenas de variantes listas para Meta y TikTok.
          </h2>
        </div>

        <div className="absolute inset-x-0 bottom-0 top-[180px] md:top-[240px]">
          <div className="relative mx-auto h-full max-w-[1480px] px-5 md:px-9">
            {/* Editor mockup: layers rail · canvas · properties rail */}
            <div className="absolute left-1/2 top-1/2 grid w-[min(1100px,95%)] -translate-x-1/2 -translate-y-1/2 grid-cols-[140px_1fr_140px] gap-4 md:gap-5">
              {/* Layers rail */}
              <div
                data-sa-rail
                className="hidden rounded-xl border border-white/10 bg-white/[0.04] p-3 md:block"
              >
                <div className="editorial-eyebrow text-white/45">Layers</div>
                <ul className="mt-3 space-y-2 text-[11px] text-white/70">
                  {['Logo', 'Sello -30%', 'Headline', 'Producto', 'Fondo'].map((l) => (
                    <li
                      key={l}
                      className="flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-2 py-1.5"
                    >
                      <span className="h-2 w-2 rounded-sm bg-[#f7ff9e]" />
                      {l}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Canvas with layer build-up */}
              <div
                data-sa-canvas
                className="relative mx-auto aspect-[4/5] w-full max-w-[460px] overflow-hidden rounded-xl bg-[#1a1a22] ring-1 ring-white/10"
                style={{ transformPerspective: 1000 }}
              >
                <div
                  data-sa-layer="bg"
                  className="absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_40%,#3a3a46,#0e0e13)]"
                />
                <div
                  data-sa-layer="product"
                  className="absolute inset-x-1/4 bottom-[18%] top-[22%] rounded-lg bg-gradient-to-br from-[#f7ff9e] via-[#dfe27a] to-[#0a0a0a]/40 ring-1 ring-white/15"
                />
                <div
                  data-sa-layer="headline"
                  className="absolute left-5 top-5 max-w-[70%] text-[clamp(18px,2.4vw,30px)] font-semibold leading-tight text-white"
                >
                  Tu marca, lista para conquistar el feed.
                </div>
                <div
                  data-sa-layer="stamp"
                  className="absolute right-4 top-4 grid h-16 w-16 place-items-center rounded-full bg-[#f7ff9e] text-center text-[11px] font-bold leading-tight text-black"
                >
                  -30%<br />OFF
                </div>
                <div
                  data-sa-layer="logo"
                  className="absolute bottom-3 left-3 flex items-center gap-2"
                >
                  <span className="grid h-6 w-6 place-items-center rounded-md bg-[#fafaf7] text-[10px] font-bold text-black">
                    R
                  </span>
                  <span className="text-[11px] uppercase tracking-[0.18em] text-white/85">
                    lamarca
                  </span>
                </div>
              </div>

              {/* Properties rail */}
              <div
                data-sa-props
                className="hidden rounded-xl border border-white/10 bg-white/[0.04] p-3 md:block"
              >
                <div className="editorial-eyebrow text-white/45">Properties</div>
                <ul className="mt-3 space-y-3 text-[11px] text-white/70">
                  <li>
                    <div className="text-white/45">Tono</div>
                    <div>Cercano · directo</div>
                  </li>
                  <li>
                    <div className="text-white/45">Paleta</div>
                    <div className="mt-1 flex gap-1.5">
                      <span className="h-3 w-3 rounded bg-[#f7ff9e]" />
                      <span className="h-3 w-3 rounded bg-[#14e0cc]" />
                      <span className="h-3 w-3 rounded bg-[#0e0e13]" />
                    </div>
                  </li>
                  <li>
                    <div className="text-white/45">Modelo</div>
                    <div>Nano Banana Pro</div>
                  </li>
                </ul>
              </div>
            </div>

            {/* 9-up variant grid revealed at the end */}
            <div className="absolute inset-y-0 right-0 hidden w-[58%] items-center md:flex">
              <div className="grid w-full grid-cols-3 gap-3">
                {variantGrid.map((i) => (
                  <div
                    key={i}
                    data-sa-variant
                    className="aspect-[4/5] rounded-lg ring-1 ring-white/10"
                    style={{
                      background:
                        i % 3 === 0
                          ? 'radial-gradient(60% 50% at 50% 40%, #14e0cc40, #0e0e13)'
                          : i % 3 === 1
                            ? 'radial-gradient(60% 50% at 50% 40%, #f7ff9e35, #0e0e13)'
                            : 'radial-gradient(60% 50% at 50% 40%, #ffffff20, #0e0e13)',
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </ScrollScene>
  );
}
