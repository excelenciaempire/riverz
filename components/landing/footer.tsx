import Link from 'next/link';

const groups = [
  {
    title: 'Producto',
    links: [
      { label: 'UGC con avatares', href: '#contenido' },
      { label: 'Anuncios estáticos', href: '#contenido' },
      { label: 'Foto de producto', href: '#contenido' },
      { label: 'Mejora a 4K', href: '#contenido' },
    ],
  },
  {
    title: 'Marca',
    links: [
      { label: 'Casos de éxito', href: '#' },
      { label: 'Cómo funciona', href: '#flujo' },
      { label: 'Tu equipo IA', href: '#equipo' },
      { label: 'Planes', href: '#planes' },
    ],
  },
  {
    title: 'Empresa',
    links: [
      { label: 'Sobre Riverz', href: '#' },
      { label: 'Blog', href: '#' },
      { label: 'Contacto', href: '#' },
      { label: 'Soporte', href: '#' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Términos', href: '#' },
      { label: 'Privacidad', href: '#' },
      { label: 'Cookies', href: '#' },
      { label: 'Seguridad', href: '#' },
    ],
  },
];

export function LandingFooter() {
  return (
    <footer className="relative border-t border-white/5 bg-[#070707] py-16">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_2fr]">
          <div>
            <Link href="/" className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-[#14E0CC] via-[#07A498] to-[#0a0a0a] shadow-[0_0_24px_rgba(20,224,204,0.4)]">
                <span className="text-sm font-bold text-black">R</span>
              </span>
              <span className="font-display text-xl font-semibold tracking-tight">Riverz</span>
            </Link>
            <p className="mt-4 max-w-sm text-[13px] leading-relaxed text-white/55">
              El estudio creativo con IA para marcas de e-commerce. Anuncios, video,
              foto y catálogo — producidos con tu identidad, listos para vender.
            </p>
            <div className="mt-5 flex items-center gap-2.5">
              {['x', 'in', 'ig', 'tt'].map((s) => (
                <a
                  key={s}
                  href="#"
                  className="grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-white/[0.03] text-[10px] font-semibold uppercase text-white/55 transition hover:border-white/20 hover:text-white"
                >
                  {s}
                </a>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {groups.map((g) => (
              <div key={g.title}>
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">
                  {g.title}
                </div>
                <ul className="mt-4 space-y-2.5">
                  {g.links.map((l) => (
                    <li key={l.label}>
                      <a href={l.href} className="text-[13px] text-white/65 transition hover:text-white">
                        {l.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-14 flex flex-col items-start justify-between gap-4 border-t border-white/5 pt-6 text-[12px] text-white/40 sm:flex-row sm:items-center">
          <span>© {new Date().getFullYear()} Riverz · Hecho para marcas que escalan.</span>
          <span>Hecho con cariño en Latinoamérica</span>
        </div>
      </div>
    </footer>
  );
}
