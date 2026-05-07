import Link from 'next/link';

const footerCols: { title: string; items: { label: string; href: string }[] }[] = [
  {
    title: 'Empezar',
    items: [
      { label: 'Lista de espera', href: '/sign-up' },
      { label: 'Sign in', href: '/sign-in' },
      { label: 'Demo', href: '#why' },
    ],
  },
  {
    title: 'Producto',
    items: [
      { label: 'Research', href: '#research' },
      { label: 'Static Ads', href: '#static-ads' },
      { label: 'UGC', href: '#ugc' },
      { label: 'Landing Lab', href: '#landing-lab' },
      { label: 'Meta Ads', href: '#meta-ads' },
    ],
  },
  {
    title: 'Compañía',
    items: [
      { label: 'Sobre Riverz', href: '#why' },
      { label: 'Blog', href: '#' },
      { label: 'Contacto', href: 'mailto:hola@riverz.app' },
    ],
  },
  {
    title: 'Legal',
    items: [
      { label: 'Privacidad', href: '#' },
      { label: 'Términos', href: '#' },
    ],
  },
];

export function FinalCtaSection() {
  return (
    <section id="final-cta" className="lv3-bg-sage relative overflow-hidden">
      <div className="mx-auto max-w-[1480px] px-5 py-28 md:px-9 md:py-40">
        <p className="editorial-eyebrow text-black/55">Empezá hoy</p>
        <div className="mt-6 grid items-end gap-2 md:grid-cols-2 md:gap-12">
          <h2 className="editorial-h1 text-black">Inteligencia artificial</h2>
          <h2 className="editorial-h1 text-black/85">+ visión de marca.</h2>
        </div>

        <p className="mt-10 max-w-[680px] text-[15px] leading-relaxed text-black/70 md:text-[17px]">
          Riverz es el estudio creativo donde una marca de e-commerce orquesta
          investigación, anuncios, foto, video y landing pages — sin abrir cuatro
          herramientas, sin perder consistencia, sin esperar a la agencia.
        </p>

        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Link
            href="/sign-up"
            className="lv2-yellow editorial-eyebrow inline-flex items-center gap-2 rounded-md px-6 py-3.5 text-[12px] font-bold transition hover:scale-[1.02]"
          >
            Únete a la lista de espera →
          </Link>
          <Link
            href="/sign-in"
            className="editorial-eyebrow inline-flex items-center gap-2 rounded-md border border-black/25 px-6 py-3.5 text-black/70 transition hover:border-black/50 hover:text-black"
          >
            Ya tengo cuenta
          </Link>
        </div>

        <div className="mt-24 grid grid-cols-2 gap-10 border-t border-black/15 pt-12 md:grid-cols-4">
          {footerCols.map((col) => (
            <div key={col.title}>
              <div className="editorial-eyebrow text-black/45">{col.title}</div>
              <ul className="mt-4 space-y-2.5">
                {col.items.map((it) => (
                  <li key={it.label}>
                    <a
                      href={it.href}
                      className="text-[14px] text-black/75 transition hover:text-black"
                    >
                      {it.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex items-center justify-between border-t border-black/15 pt-6">
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-[#0a0a0a] text-[10px] font-bold text-[#f7ff9e]">
              R
            </span>
            <span className="text-[13px] text-black/65">© Riverz · {new Date().getFullYear()}</span>
          </div>
          <span className="editorial-eyebrow text-black/45">Hecho con marca y software</span>
        </div>
      </div>
    </section>
  );
}
