'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';

const links = [
  { href: '#estudio', label: 'Estudio' },
  { href: '#modelos', label: 'Modelos' },
  { href: '#agentes', label: 'Agentes' },
  { href: '#flujos', label: 'Flujos' },
  { href: '#planes', label: 'Planes' },
];

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className="sticky top-0 z-40">
      <div className="lv2-announce">
        <span>Riverz · Estudio creativo IA para marcas de e-commerce. </span>
        <Link href="/sign-up" className="ml-2 underline underline-offset-2 hover:text-[#f7ff9e]">
          Únete a la lista de espera →
        </Link>
      </div>

      <nav
        className={`flex items-center gap-6 px-5 md:px-9 transition-all ${
          scrolled ? 'border-b border-black/10 bg-[#fafaf7]/95 backdrop-blur-md py-3' : 'py-4'
        }`}
      >
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-[#0a0a0a] text-[12px] font-bold text-[#f7ff9e]">
            R
          </span>
          <span className="font-editorial text-[18px] font-semibold tracking-tight">Riverz</span>
        </Link>

        <ul className="ml-auto hidden items-center gap-6 md:flex">
          {links.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                className="editorial-eyebrow text-black/70 transition hover:text-black"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="ml-auto flex items-center gap-3 md:ml-0">
          <Link
            href="/sign-in"
            className="editorial-eyebrow hidden text-black/70 transition hover:text-black sm:inline"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="lv2-yellow editorial-eyebrow inline-flex items-center gap-1.5 rounded-md px-4 py-2.5 font-bold transition"
          >
            Lista de espera
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="grid h-9 w-9 place-items-center rounded-md border border-black/15 text-black/70 md:hidden"
            aria-label="Abrir menú"
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </nav>

      {open && (
        <div className="border-b border-black/10 bg-[#fafaf7] md:hidden">
          <ul className="flex flex-col px-5 py-3">
            {links.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="editorial-eyebrow block py-3 text-black/80"
                >
                  {l.label}
                </a>
              </li>
            ))}
            <li className="border-t border-black/10 pt-3">
              <Link href="/sign-in" className="editorial-eyebrow block py-2 text-black/80">
                Sign in
              </Link>
            </li>
          </ul>
        </div>
      )}
    </header>
  );
}
