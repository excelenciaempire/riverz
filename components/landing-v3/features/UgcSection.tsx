'use client';

import { useCallback } from 'react';
import { ScrollScene } from '../shared/ScrollScene';
import { SectionEyebrow } from '../shared/SectionEyebrow';
import type { SceneBuilder } from '../shared/useGsapScene';

const phones = [
  { lang: 'ES', accent: '#f7ff9e', avatarHue: '#f0c9a4' },
  { lang: 'EN', accent: '#14e0cc', avatarHue: '#e2b58f' },
  { lang: 'PT', accent: '#ff9e7a', avatarHue: '#d8a380' },
];

const flags = ['ES', 'EN', 'FR', 'PT', 'DE', 'IT'];

export function UgcSection() {
  const buildTimeline: SceneBuilder = useCallback((_ctx, { timeline, select }) => {
    const eyebrow = select('[data-u-eyebrow]')[0];
    const headline = select('[data-u-headline]')[0];
    const phoneEls = select('[data-u-phone]');
    const flagEls = select('[data-u-flag]');
    const note = select('[data-u-note]')[0];

    if (eyebrow) timeline.set(eyebrow, { opacity: 0, y: 20 });
    if (headline) timeline.set(headline, { opacity: 0, y: 30 });
    timeline.set(phoneEls, { opacity: 0, y: 80, rotateY: -28 });
    timeline.set(flagEls, { opacity: 0, y: 30 });
    if (note) timeline.set(note, { opacity: 0, y: 20 });

    if (eyebrow) timeline.to(eyebrow, { opacity: 1, y: 0, duration: 0.4 }, 0);
    if (headline) timeline.to(headline, { opacity: 1, y: 0, duration: 0.5 }, 0.05);

    timeline.to(
      phoneEls,
      { opacity: 1, y: 0, duration: 0.6, stagger: 0.12 },
      0.18
    );
    // Phones rotate to camera.
    timeline.to(
      phoneEls,
      { rotateY: 0, duration: 0.5, stagger: 0.08 },
      0.55
    );

    timeline.to(
      flagEls,
      { opacity: 1, y: 0, duration: 0.4, stagger: 0.07 },
      0.78
    );
    if (note) timeline.to(note, { opacity: 1, y: 0, duration: 0.4 }, 0.92);
  }, []);

  return (
    <ScrollScene
      id="ugc"
      pinDuration={200}
      pinDurationMobile={150}
      scrub={0.7}
      buildTimeline={buildTimeline}
      className="lv3-bg-cream"
    >
      <div className="relative h-full w-full">
        <div className="mx-auto max-w-[1480px] px-5 pt-14 md:px-9 md:pt-20">
          <div data-u-eyebrow>
            <SectionEyebrow index="03" label="UGC con avatares" />
          </div>
          <h2 data-u-headline className="editorial-h2 mt-5 max-w-[900px]">
            Tu producto, presentado por avatares hiperrealistas en cualquier idioma.
          </h2>
        </div>

        <div className="mx-auto mt-10 flex max-w-[1480px] flex-col items-center px-5 md:px-9">
          <div className="lv3-phone-stage flex items-end justify-center gap-6 md:gap-10">
            {phones.map((p) => (
              <div
                key={p.lang}
                data-u-phone
                className="lv3-phone shrink-0"
                style={{ transformOrigin: 'center bottom' }}
              >
                <div className="lv3-phone-screen relative">
                  {/* Avatar silhouette */}
                  <div
                    className="absolute inset-0"
                    style={{
                      background: `radial-gradient(50% 35% at 50% 38%, ${p.avatarHue}, #2a2a32 60%, #15151b 100%)`,
                    }}
                  />
                  {/* Subtitle bar */}
                  <div className="absolute inset-x-3 bottom-3 flex items-center gap-2 rounded-md bg-black/60 px-2 py-1.5 text-[10px] text-white">
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: p.accent }}
                    />
                    <span className="font-medium">"…cambió mi rutina."</span>
                  </div>
                  {/* Lang badge */}
                  <div
                    className="absolute right-2 top-2 rounded-md px-1.5 py-0.5 text-[10px] font-bold text-black"
                    style={{ background: p.accent }}
                  >
                    {p.lang}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Language flags */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-2.5">
            {flags.map((f) => (
              <span
                key={f}
                data-u-flag
                className="lv3-pill px-3 py-1.5 text-[12px] font-semibold"
              >
                {f}
              </span>
            ))}
          </div>

          <p
            data-u-note
            className="mt-6 max-w-[560px] text-center text-[14px] leading-relaxed text-black/65 md:text-[15px]"
          >
            Un solo brief, todos los mercados. Avatares, voz clonada, lipsync exacto y
            export multiformato — Sora, Veo 3, ElevenLabs orquestados por Riverz.
          </p>
        </div>
      </div>
    </ScrollScene>
  );
}
