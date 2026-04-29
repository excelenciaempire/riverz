'use client';

import { Brain, Sparkles, Wand2, Image as ImageIcon, Film, Mic, Layers, BarChart3 } from 'lucide-react';

type Agent = {
  icon: React.ReactNode;
  label: string;
  hue: string;
};

const agents: Agent[] = [
  { icon: <Brain size={22} />,      label: 'Insight',    hue: '#14E0CC' },
  { icon: <Sparkles size={22} />,   label: 'Concept',    hue: '#A78BFA' },
  { icon: <ImageIcon size={22} />,  label: 'Visual',     hue: '#F472B6' },
  { icon: <Film size={22} />,       label: 'Motion',     hue: '#F59E0B' },
  { icon: <Mic size={22} />,        label: 'Voice',      hue: '#60A5FA' },
  { icon: <Layers size={22} />,     label: 'Production', hue: '#34D399' },
  { icon: <BarChart3 size={22} />,  label: 'Analytics',  hue: '#FB7185' },
  { icon: <Wand2 size={22} />,      label: 'Strategy',   hue: '#22D3EE' },
];

/**
 * Esfera orquestal 3D: un núcleo pulsante rodeado por anillos orbitales con
 * nodos representando cada agente. CSS-only, sin dependencias 3D externas.
 */
export function OrchestraSphere() {
  // Anillo 1 (4 nodos), anillo 2 (4 nodos)
  const ring1 = agents.slice(0, 4);
  const ring2 = agents.slice(4, 8);

  return (
    <div className="orb-stage relative mx-auto aspect-square w-full max-w-[560px]">
      {/* Halo / aurora */}
      <div className="pointer-events-none absolute inset-[-15%] rounded-full bg-[radial-gradient(circle_at_center,rgba(20,224,204,0.18),transparent_60%)]" />
      <div className="pointer-events-none absolute inset-[-5%] rounded-full bg-[radial-gradient(circle_at_70%_30%,rgba(139,92,246,0.18),transparent_55%)]" />

      {/* Anillos guía */}
      <div className="absolute inset-[12%] rounded-full border border-white/[0.06]" />
      <div className="absolute inset-[24%] rounded-full border border-white/[0.05]" />
      <div className="absolute inset-[36%] rounded-full border border-dashed border-[#14E0CC]/15" />

      {/* Núcleo */}
      <div className="orb-core" />

      {/* Etiqueta del núcleo */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 select-none text-center">
        <div className="text-[9px] font-semibold uppercase tracking-[0.32em] text-white/70">Riverz</div>
        <div className="text-[8px] font-medium uppercase tracking-[0.28em] text-white/40">Orchestrator</div>
      </div>

      {/* Anillo orbital 1 — horizontal */}
      <div className="absolute inset-[10%]">
        <div className="orb-rotor relative h-full w-full">
          {ring1.map((a, i) => {
            const angle = (i / ring1.length) * 360;
            const radius = 220;
            return (
              <div
                key={a.label}
                className="orb-node"
                style={{
                  transform: `rotateY(${angle}deg) translateZ(${radius}px) rotateY(${-angle}deg)`,
                  boxShadow: `0 8px 32px -8px ${a.hue}66, inset 0 1px 0 rgba(255,255,255,0.08)`,
                  borderColor: `${a.hue}33`,
                }}
              >
                <div style={{ color: a.hue }}>{a.icon}</div>
                <span className="absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70">
                  {a.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Anillo orbital 2 — inclinado en X (otro plano) */}
      <div className="absolute inset-[18%]" style={{ transform: 'rotateX(70deg)' }}>
        <div className="orb-rotor-rev relative h-full w-full">
          {ring2.map((a, i) => {
            const angle = (i / ring2.length) * 360;
            const radius = 180;
            return (
              <div
                key={a.label}
                className="orb-node"
                style={{
                  transform: `rotateY(${angle}deg) translateZ(${radius}px) rotateY(${-angle}deg) rotateX(-70deg)`,
                  boxShadow: `0 8px 32px -8px ${a.hue}66, inset 0 1px 0 rgba(255,255,255,0.08)`,
                  borderColor: `${a.hue}33`,
                  width: 48,
                  height: 48,
                  marginTop: -24,
                  marginLeft: -24,
                }}
              >
                <div style={{ color: a.hue }}>{a.icon}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pequeñas partículas flotantes */}
      <Particles />
    </div>
  );
}

function Particles() {
  const dots = Array.from({ length: 18 });
  return (
    <div className="pointer-events-none absolute inset-0">
      {dots.map((_, i) => {
        const left = (i * 53) % 100;
        const top = (i * 31 + 7) % 100;
        const delay = (i * 0.43) % 4;
        const dur = 5 + (i % 4);
        return (
          <span
            key={i}
            className="absolute h-1 w-1 rounded-full bg-white/60 float-y"
            style={{
              left: `${left}%`,
              top: `${top}%`,
              animationDelay: `${delay}s`,
              animationDuration: `${dur}s`,
              boxShadow: '0 0 8px rgba(20,224,204,0.7)',
            }}
          />
        );
      })}
    </div>
  );
}
