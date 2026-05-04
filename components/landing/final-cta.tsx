import Link from 'next/link';

/**
 * Final hero — equivalent of Weave's sage closing block. Massive split
 * heading "Inteligencia Artificial + Visión de marca" on a calm green
 * surface, the wordmark, and the legal/footer block tucked underneath.
 */
export function FinalCTA() {
  return (
    <section id="planes" className="lv2-section-sage relative overflow-hidden">
      <div className="mx-auto max-w-[1480px] px-5 py-28 md:px-9 md:py-40">
        <div className="grid items-end gap-2 md:grid-cols-[1fr_auto_1fr] md:gap-8">
          <h2 className="editorial-h1 lv2-rv">
            Inteligencia
            <br />
            Artificial
          </h2>
          <span className="editorial-h1 lv2-rv text-center">+</span>
          <h2 className="editorial-h1 lv2-rv md:text-right">
            Visión
            <br />
            de marca
          </h2>
        </div>

        <div className="mt-20 grid gap-10 md:mt-32 md:grid-cols-[1fr_2fr] md:gap-16">
          <div>
            <div className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-md bg-[#0a0a0a] text-[14px] font-bold text-[#f7ff9e]">
                R
              </span>
              <span className="font-editorial text-[20px] font-semibold tracking-tight">
                Riverz
              </span>
            </div>
          </div>
          <p className="text-[14px] leading-relaxed text-black/75 md:text-[15px]">
            Riverz es una nueva forma de crear contenido. Acortamos la distancia entre lo que la
            IA puede hacer y lo que tu marca necesita, para que tu equipo creativo opere a la
            velocidad del mercado sin perder identidad.
          </p>
        </div>

        <div className="mt-16 grid gap-8 text-[12px] md:grid-cols-4 md:gap-12">
          <FooterCol
            title="Empezar"
            links={[
              { href: '/sign-up', label: 'Lista de espera' },
              { href: '/sign-in', label: 'Iniciar sesión' },
            ]}
          />
          <FooterCol
            title="Producto"
            links={[
              { href: '#agentes', label: 'Agentes' },
              { href: '#flujos', label: 'Flujos' },
              { href: '#modelos', label: 'Modelos' },
            ]}
          />
          <FooterCol
            title="Compañía"
            links={[
              { href: '#', label: 'Sobre Riverz' },
              { href: '#', label: 'Contacto' },
            ]}
          />
          <FooterCol
            title="Legal"
            links={[
              { href: '#', label: 'Términos' },
              { href: '#', label: 'Privacidad' },
            ]}
          />
        </div>

        <p className="mt-16 border-t border-black/15 pt-6 text-[11px] uppercase tracking-[0.16em] text-black/55">
          Riverz © {new Date().getFullYear()} · Todos los derechos reservados
        </p>
      </div>
    </section>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: Array<{ href: string; label: string }>;
}) {
  return (
    <div>
      <p className="editorial-eyebrow mb-3 text-black/45">{title}</p>
      <ul className="space-y-2">
        {links.map((l) => (
          <li key={l.label}>
            <Link
              href={l.href}
              className="text-[13px] uppercase tracking-[0.1em] text-black/80 hover:text-black"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
