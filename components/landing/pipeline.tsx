'use client';

import { useEffect, useState } from 'react';

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
  const [active, setActive] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setActive((i) => (i + 1) % stages.length);
    }, 2400);
    return () => window.clearInterval(id);
  }, []);

  return (
    <section id="flujo" className="relative overflow-hidden py-24 md:py-32">
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-grid bg-grid-fade opacity-40" />
      </div>

      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <div className="mx-auto max-w-3xl text-center" data-reveal>
          <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#F472B6]">
            Cómo funciona
          </span>
          <h2 className="font-display mt-4 text-[clamp(28px,5vw,56px)] font-semibold leading-[1.05] tracking-tight">
            De una idea a tu próxima campaña
            <br className="hidden sm:block" />
            {' '}<span className="text-gradient-primary">en minutos, no semanas</span>
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-[15px] leading-relaxed text-white/60 md:text-[16px]">
            Tú decides qué quieres lanzar. Riverz se encarga del resto — investigación,
            ideación, producción y entrega — listo para publicar.
          </p>
        </div>

        <div className="mt-14" data-reveal>
          <PipelineDiagram active={active} setActive={setActive} />
        </div>

        {/* Stage detail */}
        <div className="mx-auto mt-10 max-w-3xl text-center" data-reveal>
          <div className="text-[11px] font-mono uppercase tracking-[0.24em] text-white/40">
            paso 0{stages[active].id} · {stages[active].sub}
          </div>
          <h3 className="font-display mt-2 text-[clamp(20px,3vw,30px)] font-semibold text-white">
            {stages[active].title}
          </h3>
          <p className="mx-auto mt-2 max-w-xl text-[14px] text-white/60 sm:text-[15px]">{stages[active].desc}</p>
        </div>
      </div>
    </section>
  );
}

function PipelineDiagram({
  active,
  setActive,
}: {
  active: number;
  setActive: (i: number) => void;
}) {
  return (
    <div className="relative">
      {/* SVG path conector */}
      <svg
        viewBox="0 0 1200 120"
        className="absolute inset-x-0 top-1/2 hidden w-full -translate-y-1/2 md:block"
        preserveAspectRatio="none"
        aria-hidden
      >
        <defs>
          <linearGradient id="plLine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#14E0CC" stopOpacity="0.3" />
            <stop offset="50%" stopColor="#A78BFA" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#FB7185" stopOpacity="0.3" />
          </linearGradient>
        </defs>
        <path
          d="M 0 60 C 200 20, 400 100, 600 60 S 1000 20, 1200 60"
          fill="none"
          stroke="url(#plLine)"
          strokeWidth="2"
        />
        <path
          d="M 0 60 C 200 20, 400 100, 600 60 S 1000 20, 1200 60"
          fill="none"
          stroke="#14E0CC"
          strokeWidth="2.5"
          strokeOpacity="0.85"
          className="flow-path"
          strokeDasharray="6 14"
        />
      </svg>

      <div className="relative grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
        {stages.map((s, i) => {
          const isActive = i === active;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setActive(i)}
              className={`group relative flex flex-col items-center gap-3 rounded-2xl border p-4 text-center transition ${
                isActive
                  ? 'border-white/15 bg-white/[0.06]'
                  : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]'
              }`}
            >
              <div
                className="grid h-12 w-12 place-items-center rounded-xl text-[14px] font-bold transition"
                style={{
                  background: isActive
                    ? `linear-gradient(160deg, ${s.color}, ${s.color}66)`
                    : `linear-gradient(160deg, ${s.color}30, ${s.color}10)`,
                  color: isActive ? '#0a0a0a' : s.color,
                  boxShadow: isActive ? `0 12px 32px -8px ${s.color}80` : 'none',
                  border: `1px solid ${s.color}40`,
                }}
              >
                0{s.id}
              </div>
              <div>
                <div className="text-[12px] font-semibold text-white">{s.title}</div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-white/40">
                  {s.sub}
                </div>
              </div>
              {isActive && (
                <span
                  className="absolute -top-1 right-2 h-2 w-2 rounded-full"
                  style={{ background: s.color, boxShadow: `0 0 12px ${s.color}` }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
