'use client';

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

const stages = [
  {
    id: 1,
    title: 'Cuéntanos tu marca',
    sub: 'Onboarding',
    desc: 'Subes tu producto, paleta y tono. En minutos tenemos el ADN de tu marca memorizado.',
    color: '#14E0CC',
  },
  {
    id: 2,
    title: 'Pides una campaña',
    sub: 'Brief en lenguaje natural',
    desc: '"Lanza la nueva colección de invierno con foco en Meta y TikTok." Solo eso.',
    color: '#22D3EE',
  },
  {
    id: 3,
    title: 'Investigamos & ideamos',
    sub: 'Estrategia',
    desc: 'Audiencia, ángulos y hooks listos. Tú apruebas la dirección antes de producir.',
    color: '#A78BFA',
  },
  {
    id: 4,
    title: 'Producimos en paralelo',
    sub: 'Creación',
    desc: 'UGC, anuncios estáticos, clips y catálogo de producto se generan al mismo tiempo.',
    color: '#F472B6',
  },
  {
    id: 5,
    title: 'Entregamos listo',
    sub: 'Multiformato',
    desc: 'Cada pieza lista para Meta, TikTok, YouTube y tu tienda — en su tamaño correcto.',
    color: '#34D399',
  },
  {
    id: 6,
    title: 'Aprendemos de tus ventas',
    sub: 'Iteración',
    desc: 'Detectamos qué anuncios venden y producimos más con esa misma fórmula.',
    color: '#FB7185',
  },
];

export function Pipeline() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const track = el.querySelector<HTMLDivElement>('[data-track]');
    if (!track) return;

    const ctx = gsap.context(() => {
      const totalScroll = track.scrollWidth - window.innerWidth;
      gsap.to(track, {
        x: () => -(track.scrollWidth - window.innerWidth + 80),
        ease: 'none',
        scrollTrigger: {
          trigger: '[data-pin]',
          start: 'top top',
          end: () => `+=${totalScroll + window.innerWidth}`,
          scrub: 1,
          pin: true,
          anticipatePin: 1,
          invalidateOnRefresh: true,
        },
      });

      // Aparecer cards una por una con stagger temporal (no horizontal scroll-trigger)
      gsap.from('[data-card]', {
        opacity: 0,
        y: 40,
        duration: 0.7,
        stagger: 0.08,
        ease: 'power3.out',
        scrollTrigger: { trigger: '[data-pin]', start: 'top 80%' },
      });

      // Heading
      gsap.from('[data-pl-h]', {
        y: 60,
        opacity: 0,
        stagger: 0.08,
        duration: 1,
        ease: 'expo.out',
        scrollTrigger: { trigger: el, start: 'top 70%' },
      });
    }, el);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={root} id="flujo" className="relative">
      {/* Heading */}
      <div className="mx-auto max-w-7xl px-5 py-24 text-center md:px-8 md:py-32">
        <span data-pl-h className="block text-[11px] font-semibold uppercase tracking-[0.32em] text-[#F472B6]">
          Cómo funciona
        </span>
        <h2 data-pl-h className="font-display mx-auto mt-5 max-w-4xl text-[clamp(32px,6vw,72px)] font-semibold leading-[0.98] tracking-[-0.03em]">
          De una idea a tu próxima campaña <span className="text-gradient-primary">en minutos.</span>
        </h2>
        <p data-pl-h className="mx-auto mt-5 max-w-2xl text-[15px] leading-relaxed text-white/60 md:text-[17px]">
          Tú decides qué quieres lanzar. Riverz se encarga del resto — investigación,
          ideación, producción y entrega — listo para publicar.
        </p>
      </div>

      {/* Pinned horizontal scroll */}
      <div data-pin className="relative h-screen overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-grid bg-grid-fade opacity-30" />
        <div className="absolute inset-x-0 top-1/2 -z-10 h-[60%] -translate-y-1/2 bg-[radial-gradient(ellipse_50%_60%_at_50%_50%,rgba(20,224,204,0.06),transparent_70%)]" />

        <div className="flex h-full items-center">
          <div data-track className="flex items-center gap-8 pl-[10vw] pr-[10vw]">
            {stages.map((s, i) => (
              <article
                key={s.id}
                data-card
                className="relative flex w-[80vw] max-w-[480px] flex-shrink-0 flex-col rounded-[28px] border border-white/[0.07] bg-gradient-to-br from-white/[0.05] to-white/[0.01] p-8 backdrop-blur-xl md:w-[520px] md:p-10"
                style={{ boxShadow: `0 40px 100px -30px ${s.color}55` }}
              >
                <div
                  className="font-display text-[100px] font-semibold leading-none tracking-tight md:text-[140px]"
                  style={{ color: s.color, opacity: 0.16 }}
                >
                  0{s.id}
                </div>
                <div className="mt-2 text-[10px] font-semibold uppercase tracking-[0.28em]" style={{ color: s.color }}>
                  paso 0{s.id} · {s.sub}
                </div>
                <h3 className="font-display mt-3 text-[28px] font-semibold leading-[1.05] text-white md:text-[36px]">
                  {s.title}
                </h3>
                <p className="mt-4 text-[14px] leading-relaxed text-white/65 md:text-[15px]">{s.desc}</p>

                {/* Connector arrow */}
                {i < stages.length - 1 && (
                  <div className="absolute -right-4 top-1/2 hidden h-px w-8 -translate-y-1/2 md:block" style={{ background: `linear-gradient(to right, ${s.color}, transparent)` }} />
                )}

                {/* Stage icon decoration */}
                <div className="mt-auto flex items-center justify-between pt-8">
                  <span
                    className="grid h-10 w-10 place-items-center rounded-xl text-[12px] font-bold"
                    style={{ background: `${s.color}20`, color: s.color, border: `1px solid ${s.color}40` }}
                  >
                    →
                  </span>
                  <span className="text-[10px] uppercase tracking-[0.24em] text-white/30">
                    {i === 0 ? 'inicio' : i === stages.length - 1 ? 'loop' : `paso ${i + 1}`}
                  </span>
                </div>
              </article>
            ))}

            {/* Final card: empieza */}
            <div className="flex w-[80vw] max-w-[420px] flex-shrink-0 items-center justify-center md:w-[440px]">
              <a
                href="/sign-up"
                className="group flex h-full w-full flex-col items-center justify-center gap-3 rounded-[28px] bg-white px-10 py-16 text-center text-black shadow-[0_40px_100px_-30px_rgba(20,224,204,0.6)]"
              >
                <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-black/60">listo para empezar</span>
                <span className="font-display text-[28px] font-semibold leading-tight">Activa tu estudio</span>
                <span className="mt-2 inline-flex items-center gap-1.5 text-[14px] font-semibold">
                  Empieza ahora
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="transition group-hover:translate-x-0.5">
                    <path d="M5 12h14M13 5l7 7-7 7" />
                  </svg>
                </span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
