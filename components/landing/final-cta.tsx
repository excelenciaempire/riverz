import Link from 'next/link';

export function FinalCTA() {
  return (
    <section className="relative overflow-hidden py-24 md:py-32">
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-grid bg-grid-fade opacity-30" />
        <div className="aurora opacity-90" />
      </div>

      <div className="mx-auto max-w-4xl px-5 text-center md:px-8">
        <div className="relative" data-reveal>
          <div className="pointer-events-none absolute -top-10 left-1/2 h-32 w-32 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(20,224,204,0.6),transparent_70%)] blur-2xl" />
          <span className="relative inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.2em] text-white/70 backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-[#14E0CC] shadow-[0_0_10px_#14E0CC]" />
            Listo para tu marca
          </span>
          <h2 className="font-display mt-6 text-[clamp(34px,7vw,84px)] font-semibold leading-[0.98] tracking-tight">
            Tu próxima campaña
            <br />
            <span className="text-gradient-primary">empieza hoy.</span>
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-[15px] leading-relaxed text-white/60 md:text-[17px]">
            Estamos cerrando registros para preparar la próxima oleada. Únete a la
            lista de espera y te avisaremos en cuanto abramos cupos.
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/sign-up"
              className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-7 py-4 text-[15px] font-semibold text-black shadow-[0_22px_50px_-12px_rgba(20,224,204,0.55)] transition hover:translate-y-[-1px] sm:w-auto"
            >
              Únete a la lista de espera
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="transition group-hover:translate-x-0.5">
                <path d="M5 12h14M13 5l7 7-7 7" />
              </svg>
            </Link>
            <Link
              href="/sign-in"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.03] px-6 py-4 text-[15px] font-medium text-white/85 backdrop-blur transition hover:border-white/25 hover:bg-white/[0.06] sm:w-auto"
            >
              Iniciar sesión
            </Link>
          </div>

          <p className="mt-6 text-[12px] text-white/40">
            312 marcas activas · 1.2M+ assets entregados · Soporte humano en español
          </p>
        </div>
      </div>
    </section>
  );
}
