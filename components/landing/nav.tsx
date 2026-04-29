'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';

const links = [
  { href: '#estudio', label: 'Por qué Riverz' },
  { href: '#equipo', label: 'Tu equipo IA' },
  { href: '#flujo', label: 'Cómo funciona' },
  { href: '#contenido', label: 'Contenido' },
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
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled ? 'backdrop-blur-xl bg-black/40 border-b border-white/5' : 'bg-transparent'
      }`}
    >
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3 md:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="relative grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-[#14E0CC] via-[#07A498] to-[#0a0a0a] shadow-[0_0_24px_rgba(20,224,204,0.4)]">
            <span className="absolute inset-0 rounded-xl ring-1 ring-white/15" />
            <span className="text-sm font-bold text-black">R</span>
          </span>
          <span className="font-display text-lg font-semibold tracking-tight">Riverz</span>
          <span className="ml-1 hidden rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-white/60 sm:inline">
            Studio para marcas
          </span>
        </Link>

        <ul className="hidden items-center gap-7 md:flex">
          {links.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                className="text-[13px] font-medium text-white/65 transition hover:text-white"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          <Link
            href="/sign-in"
            className="hidden rounded-full px-4 py-2 text-[13px] font-medium text-white/75 transition hover:text-white sm:inline-block"
          >
            Iniciar sesión
          </Link>
          <Link
            href="/sign-up"
            className="group relative inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[13px] font-semibold text-black shadow-[0_8px_24px_-8px_rgba(20,224,204,0.6)] transition hover:bg-[#14E0CC]"
          >
            Empezar gratis
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="transition group-hover:translate-x-0.5">
              <path d="M5 12h14M13 5l7 7-7 7" />
            </svg>
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="ml-1 grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/5 text-white/80 md:hidden"
            aria-label="Abrir menú"
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </nav>

      {open && (
        <div className="border-t border-white/5 bg-black/85 backdrop-blur-xl md:hidden">
          <ul className="flex flex-col px-6 py-4">
            {links.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="block py-3 text-[15px] font-medium text-white/80"
                >
                  {l.label}
                </a>
              </li>
            ))}
            <li className="mt-2 border-t border-white/5 pt-3">
              <Link href="/sign-in" className="block py-2 text-[15px] font-medium text-white/80">
                Iniciar sesión
              </Link>
            </li>
          </ul>
        </div>
      )}
    </header>
  );
}
