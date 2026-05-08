'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';

const links = [
  { href: '#why', label: 'Por qué' },
  { href: '#research', label: 'Research' },
  { href: '#static-ads', label: 'Static Ads' },
  { href: '#ugc', label: 'UGC' },
  { href: '#meta-ads', label: 'Meta Ads' },
];

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Reveal nav after the first 60vh of scroll so the hero owns the first
    // viewport. Below that threshold, nav stays fully transparent.
    const onScroll = () => setScrolled(window.scrollY > Math.max(window.innerHeight * 0.6, 400));
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 transition-all duration-300 ${
        scrolled
          ? 'border-b border-black/10 bg-[#fafaf7]/85 backdrop-blur-md'
          : 'bg-transparent'
      }`}
    >
      <nav
        className={`mx-auto flex max-w-[1480px] items-center gap-6 px-5 transition-all md:px-9 ${
          scrolled ? 'py-3' : 'py-4'
        }`}
      >
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-[#0a0a0a] text-[12px] font-bold text-[#f7ff9e]">
            R
          </span>
          <span className="font-editorial text-[18px] font-semibold tracking-tight">
            Riverz
          </span>
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
            className="lv2-yellow editorial-eyebrow inline-flex items-center gap-1.5 rounded-md px-4 py-2.5 font-bold transition hover:scale-[1.02]"
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
              <Link
                href="/sign-in"
                className="editorial-eyebrow block py-2 text-black/80"
              >
                Sign in
              </Link>
            </li>
          </ul>
        </div>
      )}
    </header>
  );
}
