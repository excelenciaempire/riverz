/**
 * "Control the Outcome" — equivalent of Weave's app-shell screenshot.
 * Stylised mock of the Riverz Static Ads editor: layer panel on the
 * left, canvas in the middle, properties on the right. The point is the
 * same as Weave's: "this is a real tool, not a one-prompt black box."
 */
export function Capabilities() {
  return (
    <section id="estudio" className="lv2-section-cream relative overflow-hidden">
      <div className="mx-auto max-w-[1480px] px-5 py-24 text-center md:px-9 md:py-32">
        <p className="editorial-eyebrow lv2-rv text-black/45">03 · Control</p>
        <h2 className="editorial-h2 lv2-rv mx-auto mt-5 max-w-[820px]">
          Controlá cada
          <br />
          detalle
        </h2>
        <p className="lv2-rv mx-auto mt-6 max-w-[560px] text-[15px] leading-relaxed text-black/65">
          Capas, copy, branding, hooks — todas las herramientas para llevar tu visión al
          render exacto. La velocidad de la IA, el control de un creativo.
        </p>

        <div className="lv2-rv mt-14 md:mt-20">
          <div className="lv2-app-shell mx-auto grid max-w-[1200px] grid-cols-1 overflow-hidden md:grid-cols-[200px_1fr_220px]">
            {/* Left panel — Layers */}
            <div className="lv2-app-panel hidden p-3 md:block">
              <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">
                <span className="h-2 w-2 rounded-sm bg-white/60" />
                Capas
              </div>
              {[
                { name: 'Headline', active: true },
                { name: 'Subhook' },
                { name: 'Producto', active: true },
                { name: 'Sello descuento' },
                { name: 'Logo marca' },
                { name: 'Fondo · noise' },
              ].map((l) => (
                <div
                  key={l.name}
                  className={`mb-1 flex items-center gap-2 rounded px-2 py-1.5 text-[11px] ${
                    l.active ? 'bg-white/[0.06] text-white' : 'text-white/55'
                  }`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
                  {l.name}
                </div>
              ))}
            </div>

            {/* Center — Canvas */}
            <div className="relative aspect-[5/4] bg-gradient-to-br from-[#181820] via-[#0e0e13] to-[#181820] md:aspect-auto">
              <div className="absolute inset-6 grid place-items-center">
                <div className="aspect-[4/5] w-[60%] rounded-md bg-gradient-to-br from-[#f7ff9e]/20 via-[#0a0a0a] to-[#0a0a0a] ring-1 ring-white/15">
                  <div className="flex h-full flex-col justify-end p-4">
                    <div className="text-[8px] font-bold uppercase tracking-[0.18em] text-[#f7ff9e]">
                      Lanzamiento
                    </div>
                    <div className="font-editorial mt-1 text-[14px] font-semibold leading-tight text-white">
                      Tu colección
                      <br />
                      Q3 ya está
                    </div>
                  </div>
                </div>
              </div>
              {/* Bounding-box guides */}
              <div className="pointer-events-none absolute inset-6 border border-dashed border-white/15" />
              <div className="absolute right-3 top-3 rounded-full bg-white/10 px-3 py-1 text-[10px] font-medium text-white/70">
                Static Ad · 1080×1350
              </div>
            </div>

            {/* Right panel — properties */}
            <div className="lv2-app-panel hidden border-l border-r-0 p-3 md:block">
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">
                Propiedades
              </div>
              {[
                { label: 'Tipografía', value: 'Inter · Tight' },
                { label: 'Acento', value: '#F7FF9E' },
                { label: 'Hook A/B', value: '+8 variantes' },
                { label: 'Formato', value: '1080×1350' },
                { label: 'Marca', value: 'Activa' },
              ].map((p) => (
                <div key={p.label} className="mb-2.5">
                  <div className="text-[10px] uppercase tracking-[0.12em] text-white/40">
                    {p.label}
                  </div>
                  <div className="mt-0.5 text-[12px] font-medium text-white/85">{p.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
