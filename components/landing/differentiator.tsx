export function Differentiator() {
  return (
    <section id="estudio" className="relative overflow-hidden py-24 md:py-32">
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-grid bg-grid-fade opacity-50" />
        <div className="absolute inset-x-0 top-1/2 h-[60%] -translate-y-1/2 bg-[radial-gradient(ellipse_50%_60%_at_50%_50%,rgba(139,92,246,0.12),transparent_70%)]" />
      </div>

      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <div className="mx-auto max-w-3xl text-center" data-reveal>
          <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#14E0CC]">
            Por qué Riverz es distinto
          </span>
          <h2 className="font-display mt-4 text-[clamp(28px,5vw,56px)] font-semibold leading-[1.05] tracking-tight">
            Otras apps te dan una IA suelta.<br className="hidden sm:block" />
            {' '}Riverz te da{' '}
            <span className="text-gradient-primary">un estudio creativo.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-[15px] leading-relaxed text-white/60 md:text-[16px]">
            Producir contenido para tu marca no es escribir un prompt: es investigar,
            conceptualizar, diseñar, filmar, editar y publicar. Riverz hace todo eso
            por ti — con la misma identidad, una y otra vez.
          </p>
        </div>

        <div className="mt-14 grid items-stretch gap-5 lg:grid-cols-2">
          {/* Wrapper genérico */}
          <div
            className="glass relative overflow-hidden rounded-3xl p-6 sm:p-7 md:p-9"
            data-reveal
          >
            <Tag tone="muted">El resto del mercado</Tag>
            <h3 className="font-display mt-3 text-[22px] font-semibold text-white/85 sm:text-[24px]">
              Una IA suelta y un prompt en blanco
            </h3>
            <p className="mt-2 text-[14px] text-white/55">
              Te dan una caja de texto. Tú haces de director, copywriter, diseñador
              y editor. Cada pieza sale distinta — la marca, perdida.
            </p>

            <WrapperDiagram />

            <ul className="mt-6 space-y-2 text-[13px] text-white/55">
              <ConItem>Empiezas de cero en cada pieza</ConItem>
              <ConItem>La marca se ve distinta en cada anuncio</ConItem>
              <ConItem>Necesitas saber prompts y editar tú</ConItem>
              <ConItem>Resultados aleatorios, sin estrategia</ConItem>
            </ul>
          </div>

          {/* Riverz */}
          <div
            className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0c1a18] via-[#0a0a0a] to-[#120c1c] p-6 ring-1 ring-[#14E0CC]/20 sm:p-7 md:p-9"
            data-reveal
          >
            <div className="halo rounded-3xl" aria-hidden />
            <Tag tone="accent">Riverz · Studio</Tag>
            <h3 className="font-display mt-3 text-[22px] font-semibold text-white sm:text-[24px]">
              Un equipo creativo que conoce tu marca
            </h3>
            <p className="mt-2 text-[14px] text-white/65">
              Especialistas de IA que investigan tu audiencia, escriben los hooks,
              diseñan, filman con avatares y entregan piezas listas para Meta,
              TikTok y tu tienda.
            </p>

            <RiverzDiagram />

            <ul className="mt-6 space-y-2 text-[13px] text-white/75">
              <ProItem>Tu marca, voz y producto memorizados</ProItem>
              <ProItem>Estrategia de campaña antes de producir</ProItem>
              <ProItem>Cada pieza con tu identidad consistente</ProItem>
              <ProItem>Listo para publicar, sin retoque manual</ProItem>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function Tag({ children, tone }: { children: React.ReactNode; tone: 'muted' | 'accent' }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${
        tone === 'accent'
          ? 'border border-[#14E0CC]/30 bg-[#14E0CC]/10 text-[#14E0CC]'
          : 'border border-white/10 bg-white/[0.04] text-white/55'
      }`}
    >
      {tone === 'accent' && <span className="h-1.5 w-1.5 rounded-full bg-[#14E0CC] shadow-[0_0_8px_#14E0CC]" />}
      {children}
    </span>
  );
}

function ConItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="mt-1.5 inline-block h-1 w-1 rounded-full bg-white/30" />
      <span>{children}</span>
    </li>
  );
}

function ProItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#14E0CC"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="mt-0.5 flex-shrink-0"
      >
        <path d="M5 12l4 4L19 7" />
      </svg>
      <span>{children}</span>
    </li>
  );
}

/** Diagrama "wrapper": brief → modelo único → output */
function WrapperDiagram() {
  return (
    <svg
      viewBox="0 0 480 200"
      className="mt-6 w-full"
      role="img"
      aria-label="Wrapper sobre un LLM único"
    >
      <defs>
        <linearGradient id="wrapline" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#ffffff20" />
          <stop offset="100%" stopColor="#ffffff10" />
        </linearGradient>
      </defs>
      {/* brief */}
      <g transform="translate(20,80)">
        <rect width="80" height="40" rx="10" fill="#ffffff08" stroke="#ffffff20" />
        <text x="40" y="25" textAnchor="middle" fill="#ffffff80" fontSize="11" fontWeight="600">brief</text>
      </g>
      {/* línea */}
      <line x1="100" y1="100" x2="200" y2="100" stroke="url(#wrapline)" strokeWidth="2" />
      {/* LLM */}
      <g transform="translate(200,60)">
        <rect width="100" height="80" rx="14" fill="#1a1a1a" stroke="#ffffff15" />
        <text x="50" y="35" textAnchor="middle" fill="#ffffff60" fontSize="10" fontWeight="600" letterSpacing="2">LLM</text>
        <text x="50" y="55" textAnchor="middle" fill="#ffffff35" fontSize="9">single model</text>
      </g>
      {/* línea */}
      <line x1="300" y1="100" x2="400" y2="100" stroke="url(#wrapline)" strokeWidth="2" />
      {/* output */}
      <g transform="translate(400,80)">
        <rect width="60" height="40" rx="10" fill="#ffffff05" stroke="#ffffff15" strokeDasharray="4 4" />
        <text x="30" y="25" textAnchor="middle" fill="#ffffff45" fontSize="11">?</text>
      </g>
    </svg>
  );
}

/** Diagrama Riverz: brief → orquestador → 4 agentes → assets */
function RiverzDiagram() {
  return (
    <svg
      viewBox="0 0 480 220"
      className="mt-6 w-full"
      role="img"
      aria-label="Orquestación multi-agente Riverz"
    >
      <defs>
        <linearGradient id="rline" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#14E0CC" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#14E0CC" stopOpacity="0.7" />
        </linearGradient>
        <radialGradient id="rcore">
          <stop offset="0%" stopColor="#14E0CC" />
          <stop offset="100%" stopColor="#07A498" stopOpacity="0.4" />
        </radialGradient>
      </defs>

      {/* brief */}
      <g transform="translate(10,90)">
        <rect width="80" height="40" rx="10" fill="#ffffff08" stroke="#14E0CC44" />
        <text x="40" y="25" textAnchor="middle" fill="#ffffffcc" fontSize="11" fontWeight="600">brief</text>
      </g>

      {/* orquestador */}
      <g transform="translate(200,75)">
        <circle cx="35" cy="35" r="34" fill="url(#rcore)" opacity="0.85" />
        <circle cx="35" cy="35" r="34" fill="none" stroke="#14E0CC" strokeOpacity="0.6" />
        <text x="35" y="32" textAnchor="middle" fill="#0a0a0a" fontSize="9" fontWeight="700" letterSpacing="1.5">RIVERZ</text>
        <text x="35" y="44" textAnchor="middle" fill="#0a0a0a" fontSize="7" fontWeight="600" letterSpacing="1">ORCHESTRATOR</text>
      </g>

      {/* línea brief→orq */}
      <path d="M 90 110 C 140 110 150 110 200 110" fill="none" stroke="url(#rline)" strokeWidth="2" className="flow-path" />

      {/* 4 agentes a la derecha */}
      {[
        { y: 30,  label: 'Insight',  hue: '#14E0CC' },
        { y: 80,  label: 'Concept',  hue: '#A78BFA' },
        { y: 130, label: 'Visual',   hue: '#F472B6' },
        { y: 180, label: 'Motion',   hue: '#F59E0B' },
      ].map((a) => (
        <g key={a.label}>
          <path
            d={`M 270 110 C 320 110 330 ${a.y + 15} 380 ${a.y + 15}`}
            fill="none"
            stroke={a.hue}
            strokeOpacity="0.55"
            strokeWidth="1.6"
            className="flow-path"
          />
          <g transform={`translate(380,${a.y})`}>
            <rect width="84" height="30" rx="8" fill="#0a0a0a" stroke={a.hue} strokeOpacity="0.5" />
            <circle cx="14" cy="15" r="4" fill={a.hue} className="flow-dot" />
            <text x="26" y="19" fill="#ffffffd0" fontSize="11" fontWeight="600">{a.label}</text>
          </g>
        </g>
      ))}
    </svg>
  );
}
