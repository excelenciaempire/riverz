'use client';

import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

const items = [
  { value: 1240000, suffix: '+',     label: 'Activos creados',   sub: 'imágenes y videos publicados' },
  { value: 312,     suffix: '',      label: 'Marcas activas',    sub: 'desde DTC hasta enterprise' },
  { value: 92,      suffix: '%',     label: 'Menos costo creativo', sub: 'vs estudio tradicional' },
  { value: 3,       suffix: ' min',  label: 'Al primer asset',  sub: 'tiempo medio de respuesta' },
];

export function Stats() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      gsap.from('[data-stat]', {
        y: 80,
        opacity: 0,
        scale: 0.92,
        duration: 1,
        stagger: 0.12,
        ease: 'expo.out',
        scrollTrigger: { trigger: el, start: 'top 80%' },
      });
    }, el);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={root} className="relative overflow-hidden border-y border-white/5 bg-gradient-to-b from-[#0a0a0a] via-[#0c0c10] to-[#0a0a0a] py-24 md:py-32">
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-grid bg-grid-fade opacity-30" />
        <div className="absolute inset-x-0 top-0 h-[60%] bg-[radial-gradient(ellipse_50%_60%_at_50%_0%,rgba(20,224,204,0.08),transparent_70%)]" />
      </div>
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <div className="grid grid-cols-2 gap-y-10 sm:gap-x-8 md:grid-cols-4">
          {items.map((it, i) => (
            <Stat key={it.label} item={it} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

function Stat({ item, index }: { item: { value: number; suffix: string; label: string; sub: string }; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [n, setN] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obj = { v: 0 };
    const tween = gsap.to(obj, {
      v: item.value,
      duration: 2,
      ease: 'expo.out',
      scrollTrigger: { trigger: el, start: 'top 85%' },
      onUpdate: () => setN(Math.round(obj.v)),
    });
    return () => { tween.scrollTrigger?.kill(); tween.kill(); };
  }, [item.value]);

  const formatted = new Intl.NumberFormat('es-ES').format(n);
  return (
    <div ref={ref} data-stat className="text-center" style={{ transitionDelay: `${index * 60}ms` }}>
      <div className="font-display text-[clamp(40px,7vw,80px)] font-semibold leading-none tracking-[-0.04em]">
        <span className="text-gradient-primary">{formatted}{item.suffix}</span>
      </div>
      <div className="mt-3 text-[13px] font-semibold text-white/85 sm:text-[14px]">{item.label}</div>
      <div className="text-[11px] text-white/45 sm:text-[12px]">{item.sub}</div>
    </div>
  );
}
