'use client';

import { useRef } from 'react';
import {
  Brain,
  Sparkles,
  Image as ImageIcon,
  Film,
  Mic,
  Layers,
  BarChart3,
  Wand2,
} from 'lucide-react';

type Agent = {
  icon: React.ComponentType<{ size?: number }>;
  name: string;
  role: string;
  description: string;
  capabilities: string[];
  hue: string;
};

const agents: Agent[] = [
  {
    icon: Brain,
    name: 'Investigador',
    role: 'Conoce tu audiencia',
    description:
      'Estudia a tu cliente ideal, a la competencia y lo que está funcionando ahora en tu nicho.',
    capabilities: ['Audiencia', 'Competencia', 'Tendencias', 'Insights'],
    hue: '#14E0CC',
  },
  {
    icon: Wand2,
    name: 'Estratega',
    role: 'Diseña la campaña',
    description:
      'Define ángulos, hooks y la arquitectura del anuncio. La estrategia primero, la pieza después.',
    capabilities: ['Ángulos', 'Hooks', 'Funnel', 'Mensajes'],
    hue: '#22D3EE',
  },
  {
    icon: Sparkles,
    name: 'Director Creativo',
    role: 'Genera las ideas',
    description:
      'Storyboards, copys y guiones con la voz exacta de tu marca. Variaciones para A/B test.',
    capabilities: ['Storyboards', 'Copys', 'Guiones', 'A/B'],
    hue: '#A78BFA',
  },
  {
    icon: ImageIcon,
    name: 'Diseñador',
    role: 'Tu identidad visual',
    description:
      'Anuncios estáticos, edición de producto y catálogo con tu paleta y tipografía siempre coherentes.',
    capabilities: ['Static Ads', 'Producto', 'Catálogo', 'Branding'],
    hue: '#F472B6',
  },
  {
    icon: Film,
    name: 'Productor de Video',
    role: 'UGC y clips',
    description:
      'Avatares hiperrealistas presentando tu producto en cualquier idioma. Sin actores, sin set.',
    capabilities: ['UGC', 'Clips', 'Reels', 'Face Swap'],
    hue: '#F59E0B',
  },
  {
    icon: Mic,
    name: 'Voz y Guion',
    role: 'Habla por tu marca',
    description:
      'Voces consistentes, multilingüe, sincronizadas a labio. Tu mensaje suena como tu marca, siempre.',
    capabilities: ['Voiceover', 'Multi-idioma', 'Tono', 'Sync'],
    hue: '#60A5FA',
  },
  {
    icon: Layers,
    name: 'Post-producción',
    role: 'Listo para publicar',
    description:
      'Mejora calidad a 4K, recorta a cada formato y entrega para Meta, TikTok, YouTube y tu tienda.',
    capabilities: ['Upscale', 'Multiformato', 'Render', 'Export'],
    hue: '#34D399',
  },
  {
    icon: BarChart3,
    name: 'Performance',
    role: 'Aprende de resultados',
    description:
      'Detecta los anuncios ganadores, etiqueta lo que vende y le pide más al equipo de la misma fórmula.',
    capabilities: ['Ganadores', 'KPIs', 'ROAS', 'Loops'],
    hue: '#FB7185',
  },
];

export function AgentsGrid() {
  return (
    <section id="equipo" className="relative overflow-hidden py-24 md:py-32">
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-x-0 top-0 h-[40%] bg-[radial-gradient(ellipse_50%_50%_at_50%_0%,rgba(20,224,204,0.08),transparent_70%)]" />
      </div>

      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <div className="mx-auto max-w-3xl text-center" data-reveal>
          <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#A78BFA]">
            Tu nuevo equipo creativo
          </span>
          <h2 className="font-display mt-4 text-[clamp(28px,5vw,56px)] font-semibold leading-[1.05] tracking-tight">
            8 especialistas creativos
            <br className="hidden sm:block" />
            {' '}<span className="text-gradient-primary">trabajando para tu marca</span>
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-[15px] leading-relaxed text-white/60 md:text-[16px]">
            Cada uno con un rol claro, todos con tu marca memorizada. Trabajan en
            paralelo como un equipo senior — sin contratar, sin onboarding, sin
            esperar.
          </p>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {agents.map((a, i) => (
            <AgentCard key={a.name} agent={a} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

function AgentCard({ agent, index }: { agent: Agent; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const Icon = agent.icon;

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const rotY = (x - 0.5) * 14;
    const rotX = (0.5 - y) * 14;
    el.style.transform = `perspective(900px) rotateX(${rotX}deg) rotateY(${rotY}deg) translateZ(0)`;
    el.style.setProperty('--mx', `${x * 100}%`);
    el.style.setProperty('--my', `${y * 100}%`);
  };

  const handleLeave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.transform = 'perspective(900px) rotateX(0deg) rotateY(0deg)';
  };

  return (
    <div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      data-reveal
      style={{ transitionDelay: `${(index % 4) * 60}ms` }}
      className="group tilt relative overflow-hidden rounded-3xl border border-white/[0.07] bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-6 backdrop-blur"
    >
      {/* spotlight */}
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{
          background: `radial-gradient(280px circle at var(--mx,50%) var(--my,50%), ${agent.hue}26, transparent 60%)`,
        }}
      />

      <div className="relative">
        <div
          className="grid h-12 w-12 place-items-center rounded-2xl shadow-lg"
          style={{
            background: `linear-gradient(160deg, ${agent.hue}40, ${agent.hue}10)`,
            border: `1px solid ${agent.hue}40`,
            color: agent.hue,
          }}
        >
          <Icon size={22} />
        </div>

        <div className="mt-5 flex items-baseline gap-2">
          <h3 className="font-display text-[20px] font-semibold tracking-tight text-white">
            {agent.name}
          </h3>
          <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-white/35">
            agent.0{(index + 1).toString()}
          </span>
        </div>
        <p className="text-[12px] font-medium uppercase tracking-[0.16em]" style={{ color: agent.hue }}>
          {agent.role}
        </p>

        <p className="mt-3 text-[13px] leading-relaxed text-white/60">{agent.description}</p>

        <div className="mt-5 flex flex-wrap gap-1.5">
          {agent.capabilities.map((c) => (
            <span
              key={c}
              className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-white/65"
            >
              {c}
            </span>
          ))}
        </div>

        {/* tarjeta status */}
        <div className="mt-5 flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-white/40">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: agent.hue, boxShadow: `0 0 8px ${agent.hue}` }} />
            disponible 24/7
          </span>
          <span>#{(index + 1).toString().padStart(2, '0')}</span>
        </div>
      </div>
    </div>
  );
}
