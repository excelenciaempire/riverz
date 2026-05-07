'use client';

import { useCallback } from 'react';
import { ScrollScene } from '../shared/ScrollScene';
import { SectionEyebrow } from '../shared/SectionEyebrow';
import type { SceneBuilder } from '../shared/useGsapScene';

const audiences = [
  { name: 'Clientes recurrentes', size: '12.4K', score: 92 },
  { name: 'Lookalike compra', size: '480K', score: 86 },
  { name: 'Engagement Reels 30d', size: '78K', score: 71 },
  { name: 'Carrito abandonado', size: '3.2K', score: 95 },
];

const adsetRows = [
  { name: 'OTOÑO · Hooks · A', spend: '$2.840', roas: '3.8' },
  { name: 'OTOÑO · UGC · ES', spend: '$1.920', roas: '4.2' },
  { name: 'OTOÑO · Static · 3-up', spend: '$3.100', roas: '2.9' },
];

export function MetaAdsSection() {
  const buildTimeline: SceneBuilder = useCallback((_ctx, { timeline, select }) => {
    const eyebrow = select('[data-m-eyebrow]')[0];
    const headline = select('[data-m-headline]')[0];
    const assets = select('[data-m-asset]');
    const arrow = select('[data-m-arrow]')[0];
    const manager = select('[data-m-manager]')[0];
    const audienceRows = select('[data-m-audience]');
    const adsetRowEls = select('[data-m-adset]');
    const live = select('[data-m-live]')[0];

    if (eyebrow) timeline.set(eyebrow, { opacity: 0, y: 20 });
    if (headline) timeline.set(headline, { opacity: 0, y: 30 });
    timeline.set(assets, { opacity: 0, x: -50, scale: 0.85 });
    if (arrow) timeline.set(arrow, { opacity: 0, scaleX: 0 });
    if (manager) timeline.set(manager, { opacity: 0, x: 60 });
    timeline.set(audienceRows, { opacity: 0, y: 20 });
    timeline.set(adsetRowEls, { opacity: 0, y: 20 });
    if (live) timeline.set(live, { opacity: 0, scale: 0.6 });

    if (eyebrow) timeline.to(eyebrow, { opacity: 1, y: 0, duration: 0.4 }, 0);
    if (headline) timeline.to(headline, { opacity: 1, y: 0, duration: 0.5 }, 0.05);
    timeline.to(
      assets,
      { opacity: 1, x: 0, scale: 1, duration: 0.5, stagger: 0.1 },
      0.18
    );
    if (arrow) timeline.to(arrow, { opacity: 1, scaleX: 1, duration: 0.4 }, 0.45);
    if (manager) timeline.to(manager, { opacity: 1, x: 0, duration: 0.5 }, 0.55);
    timeline.to(
      audienceRows,
      { opacity: 1, y: 0, duration: 0.4, stagger: 0.08 },
      0.7
    );
    timeline.to(
      adsetRowEls,
      { opacity: 1, y: 0, duration: 0.4, stagger: 0.08 },
      0.85
    );
    if (live) timeline.to(live, { opacity: 1, scale: 1, duration: 0.4 }, 0.95);
  }, []);

  return (
    <ScrollScene
      id="meta-ads"
      pinDuration={210}
      pinDurationMobile={150}
      scrub={0.7}
      buildTimeline={buildTimeline}
      className="lv3-bg-ink"
    >
      <div className="relative h-full w-full text-white">
        <div className="mx-auto max-w-[1480px] px-5 pt-14 md:px-9 md:pt-20">
          <div data-m-eyebrow>
            <SectionEyebrow index="05" label="Meta Ads" tone="dark" />
          </div>
          <h2
            data-m-headline
            className="editorial-h2 mt-5 max-w-[940px] text-white"
          >
            Del asset al lanzamiento, sin salir de Riverz.
          </h2>
        </div>

        <div className="mx-auto mt-10 grid max-w-[1480px] grid-cols-1 items-center gap-10 px-5 md:grid-cols-[260px_50px_1fr] md:px-9">
          {/* Left: creative assets stack */}
          <div className="space-y-3">
            {[
              { tag: 'STATIC', tone: 'from-[#f7ff9e] to-[#dfe27a]' },
              { tag: 'UGC', tone: 'from-[#14e0cc] to-[#0a8d83]' },
              { tag: 'CAROUSEL', tone: 'from-[#ff9e7a] to-[#c9624a]' },
            ].map((a, i) => (
              <div
                key={a.tag}
                data-m-asset
                className="flex aspect-[4/3] items-end overflow-hidden rounded-lg ring-1 ring-white/10"
                style={{ marginLeft: `${i * 16}px` }}
              >
                <div
                  className={`h-full w-full bg-gradient-to-br ${a.tone} p-3`}
                >
                  <div className="editorial-eyebrow text-black/70">{a.tag}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Arrow connector */}
          <div className="flex items-center justify-center">
            <div
              data-m-arrow
              className="h-px w-full origin-left bg-gradient-to-r from-transparent via-white/40 to-white/80"
            >
              <div className="relative -mt-[5px] ml-[calc(100%-10px)] h-2.5 w-2.5 rotate-45 border-r border-t border-white/80" />
            </div>
          </div>

          {/* Right: Meta Ads Manager mockup */}
          <div
            data-m-manager
            className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]"
          >
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div className="flex items-center gap-2.5">
                <span className="grid h-6 w-6 place-items-center rounded-md bg-[#1877F2] text-[10px] font-bold text-white">
                  M
                </span>
                <span className="text-[13px] font-semibold tracking-tight text-white">
                  Meta Ads · Campaign Manager
                </span>
              </div>
              <span
                data-m-live
                className="flex items-center gap-1.5 rounded-full bg-[#14e0cc]/15 px-2 py-0.5 text-[10px] font-semibold text-[#14e0cc]"
              >
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#14e0cc]" />
                Live · 3 adsets
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 md:p-5">
              <div>
                <div className="editorial-eyebrow text-white/45">DNA · Audiencias</div>
                <ul className="mt-3 space-y-2">
                  {audiences.map((a) => (
                    <li
                      key={a.name}
                      data-m-audience
                      className="flex items-center justify-between rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-[12px]"
                    >
                      <span className="text-white/80">{a.name}</span>
                      <span className="flex items-center gap-3 text-white/60">
                        <span>{a.size}</span>
                        <span className="rounded bg-[#f7ff9e] px-1.5 py-0.5 text-[10px] font-bold text-black">
                          {a.score}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="editorial-eyebrow text-white/45">Adsets activos</div>
                <ul className="mt-3 space-y-2">
                  {adsetRows.map((a) => (
                    <li
                      key={a.name}
                      data-m-adset
                      className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-[12px]"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-white/80">{a.name}</span>
                        <span className="text-[10px] text-white/45">ROAS {a.roas}×</span>
                      </div>
                      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/5">
                        <div
                          className="h-full bg-[#14e0cc]"
                          style={{ width: `${Math.min(95, parseFloat(a.roas) * 22)}%` }}
                        />
                      </div>
                      <div className="mt-1 text-[10px] text-white/50">
                        Spend {a.spend}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto mt-10 max-w-[1480px] px-5 md:px-9">
          <div className="flex flex-wrap items-center gap-3">
            <span className="lv3-pill lv3-pill-dark">Lanzamiento directo a Meta</span>
            <span className="lv3-pill lv3-pill-dark">DNA de audiencias propio</span>
            <span className="lv3-pill lv3-pill-dark">Comentarios + creatividades en un panel</span>
          </div>
        </div>
      </div>
    </ScrollScene>
  );
}
