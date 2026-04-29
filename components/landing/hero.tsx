import Link from 'next/link';
import { OrchestraSphere } from './orchestra-sphere';

const logos = [
  'Atlas', 'Northwave', 'Lumen', 'Ferrara', 'Kade', 'Voltic', 'Mira', 'Stellar',
];

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden pt-28 md:pt-36">
      {/* Fondo: aurora + grid + noise */}
      <div className="absolute inset-0 -z-10">
        <div className="aurora" />
        <div className="absolute inset-0 bg-grid bg-grid-fade" />
        <div className="absolute inset-0 bg-noise opacity-[0.35] mix-blend-overlay" />
        <div className="absolute inset-x-0 top-0 h-[70%] bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(20,224,204,0.18),transparent_70%)]" />
      </div>

      <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 pb-20 md:grid-cols-[1.05fr_1fr] md:gap-16 md:px-8 md:pb-32">
        {/* Texto */}
        <div className="relative" data-reveal>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-white/70 backdrop-blur">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#14E0CC] opacity-70" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#14E0CC]" />
            </span>
            Estudio creativo con IA · Para marcas
          </div>

          <h1 className="font-display mt-6 text-[clamp(40px,7vw,86px)] font-semibold leading-[0.98] tracking-tight">
            <span className="block text-white">El estudio creativo</span>
            <span className="block text-gradient-primary">
              que vende por tu marca
            </span>
            <span className="block text-white/90">
              24/7.
            </span>
          </h1>

          <p className="mt-7 max-w-xl text-[16px] leading-relaxed text-white/65 md:text-[17px]">
            Produce <strong className="text-white">UGC, anuncios estáticos, clips y catálogo de producto</strong> con
            la consistencia de un estudio premium — sin contratar talento, sin set y
            sin esperar semanas. Tu marca al ritmo de tu tienda.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link
              href="/sign-up"
              className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full bg-white px-6 py-3.5 text-[14px] font-semibold text-black shadow-[0_18px_40px_-12px_rgba(20,224,204,0.55)] transition hover:translate-y-[-1px]"
            >
              <span className="relative z-10">Empieza a producir gratis</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="relative z-10 transition group-hover:translate-x-0.5">
                <path d="M5 12h14M13 5l7 7-7 7" />
              </svg>
            </Link>
            <a
              href="#estudio"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.03] px-5 py-3 text-[14px] font-medium text-white/85 backdrop-blur transition hover:border-white/25 hover:bg-white/[0.06]"
            >
              Ver demo en 60 seg
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12l7 7 7-7" />
              </svg>
            </a>
          </div>

          {/* Microproof — pruebas para marcas */}
          <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-3 text-[12px] text-white/55">
            <div className="flex items-center gap-2">
              <Stars />
              <span><strong className="text-white">4.9/5</strong> · 312 marcas escalando</span>
            </div>
            <div className="hidden h-4 w-px bg-white/15 sm:block" />
            <div><strong className="text-white">10x</strong> más contenido publicado</div>
            <div className="hidden h-4 w-px bg-white/15 sm:block" />
            <div>Sin set, sin shootings, sin freelancers</div>
          </div>
        </div>

        {/* Esfera 3D */}
        <div className="relative" data-reveal>
          <OrchestraSphere />
          {/* Cards flotantes alrededor */}
          <FloatingCard
            className="absolute -left-2 top-2 hidden md:block"
            label="brief de marca"
            value="Lanzar colección Q3"
            tone="violet"
          />
          <FloatingCard
            className="absolute right-0 top-1/3 hidden md:block"
            label="creativo · ángulos"
            value="3 conceptos · 12 hooks"
            tone="cyan"
          />
          <FloatingCard
            className="absolute -bottom-2 left-1/4 hidden md:block"
            label="entrega"
            value="42 piezas para Meta + TikTok"
            tone="rose"
          />
        </div>
      </div>

      {/* Logo strip */}
      <div className="relative border-y border-white/5 bg-white/[0.015] py-7">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-[#0a0a0a] to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-[#0a0a0a] to-transparent" />
        <div className="overflow-hidden">
          <div className="marquee flex w-max items-center gap-14 whitespace-nowrap pl-14 pr-14">
            {[...logos, ...logos].map((name, i) => (
              <span key={i} className="font-display text-[20px] font-semibold tracking-tight text-white/40">
                {name}
              </span>
            ))}
          </div>
        </div>
        <div className="mx-auto mt-3 max-w-7xl px-5 md:px-8">
          <p className="text-center text-[11px] uppercase tracking-[0.24em] text-white/35">
            Marcas que ya escalan su contenido con Riverz
          </p>
        </div>
      </div>
    </section>
  );
}

function FloatingCard({
  className = '',
  label,
  value,
  tone = 'cyan',
}: {
  className?: string;
  label: string;
  value: string;
  tone?: 'cyan' | 'violet' | 'rose';
}) {
  const tones = {
    cyan: 'from-[#14E0CC]/30 to-transparent text-[#14E0CC]',
    violet: 'from-[#A78BFA]/30 to-transparent text-[#A78BFA]',
    rose: 'from-[#F472B6]/30 to-transparent text-[#F472B6]',
  } as const;
  return (
    <div className={`glass-strong float-y rounded-2xl p-3 pr-4 shadow-2xl ${className}`}>
      <div className="flex items-center gap-2.5">
        <span className={`grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br ${tones[tone]}`}>
          <span className="h-2 w-2 rounded-full bg-current shadow-[0_0_10px_currentColor]" />
        </span>
        <div>
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/45">{label}</div>
          <div className="text-[13px] font-semibold text-white">{value}</div>
        </div>
      </div>
    </div>
  );
}

function Stars() {
  return (
    <span className="flex items-center gap-0.5 text-[#FBBF24]">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2l2.9 6.9L22 10l-5.5 4.8L18 22l-6-3.6L6 22l1.5-7.2L2 10l7.1-1.1L12 2z" />
        </svg>
      ))}
    </span>
  );
}
