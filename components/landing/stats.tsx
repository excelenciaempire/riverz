'use client';

import { useEffect, useRef, useState } from 'react';

const items = [
  { value: 1240000, suffix: '+', label: 'Activos creados para marcas', sub: 'imágenes y videos publicados' },
  { value: 312,     suffix: '',  label: 'Marcas activas escalando',     sub: 'desde DTC hasta enterprise' },
  { value: 92,      suffix: '%', label: 'Reducción de costo creativo',  sub: 'vs estudio tradicional' },
  { value: 3,       suffix: ' min', label: 'De idea al primer asset',   sub: 'tiempo medio de respuesta' },
];

export function Stats() {
  return (
    <section className="relative overflow-hidden border-y border-white/5 bg-gradient-to-b from-[#0a0a0a] via-[#0c0c10] to-[#0a0a0a] py-20 md:py-24">
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-grid bg-grid-fade opacity-30" />
        <div className="absolute inset-x-0 top-0 h-[60%] bg-[radial-gradient(ellipse_50%_60%_at_50%_0%,rgba(20,224,204,0.08),transparent_70%)]" />
      </div>
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <div className="grid grid-cols-2 gap-6 sm:gap-8 md:grid-cols-4">
          {items.map((it, i) => (
            <Stat key={it.label} item={it} delay={i * 80} />
          ))}
        </div>
      </div>
    </section>
  );
}

function Stat({
  item,
  delay,
}: {
  item: { value: number; suffix: string; label: string; sub: string };
  delay: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [n, setN] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          const start = performance.now();
          const dur = 1400;
          const tick = (t: number) => {
            const p = Math.min(1, (t - start) / dur);
            const eased = 1 - Math.pow(1 - p, 3);
            setN(Math.round(item.value * eased));
            if (p < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
          io.disconnect();
        }
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [item.value]);

  const formatted = new Intl.NumberFormat('es-ES').format(n);

  return (
    <div ref={ref} data-reveal style={{ transitionDelay: `${delay}ms` }} className="text-center">
      <div className="font-display text-[clamp(32px,5.5vw,56px)] font-semibold leading-none tracking-tight">
        <span className="text-gradient-primary">{formatted}{item.suffix}</span>
      </div>
      <div className="mt-3 text-[13px] font-semibold text-white/85 sm:text-[14px]">{item.label}</div>
      <div className="text-[11px] text-white/45 sm:text-[12px]">{item.sub}</div>
    </div>
  );
}
