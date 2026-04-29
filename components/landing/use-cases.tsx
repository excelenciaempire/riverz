'use client';

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ShoppingBag, Shirt, Coffee, Sparkles, ArrowRight } from 'lucide-react';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

const cases = [
  {
    icon: Shirt,
    vertical: 'Moda · DTC',
    brand: 'Northwave',
    problem: 'Lanzaba 1 colección por trimestre. Cada shooting le costaba $8.5K y 3 semanas.',
    result: 'Ahora produce 4 lanzamientos por mes con 60+ piezas creativas por lanzamiento.',
    metric: { value: '+312%', label: 'ROAS en Meta' },
    hue: '#F472B6',
  },
  {
    icon: Sparkles,
    vertical: 'Skincare',
    brand: 'Lumen',
    problem: 'Los UGC reales eran inconsistentes y dependían de creators que cobraban $400 por video.',
    result: 'Generan 30 UGC al mes con avatares de marca, sin pagar por video, con tono uniforme.',
    metric: { value: '−87%', label: 'Costo creativo' },
    hue: '#14E0CC',
  },
  {
    icon: Coffee,
    vertical: 'F&B · D2C',
    brand: 'Ferrara',
    problem: 'Catálogo de 240 SKUs sin foto profesional. Las ventas en marketplaces sufrían.',
    result: 'Catálogo entero re-fotografiado con consistencia. Subió ranking en marketplaces.',
    metric: { value: '+48%', label: 'CTR en producto' },
    hue: '#A78BFA',
  },
  {
    icon: ShoppingBag,
    vertical: 'Marketplace',
    brand: 'Atlas',
    problem: 'Necesitaba lanzar campañas regionales en 5 países con 5 idiomas.',
    result: 'Mismo brief, 5 versiones lingüísticas con voz local en menos de un día.',
    metric: { value: '5×', label: 'Más mercados' },
    hue: '#F59E0B',
  },
];

export function UseCases() {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      gsap.from('[data-uc-h]', {
        y: 60,
        opacity: 0,
        stagger: 0.08,
        duration: 1,
        ease: 'expo.out',
        scrollTrigger: { trigger: el, start: 'top 75%' },
      });
      gsap.utils.toArray<HTMLElement>('[data-uc-card]').forEach((card, i) => {
        gsap.from(card, {
          opacity: 0,
          y: 60,
          rotate: i % 2 === 0 ? -1 : 1,
          duration: 0.9,
          ease: 'power3.out',
          scrollTrigger: { trigger: card, start: 'top 85%' },
        });
      });
    }, el);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={root} className="relative overflow-hidden py-24 md:py-32">
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-grid bg-grid-fade opacity-30" />
      </div>

      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <span data-uc-h className="block text-[11px] font-semibold uppercase tracking-[0.32em] text-[#F59E0B]">
            Marcas como la tuya
          </span>
          <h2 data-uc-h className="font-display mt-5 text-[clamp(32px,6vw,72px)] font-semibold leading-[0.98] tracking-[-0.03em]">
            Resultados reales para
            <br className="hidden sm:block" />
            {' '}<span className="text-gradient-primary">e-commerce que escala.</span>
          </h2>
          <p data-uc-h className="mx-auto mt-5 max-w-2xl text-[15px] leading-relaxed text-white/60 md:text-[17px]">
            Marcas DTC, skincare, fashion y F&B usan Riverz para producir más,
            gastar menos y mantener su identidad consistente en cada anuncio.
          </p>
        </div>

        <div className="mt-16 grid gap-4 md:grid-cols-2">
          {cases.map((c) => {
            const Icon = c.icon;
            return (
              <article
                key={c.brand}
                data-uc-card
                className="group relative overflow-hidden rounded-3xl border border-white/[0.07] bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-6 transition hover:border-white/15 sm:p-8"
              >
                <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full opacity-30 blur-3xl" style={{ background: c.hue }} />
                <div className="relative">
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-xl" style={{ background: `${c.hue}20`, color: c.hue, border: `1px solid ${c.hue}40` }}>
                      <Icon size={18} />
                    </span>
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: c.hue }}>{c.vertical}</div>
                      <div className="font-display text-[18px] font-semibold text-white">{c.brand}</div>
                    </div>
                    <div className="ml-auto rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-right">
                      <div className="font-display text-[18px] font-semibold leading-none" style={{ color: c.hue }}>{c.metric.value}</div>
                      <div className="mt-0.5 text-[9px] uppercase tracking-[0.18em] text-white/45">{c.metric.label}</div>
                    </div>
                  </div>
                  <div className="mt-6 space-y-3 text-[13px] leading-relaxed sm:text-[14px]">
                    <p className="text-white/55">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">Antes · </span>
                      {c.problem}
                    </p>
                    <p className="text-white/85">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: c.hue }}>Después · </span>
                      {c.result}
                    </p>
                  </div>
                  <div className="mt-6 inline-flex items-center gap-1.5 text-[12px] font-semibold text-white/70 transition group-hover:text-white">
                    Ver caso completo
                    <ArrowRight size={14} className="transition group-hover:translate-x-0.5" />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
