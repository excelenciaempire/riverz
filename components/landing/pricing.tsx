import Link from 'next/link';
import { Check } from 'lucide-react';

type Plan = {
  name: string;
  price: string;
  cadence: string;
  description: string;
  credits: string;
  features: string[];
  cta: string;
  highlight?: boolean;
};

const plans: Plan[] = [
  {
    name: 'Starter',
    price: '$19',
    cadence: '/mes',
    description: 'Para marcas que están empezando a producir contenido en serio.',
    credits: '2.000 créditos / mes',
    features: [
      'Hasta 20 anuncios estáticos / mes',
      'Hasta 6 videos UGC con avatares',
      'Edición y catálogo de producto',
      'Identidad de marca memorizada',
    ],
    cta: 'Unirme a la lista de espera',
  },
  {
    name: 'Pro',
    price: '$49',
    cadence: '/mes',
    description: 'Para DTC en crecimiento que necesita feed activo todos los días.',
    credits: '6.000 créditos / mes',
    features: [
      'Anuncios estáticos ilimitados',
      'UGC + clips multilingüe',
      'Mejora a 4K en piezas premium',
      'Performance loop con A/B test',
      'Onboarding asistido',
    ],
    cta: 'Unirme a la lista de espera',
    highlight: true,
  },
  {
    name: 'Scale',
    price: '$99',
    cadence: '/mes',
    description: 'Para marcas multi-mercado que pautan en varios canales y países.',
    credits: '15.000 créditos / mes',
    features: [
      'Todo lo de Pro',
      'Multi-marca y multi-mercado',
      'Voz y guion multilingüe (12+ idiomas)',
      'Manager creativo dedicado',
      'API y workflows custom',
    ],
    cta: 'Unirme a la lista de espera',
  },
];

export function Pricing() {
  return (
    <section id="planes" className="relative overflow-hidden py-24 md:py-32">
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-x-0 top-1/2 h-[60%] -translate-y-1/2 bg-[radial-gradient(ellipse_60%_50%_at_50%_50%,rgba(20,224,204,0.08),transparent_70%)]" />
      </div>

      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <div className="mx-auto max-w-3xl text-center" data-reveal>
          <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#14E0CC]">
            Planes
          </span>
          <h2 className="font-display mt-4 text-[clamp(28px,5vw,56px)] font-semibold leading-[1.05] tracking-tight">
            Menos que un freelancer.
            <br className="hidden sm:block" />
            {' '}<span className="text-gradient-primary">Más que un estudio.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-[15px] leading-relaxed text-white/60 md:text-[16px]">
            Empieza gratis. Escala cuando tu marca lo pida. Cancela cuando quieras.
          </p>
        </div>

        <div className="mt-14 grid gap-4 lg:grid-cols-3">
          {plans.map((p, i) => (
            <div
              key={p.name}
              data-reveal
              style={{ transitionDelay: `${i * 80}ms` }}
              className={`relative overflow-hidden rounded-3xl p-6 sm:p-8 ${
                p.highlight
                  ? 'border border-[#14E0CC]/40 bg-gradient-to-b from-[#0c1a18] via-[#0a0a0a] to-[#120c1c] ring-1 ring-[#14E0CC]/20'
                  : 'border border-white/[0.08] bg-white/[0.02]'
              }`}
            >
              {p.highlight && <div className="halo rounded-3xl" aria-hidden />}
              {p.highlight && (
                <span className="absolute right-5 top-5 rounded-full border border-[#14E0CC]/40 bg-[#14E0CC]/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#14E0CC]">
                  Más popular
                </span>
              )}
              <div className="relative">
                <div className="text-[12px] font-semibold uppercase tracking-[0.2em] text-white/55">
                  {p.name}
                </div>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="font-display text-[44px] font-semibold leading-none tracking-tight text-white sm:text-[52px]">
                    {p.price}
                  </span>
                  <span className="text-[14px] text-white/45">{p.cadence}</span>
                </div>
                <p className="mt-3 text-[13px] text-white/60">{p.description}</p>

                <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#14E0CC] shadow-[0_0_8px_#14E0CC]" />
                  {p.credits}
                </div>

                <ul className="mt-6 space-y-2.5">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-[13px] text-white/75">
                      <span className="mt-0.5 grid h-4 w-4 flex-shrink-0 place-items-center rounded-full bg-[#14E0CC]/15 text-[#14E0CC]">
                        <Check size={11} strokeWidth={3} />
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>

                <Link
                  href="/sign-up"
                  className={`mt-7 inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-[14px] font-semibold transition ${
                    p.highlight
                      ? 'bg-white text-black hover:bg-[#14E0CC]'
                      : 'border border-white/15 bg-white/[0.03] text-white hover:bg-white/[0.08]'
                  }`}
                >
                  {p.cta}
                </Link>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-10 text-center text-[12px] text-white/40">
          Empieza gratis · Sin tarjeta · Cancela cuando quieras
        </p>
      </div>
    </section>
  );
}
