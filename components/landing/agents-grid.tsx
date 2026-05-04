const tools = [
  // First column (left of the central piece)
  { label: 'Static Ads', col: 'left', y: 0 },
  { label: 'UGC', col: 'left', y: 1 },
  { label: 'Foto IA', col: 'left', y: 2 },
  { label: 'Photo Editor', col: 'left', y: 3 },
  { label: 'Stealer', col: 'left', y: 4 },
  // Right column
  { label: 'Avatares', col: 'right', y: 0 },
  { label: 'Face Swap', col: 'right', y: 1 },
  { label: 'Mejorar Calidad', col: 'right', y: 2 },
  { label: 'Clips', col: 'right', y: 3 },
  { label: 'Landing Lab', col: 'right', y: 4 },
];

/**
 * "With all the professional tools you rely on" — pill cloud floating
 * around a central object. Direct equivalent of Weave's tools section,
 * but the pills here name Riverz's actual agents (Static Ads, UGC,
 * Avatares, Foto IA, Photo Editor, Face Swap, Mejorar Calidad, Clips,
 * Stealer, Landing Lab).
 */
export function AgentsGrid() {
  return (
    <section id="agentes" className="lv2-page relative overflow-hidden">
      <div className="mx-auto max-w-[1480px] px-5 py-24 text-center md:px-9 md:py-36">
        <p className="editorial-eyebrow lv2-rv text-black/45">02 · Agentes</p>
        <h2 className="editorial-h2 lv2-rv mx-auto mt-5 max-w-[920px]">
          Con todos los agentes
          <br />
          que tu marca necesita
        </h2>
        <p className="lv2-rv mx-auto mt-6 max-w-[520px] text-[15px] leading-relaxed text-black/60">
          Un flujo coordinado — cada agente especializado en una etapa del estudio creativo.
        </p>

        <div className="relative mx-auto mt-16 grid grid-cols-1 items-center gap-10 md:mt-24 md:grid-cols-[1fr_auto_1fr] md:gap-12">
          {/* Left column — pills float in */}
          <div className="hidden flex-col items-end gap-5 md:flex">
            {tools
              .filter((t) => t.col === 'left')
              .map((t, i) => (
                <span
                  key={t.label}
                  className={`lv2-pill lv2-rv lv2-float-${(i % 3) + 1}`}
                  style={{ marginRight: i % 2 === 0 ? '0' : '36px' }}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-[#0a0a0a]" />
                  {t.label}
                </span>
              ))}
          </div>

          {/* Central piece — replaces Weave's bowl. Stacked product photos
              standing in for "the studio output." */}
          <div className="lv2-rv mx-auto w-full max-w-[420px] md:w-[420px]">
            <div className="relative aspect-square rounded-2xl bg-gradient-to-br from-[#1a1a22] via-[#0a0a0a] to-[#1a1a22] p-8 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.4)]">
              <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-3">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="relative overflow-hidden rounded-lg bg-gradient-to-br from-white/15 to-white/5"
                  >
                    <span className="absolute left-2 top-2 text-[9px] font-semibold uppercase tracking-[0.18em] text-white/45">
                      {['STATIC', 'UGC', 'FOTO', 'AVATAR'][i]}
                    </span>
                  </div>
                ))}
              </div>
              <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-[#f7ff9e] px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-black shadow-md">
                Tu marca · 1 plataforma
              </div>
            </div>
          </div>

          {/* Right column */}
          <div className="hidden flex-col items-start gap-5 md:flex">
            {tools
              .filter((t) => t.col === 'right')
              .map((t, i) => (
                <span
                  key={t.label}
                  className={`lv2-pill lv2-rv lv2-float-${(i % 3) + 1}`}
                  style={{ marginLeft: i % 2 === 0 ? '0' : '36px' }}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-[#0a0a0a]" />
                  {t.label}
                </span>
              ))}
          </div>

          {/* Mobile: simple grid of all pills below the central piece */}
          <div className="flex flex-wrap justify-center gap-2 md:hidden">
            {tools.map((t) => (
              <span key={t.label} className="lv2-pill">
                <span className="h-1.5 w-1.5 rounded-full bg-[#0a0a0a]" />
                {t.label}
              </span>
            ))}
          </div>
        </div>

        <p className="lv2-rv mt-16 text-[13px] text-black/50">
          Y más herramientas: research, brand voice, performance loops.
        </p>
      </div>
    </section>
  );
}
