import { SectionEyebrow } from '../shared/SectionEyebrow';

const agents = [
  { label: 'Static Ads', tone: 'cream' },
  { label: 'UGC con avatares', tone: 'dark' },
  { label: 'Foto IA', tone: 'cream' },
  { label: 'Photo Editor', tone: 'cream' },
  { label: 'Stealer', tone: 'dark' },
  { label: 'Avatares', tone: 'cream' },
  { label: 'Face Swap', tone: 'dark' },
  { label: 'Mejorar calidad', tone: 'cream' },
  { label: 'Clips', tone: 'cream' },
  { label: 'Landing Lab', tone: 'dark' },
] as const;

export function AgentsGridSection() {
  return (
    <section
      id="agentes"
      className="lv3-bg-cream relative overflow-hidden border-y border-black/5"
    >
      <div className="mx-auto max-w-[1480px] px-5 py-24 md:px-9 md:py-32">
        <SectionEyebrow index="07" label="Agentes" />
        <h2 className="editorial-h2 mt-5 max-w-[840px]">
          Diez agentes, una orquesta.
        </h2>
        <p className="mt-6 max-w-[520px] text-[14px] leading-relaxed text-black/65 md:text-[15px]">
          Cada agente domina una capa de la creatividad. Riverz los conecta para que tu
          marca pase del brief al lanzamiento sin cambiar de tab.
        </p>

        <div className="relative mt-16 h-[420px] md:h-[520px]">
          {/* Central anchor — small refractive disc, callback to the hero orb */}
          <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="relative h-32 w-32 md:h-44 md:w-44">
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  background:
                    'radial-gradient(60% 50% at 35% 35%, rgba(255,255,255,0.95), rgba(247,255,158,0.4) 45%, rgba(20,224,204,0.25) 70%, transparent 80%)',
                  filter: 'blur(0.5px)',
                  boxShadow:
                    '0 30px 60px -20px rgba(10,10,10,0.45), inset 0 0 30px rgba(20,224,204,0.25)',
                }}
              />
              <div className="absolute inset-0 grid place-items-center">
                <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/65">
                  Riverz
                </span>
              </div>
            </div>
          </div>

          {/* Floating pills around the anchor */}
          {agents.map((a, i) => {
            const angle = (i / agents.length) * Math.PI * 2;
            const radiusX = 38;
            const radiusY = 30;
            const x = 50 + Math.cos(angle) * radiusX;
            const y = 50 + Math.sin(angle) * radiusY;
            const dark = a.tone === 'dark';
            return (
              <span
                key={a.label}
                className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full px-3 py-1.5 text-[11px] font-semibold tracking-tight ring-1 transition md:px-4 md:py-2 md:text-[13px] ${
                  dark
                    ? 'bg-[#0a0a0a] text-[#fafaf7] ring-black/30'
                    : 'bg-white text-black ring-black/10'
                } shadow-[0_8px_30px_-12px_rgba(10,10,10,0.25)]`}
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                  animation: `floatPill ${4 + (i % 3)}s ease-in-out ${i * 0.2}s infinite alternate`,
                }}
              >
                {a.label}
              </span>
            );
          })}

          <style>{`
            @keyframes floatPill {
              0% { transform: translate(-50%, -50%) translateY(0); }
              100% { transform: translate(-50%, -50%) translateY(-8px); }
            }
            @media (prefers-reduced-motion: reduce) {
              .lv3-bg-cream span[style*="floatPill"] { animation: none !important; }
            }
          `}</style>
        </div>
      </div>
    </section>
  );
}
