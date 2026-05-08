'use client';

import { useCallback } from 'react';
import { ScrollScene } from '../shared/ScrollScene';
import { SectionEyebrow } from '../shared/SectionEyebrow';
import type { SceneBuilder } from '../shared/useGsapScene';

const models = [
  'Nano Banana Pro',
  'Sora',
  'Veo 3',
  'Flux',
  'Kling',
  'ElevenLabs',
  'GPT-4o',
  'Gemini',
  'Recraft',
  'Hailuo',
  'Luma',
  'Stable Diffusion',
];

export function ThesisSection() {
  const buildTimeline: SceneBuilder = useCallback(({ timeline, select }) => {
    const eyebrow = select('[data-t-eyebrow]')[0];
    const headline = select('[data-t-headline]')[0];
    const items = select('[data-t-item]');

    if (eyebrow) timeline.set(eyebrow, { opacity: 0, y: 20 });
    if (headline) timeline.set(headline, { opacity: 0, y: 30 });
    timeline.set(items, { color: 'rgba(255,255,255,0.18)' });

    if (eyebrow) timeline.to(eyebrow, { opacity: 1, y: 0, duration: 0.4 }, 0);
    if (headline) timeline.to(headline, { opacity: 1, y: 0, duration: 0.5 }, 0.05);

    // Highlight each model in sequence as the user scrolls.
    items.forEach((el, i) => {
      const t = 0.15 + (i / Math.max(1, items.length)) * 0.8;
      timeline.to(el, { color: '#f7ff9e', duration: 0.05 }, t);
      timeline.to(el, { color: 'rgba(255,255,255,0.55)', duration: 0.1 }, t + 0.05);
    });
  }, []);

  return (
    <ScrollScene
      id="modelos"
      pinDuration={200}
      pinDurationMobile={140}
      scrub={0.2}
      buildTimeline={buildTimeline}
      className="lv3-bg-dark"
    >
      <div className="relative h-full w-full text-white">
        <div className="mx-auto max-w-[1480px] px-5 pt-16 md:px-9 md:pt-24">
          <div data-t-eyebrow>
            <SectionEyebrow index="00" label="Tesis" tone="dark" />
          </div>
          <h2
            data-t-headline
            className="editorial-h1 mt-5 max-w-[1100px] text-white"
          >
            Una plataforma. Todos los modelos.
          </h2>
        </div>

        <div className="mx-auto mt-8 grid max-w-[1480px] grid-cols-1 gap-10 px-5 md:grid-cols-[1fr_1fr] md:gap-16 md:px-9">
          <div className="hidden md:block" />
          <ul className="space-y-2 text-[clamp(22px,3.5vw,42px)] font-medium leading-tight tracking-tight md:space-y-3">
            {models.map((m) => (
              <li key={m} data-t-item>
                {m}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </ScrollScene>
  );
}
