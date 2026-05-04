'use client';

import { useEffect, useState } from 'react';

/**
 * "From Workflow to App Mode" → Riverz spin: "Del brief / al anuncio".
 * Massive split heading with the same animated toggle in the middle as
 * Weave. Below: a node-graph showing the static-ads pipeline so the user
 * can see what actually happens between brief and export.
 */
export function Pipeline() {
  const [mode, setMode] = useState<'brief' | 'ad'>('brief');

  useEffect(() => {
    const id = setInterval(() => {
      setMode((m) => (m === 'brief' ? 'ad' : 'brief'));
    }, 2400);
    return () => clearInterval(id);
  }, []);

  return (
    <section id="flujos" className="lv2-page relative overflow-hidden border-y border-black/5">
      <div className="mx-auto max-w-[1480px] px-5 py-24 md:px-9 md:py-36">
        <p className="editorial-eyebrow lv2-rv text-black/45">04 · Flujo</p>
        <p className="lv2-rv mt-3 max-w-[420px] text-[14px] leading-relaxed text-black/55">
          Acelerá la producción del estudio: un mismo brief expande en docenas de variantes
          listas para Meta, TikTok y tu tienda.
        </p>

        <div className="lv2-rv mt-10 flex items-baseline gap-4 md:mt-12 md:gap-8">
          <h2 className="editorial-h1">Del brief</h2>
          <Toggle mode={mode} onClick={() => setMode((m) => (m === 'brief' ? 'ad' : 'brief'))} />
          <h2 className="editorial-h1 text-black/85">al anuncio</h2>
        </div>

        {/* Node-graph mock */}
        <div className="lv2-rv mt-14 grid grid-cols-2 gap-3 md:mt-20 md:grid-cols-5 md:gap-4">
          {[
            { tag: 'BRIEF', label: 'Producto · Ángulos', sub: 'Investigador + Estratega' },
            { tag: 'IMAGE REF', label: 'Foto producto', sub: 'Stealer · Photo Editor' },
            { tag: 'COLOR / VOZ', label: 'Brand identity', sub: 'Paleta · tipografía' },
            { tag: 'GENERACIÓN', label: 'Variantes A/B', sub: 'Nano Banana · Sora' },
            { tag: 'OUTPUT', label: 'Multiformato', sub: '1080×1350 · 9:16 · 1:1' },
          ].map((s, i) => (
            <PipeCard key={s.tag} step={s} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

function Toggle({ mode, onClick }: { mode: 'brief' | 'ad'; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Animar toggle"
      className="relative inline-flex h-12 w-24 items-center rounded-full bg-[#0a0a0a] md:h-16 md:w-32"
    >
      <span
        className={`absolute h-9 w-9 rounded-full bg-[#f7ff9e] transition-all duration-500 md:h-12 md:w-12 ${
          mode === 'ad' ? 'left-[calc(100%-44px)] md:left-[calc(100%-58px)]' : 'left-1.5 md:left-1.5'
        }`}
      />
      <span
        className={`absolute h-9 w-9 rounded-full border border-white/40 transition-all duration-500 md:h-12 md:w-12 ${
          mode === 'ad' ? 'left-1.5 md:left-1.5' : 'left-[calc(100%-44px)] md:left-[calc(100%-58px)]'
        }`}
      />
    </button>
  );
}

function PipeCard({
  step,
  index,
}: {
  step: { tag: string; label: string; sub: string };
  index: number;
}) {
  return (
    <div
      className="lv2-rv group relative aspect-[4/5] overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-black/5"
      data-rv-delay={String(80 * index)}
    >
      <div className="absolute inset-x-0 top-0 px-3 pt-3">
        <span className="editorial-eyebrow text-black/45">{step.tag}</span>
      </div>
      <div
        className="absolute inset-x-3 top-9 bottom-[68px] rounded-md"
        style={{
          background:
            'repeating-linear-gradient(135deg, rgba(0,0,0,0.04), rgba(0,0,0,0.04) 2px, transparent 2px, transparent 8px)',
        }}
      />
      <div className="absolute inset-x-0 bottom-0 px-3 pb-3">
        <div className="text-[14px] font-semibold tracking-tight text-black">{step.label}</div>
        <div className="text-[11px] text-black/50">{step.sub}</div>
      </div>
      {/* Connecting arrow on the right edge — only between cards */}
      {index < 4 && (
        <div className="pointer-events-none absolute -right-2.5 top-1/2 hidden -translate-y-1/2 text-black/25 md:block">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M5 12h14M13 5l7 7-7 7" />
          </svg>
        </div>
      )}
    </div>
  );
}
