'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Brain, Wand2, Sparkles, Image as ImageIcon, Film, Mic, Layers, BarChart3 } from 'lucide-react';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

const SpecialistsScene = dynamic(() => import('./specialists-scene').then((m) => m.SpecialistsScene), {
  ssr: false,
  loading: () => null,
});

const specialists = [
  { icon: Brain,      name: 'Investigador',     role: 'Conoce tu audiencia',  hue: '#14E0CC',
    desc: 'Estudia a tu cliente ideal, a la competencia y lo que está funcionando ahora en tu nicho.' },
  { icon: Wand2,      name: 'Estratega',        role: 'Diseña la campaña',    hue: '#22D3EE',
    desc: 'Define ángulos, hooks y la arquitectura del anuncio. La estrategia primero, la pieza después.' },
  { icon: Sparkles,   name: 'Director Creativo', role: 'Genera las ideas',    hue: '#A78BFA',
    desc: 'Storyboards, copys y guiones con la voz exacta de tu marca. Variaciones para A/B test.' },
  { icon: ImageIcon,  name: 'Diseñador',        role: 'Tu identidad visual',  hue: '#F472B6',
    desc: 'Anuncios estáticos, edición de producto y catálogo con tu paleta y tipografía siempre coherentes.' },
  { icon: Film,       name: 'Productor de Video', role: 'UGC y clips',        hue: '#F59E0B',
    desc: 'Avatares hiperrealistas presentando tu producto en cualquier idioma. Sin actores, sin set.' },
  { icon: Mic,        name: 'Voz y Guion',      role: 'Habla por tu marca',   hue: '#60A5FA',
    desc: 'Voces consistentes, multilingüe, sincronizadas a labio. Tu mensaje suena como tu marca.' },
  { icon: Layers,     name: 'Post-producción',  role: 'Listo para publicar',  hue: '#34D399',
    desc: 'Mejora calidad a 4K, recorta a cada formato y entrega para Meta, TikTok, YouTube y tu tienda.' },
  { icon: BarChart3,  name: 'Performance',      role: 'Aprende de resultados', hue: '#FB7185',
    desc: 'Detecta los anuncios ganadores, etiqueta lo que vende y le pide más al equipo de la misma fórmula.' },
];

export function Specialists() {
  const root = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const el = root.current;
    if (!el) return;

    const ctx = gsap.context(() => {
      // Heading
      gsap.from('[data-spec-h]', {
        opacity: 0,
        y: 40,
        duration: 1,
        stagger: 0.08,
        ease: 'expo.out',
        scrollTrigger: { trigger: el, start: 'top 75%' },
      });

      // Progress for the 3D scene + active specialist
      ScrollTrigger.create({
        trigger: '[data-spec-pin]',
        start: 'top top',
        end: 'bottom bottom',
        scrub: 0.4,
        onUpdate: (self) => {
          setProgress(self.progress);
          setActive(Math.min(specialists.length - 1, Math.floor(self.progress * specialists.length)));
        },
      });

      // Card transitions per slide
      gsap.utils.toArray<HTMLElement>('[data-spec-slide]').forEach((slide, i) => {
        gsap.fromTo(
          slide,
          { autoAlpha: 0, y: 40 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.6,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: slide,
              start: 'top 80%',
              end: 'bottom 30%',
              toggleActions: 'play none none reverse',
            },
          }
        );
      });
    }, el);

    return () => ctx.revert();
  }, []);

  const current = specialists[active];
  const Icon = current.icon;

  return (
    <section ref={root} id="equipo" className="relative">
      <div className="mx-auto max-w-7xl px-5 pt-24 md:px-8 md:pt-32">
        <div className="mx-auto max-w-3xl text-center">
          <span data-spec-h className="block text-[11px] font-semibold uppercase tracking-[0.32em] text-[#A78BFA]">
            Tu equipo creativo
          </span>
          <h2 data-spec-h className="font-display mt-5 text-[clamp(32px,6vw,72px)] font-semibold leading-[0.98] tracking-[-0.03em]">
            8 especialistas <span className="text-gradient-primary">trabajando para tu marca</span>
          </h2>
          <p data-spec-h className="mx-auto mt-5 max-w-2xl text-[15px] leading-relaxed text-white/60 md:text-[17px]">
            Cada uno con un rol claro, todos con tu marca memorizada. Trabajan en
            paralelo como un equipo senior — sin contratar, sin onboarding, sin esperar.
          </p>
        </div>
      </div>

      {/* Pinned 3D scene + scroll-driven specialist info */}
      <div data-spec-pin className="relative" style={{ height: `${specialists.length * 60}vh` }}>
        <div className="sticky top-0 grid h-screen grid-cols-1 lg:grid-cols-[1fr_minmax(360px,420px)]">
          {/* Canvas 3D */}
          <div className="relative h-full w-full">
            <SpecialistsScene progress={progress} />
            {/* Vignette */}
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_55%_at_50%_50%,transparent_50%,rgba(10,10,10,0.65))]" />
            {/* Progress indicator */}
            <div className="absolute bottom-8 left-8 right-8 hidden md:block">
              <div className="flex items-center gap-2">
                {specialists.map((s, i) => (
                  <div
                    key={s.name}
                    className={`h-0.5 flex-1 rounded-full transition ${
                      i <= active ? 'bg-white/80' : 'bg-white/15'
                    }`}
                    style={i === active ? { background: s.hue, boxShadow: `0 0 12px ${s.hue}` } : undefined}
                  />
                ))}
              </div>
              <div className="mt-2 flex justify-between text-[10px] uppercase tracking-[0.24em] text-white/40">
                <span>0{active + 1} / 0{specialists.length}</span>
                <span>{current.name}</span>
              </div>
            </div>
          </div>

          {/* Side panel */}
          <div className="relative flex h-full items-center px-6 md:px-10">
            <div className="w-full">
              <div
                className="rounded-3xl border border-white/[0.07] bg-gradient-to-br from-white/[0.05] to-white/[0.01] p-7 backdrop-blur-xl md:p-9"
                style={{ boxShadow: `0 30px 80px -30px ${current.hue}66` }}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="grid h-12 w-12 place-items-center rounded-2xl"
                    style={{
                      background: `linear-gradient(160deg, ${current.hue}40, ${current.hue}10)`,
                      border: `1px solid ${current.hue}40`,
                      color: current.hue,
                    }}
                  >
                    <Icon size={22} />
                  </span>
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.24em]" style={{ color: current.hue }}>
                      0{active + 1} · {current.role}
                    </div>
                    <h3 className="font-display text-[26px] font-semibold tracking-tight text-white">
                      {current.name}
                    </h3>
                  </div>
                </div>
                <p className="mt-5 text-[15px] leading-relaxed text-white/70">
                  {current.desc}
                </p>
                <div className="mt-6 flex items-center justify-between border-t border-white/5 pt-5 text-[11px] uppercase tracking-[0.24em] text-white/40">
                  <span className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: current.hue, boxShadow: `0 0 8px ${current.hue}` }} />
                    disponible 24/7
                  </span>
                  <span>handoff automático</span>
                </div>
              </div>

              {/* Lista de los 8 */}
              <div className="mt-6 grid grid-cols-2 gap-1.5">
                {specialists.map((s, i) => (
                  <button
                    key={s.name}
                    type="button"
                    className={`rounded-lg border px-2.5 py-2 text-left text-[11px] font-medium transition ${
                      i === active
                        ? 'border-white/20 bg-white/[0.06] text-white'
                        : 'border-white/[0.06] bg-white/[0.02] text-white/55 hover:bg-white/[0.04]'
                    }`}
                  >
                    <span className="block font-semibold" style={i === active ? { color: s.hue } : undefined}>
                      0{i + 1} · {s.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Slides invisibles que controlan el scroll */}
        {specialists.map((s) => (
          <div key={s.name} data-spec-slide className="h-[80vh]" aria-hidden />
        ))}
      </div>
    </section>
  );
}
