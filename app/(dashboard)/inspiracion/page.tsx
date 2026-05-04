'use client';

export default function InspiracionPage() {
  return (
    <div className="space-y-8">
      <section className="page-hero">
        <p className="app-v2-eyebrow">Inspiración</p>
        <h1 className="app-v2-page-h1 mt-2">
          Tendencias.
          <br />
          <span className="text-[var(--rvz-ink-muted)]">Lo que vende ahora.</span>
        </h1>
        <p className="mt-4 max-w-xl text-[14px] leading-relaxed text-[var(--rvz-ink-muted)]">
          El Investigador trae lo que está corriendo en tu nicho — referencias visuales,
          ángulos ganadores y formatos en alza para alimentar a tus agentes.
        </p>
      </section>

      <div className="card-cream flex flex-col items-center gap-3 p-12 text-center">
        <span className="app-v2-eyebrow">Próximamente</span>
        <h2 className="text-[22px] font-medium tracking-tight">Sección en desarrollo</h2>
        <p className="max-w-md text-[13px] text-[var(--rvz-ink-muted)]">
          Pronto vas a encontrar acá un feed curado de ads ganadores, hooks recientes y
          referencias visuales por categoría.
        </p>
      </div>
    </div>
  );
}
