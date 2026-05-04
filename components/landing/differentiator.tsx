'use client';

import { useEffect, useRef } from 'react';

const providers = [
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

/**
 * "Use all AI models, together at last" — Weave's most editorial moment.
 * Massive list of provider names on the right; each one lights up in
 * yellow as it crosses the viewport. Left column carries the headline,
 * sticky to the top while the user scrolls past the list.
 */
export function Differentiator() {
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const items = list.querySelectorAll('li');
    if (!('IntersectionObserver' in window)) {
      items.forEach((el) => el.classList.add('is-on'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add('is-on');
          else e.target.classList.remove('is-on');
        });
      },
      { threshold: 0.6, rootMargin: '-25% 0px -25% 0px' },
    );
    items.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <section id="modelos" className="lv2-section-dark relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            'radial-gradient(60% 50% at 70% 50%, rgba(247,255,158,0.06), transparent 60%), radial-gradient(50% 50% at 20% 80%, rgba(255,255,255,0.03), transparent 60%)',
        }}
      />
      <div className="relative mx-auto grid max-w-[1480px] gap-10 px-5 py-24 md:grid-cols-2 md:px-9 md:py-36">
        <div className="md:sticky md:top-32 md:self-start">
          <p className="editorial-eyebrow lv2-rv text-white/45">01 · Modelos</p>
          <h2 className="editorial-h2 lv2-rv mt-5">
            Una plataforma.
            <br />
            Todos los modelos.
          </h2>
          <p className="lv2-rv mt-7 max-w-[420px] text-[15px] leading-relaxed text-white/55">
            Imagen, video, voz y edición — los mejores modelos del mundo, integrados sin
            fricción. Probás, comparás, elegís el que mejor le queda a tu marca, sin pagar 12
            suscripciones.
          </p>
        </div>

        <ul
          ref={listRef}
          className="lv2-word-list editorial-h2 flex flex-col gap-1 self-center"
          style={{ lineHeight: 0.95 }}
        >
          {providers.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
