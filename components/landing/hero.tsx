'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { HeroScene3D } from './hero-scene-loader';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

const TITLE_LINES: { text: string; tone: 'white' | 'gradient' | 'soft' }[] = [
  { text: 'El estudio',           tone: 'white'    },
  { text: 'que produce',          tone: 'white'    },
  { text: 'sin parar',            tone: 'gradient' },
  { text: 'por tu marca.',        tone: 'soft'     },
];

const logos = ['Atlas', 'Northwave', 'Lumen', 'Ferrara', 'Kade', 'Voltic', 'Mira', 'Stellar'];

export function Hero() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;

    const ctx = gsap.context(() => {
      // Title char-by-char reveal (estilo Apple)
      const chars = el.querySelectorAll<HTMLElement>('[data-hero-char]');
      gsap.set(chars, { yPercent: 110, opacity: 0, rotateX: -45 });
      gsap.to(chars, {
        yPercent: 0,
        opacity: 1,
        rotateX: 0,
        duration: 1.1,
        ease: 'expo.out',
        stagger: 0.012,
        delay: 0.25,
      });

      // Subtítulo / CTAs / proof
      gsap.from('[data-hero-fade]', {
        opacity: 0,
        y: 24,
        duration: 1,
        stagger: 0.12,
        delay: 1.05,
        ease: 'power3.out',
      });

      // Parallax + escala del canvas 3D según scroll
      gsap.to('[data-hero-canvas]', {
        scale: 1.18,
        yPercent: -8,
        ease: 'none',
        scrollTrigger: {
          trigger: el,
          start: 'top top',
          end: 'bottom top',
          scrub: true,
        },
      });

      // Fade-out del texto del hero al hacer scroll (el lienzo permanece visible)
      gsap.to('[data-hero-text]', {
        opacity: 0,
        y: -40,
        ease: 'none',
        scrollTrigger: {
          trigger: el,
          start: 'top top',
          end: '+=600',
          scrub: true,
        },
      });
    }, el);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={root}
      className="relative isolate overflow-hidden pt-28 md:pt-32"
      style={{ minHeight: '100vh' }}
    >
      {/* Fondo cinemático */}
      <div className="absolute inset-0 -z-10">
        <div className="aurora" />
        <div className="absolute inset-0 bg-grid bg-grid-fade" />
        <div className="absolute inset-0 bg-noise opacity-[0.35] mix-blend-overlay" />
        <div className="absolute inset-x-0 top-0 h-[80%] bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(20,224,204,0.18),transparent_70%)]" />
      </div>

      {/* Canvas 3D — toma toda la pantalla detrás del texto */}
      <div
        data-hero-canvas
        className="pointer-events-none absolute inset-0 -z-[5] mx-auto h-full w-full max-w-[1600px]"
        style={{ willChange: 'transform' }}
      >
        {/* Fallback CSS visible incluso sin WebGL: orb + halos + partículas */}
        <div className="absolute inset-0 grid place-items-center">
          <div className="relative h-[min(70vh,640px)] w-[min(70vh,640px)]">
            {/* Halo conic */}
            <div className="halo rounded-full" aria-hidden />
            {/* Orb principal con gradiente cinematográfico */}
            <div
              className="absolute inset-[12%] rounded-full"
              style={{
                background: 'radial-gradient(circle at 35% 28%, #FFFFFF 0%, #14E0CC 16%, #07A498 38%, #1a0a2e 65%, #0a0a0a 100%)',
                boxShadow:
                  '0 0 80px rgba(20,224,204,0.45), 0 0 180px rgba(139,92,246,0.30), inset -30px -30px 80px rgba(0,0,0,0.6), inset 20px 20px 60px rgba(255,255,255,0.06)',
                animation: 'orb-breath 6s ease-in-out infinite',
              }}
            />
            {/* Anillo exterior */}
            <div
              className="absolute inset-0 rounded-full border border-[#14E0CC]/20"
              style={{ animation: 'orb-spin 28s linear infinite' }}
            />
            <div
              className="absolute inset-[6%] rounded-full border border-dashed border-[#A78BFA]/15"
              style={{ animation: 'orb-spin 42s linear infinite reverse' }}
            />
            {/* Partículas fijas alrededor */}
            {Array.from({ length: 14 }).map((_, i) => {
              const a = (i / 14) * Math.PI * 2;
              const r = 50 + (i % 3) * 6;
              const left = 50 + Math.cos(a) * r;
              const top = 50 + Math.sin(a) * r;
              const size = 4 + (i % 3) * 2;
              const hue = ['#14E0CC', '#A78BFA', '#F472B6', '#F59E0B'][i % 4];
              return (
                <span
                  key={i}
                  className="absolute float-y rounded-full"
                  style={{
                    left: `${left}%`,
                    top: `${top}%`,
                    width: size,
                    height: size,
                    background: hue,
                    boxShadow: `0 0 14px ${hue}`,
                    animationDelay: `${i * 0.3}s`,
                  }}
                />
              );
            })}
          </div>
        </div>
        {/* Encima: la escena 3D real (cuando WebGL está disponible) */}
        <div className="absolute inset-0">
          <HeroScene3D />
        </div>
      </div>

      <div className="relative mx-auto flex min-h-[80vh] max-w-7xl flex-col items-center justify-center gap-10 px-5 pb-16 text-center md:px-8 md:pb-24">
        <div data-hero-text className="relative">
          <div data-hero-fade className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-white/70 backdrop-blur">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#14E0CC] opacity-70" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#14E0CC]" />
            </span>
            Riverz · Studio para marcas
          </div>

          <h1 className="font-display mx-auto mt-7 max-w-5xl text-[clamp(44px,9vw,140px)] font-semibold leading-[0.92] tracking-[-0.04em]">
            {TITLE_LINES.map((line, li) => (
              <span key={li} className="block overflow-hidden pb-[0.06em]">
                <span className="inline-block" style={{ perspective: '600px' }}>
                  {Array.from(line.text).map((ch, ci) => (
                    <span
                      key={ci}
                      data-hero-char
                      className={`inline-block ${
                        line.tone === 'gradient'
                          ? 'text-gradient-primary'
                          : line.tone === 'soft'
                            ? 'text-white/70'
                            : 'text-white'
                      }`}
                      style={{ willChange: 'transform, opacity' }}
                    >
                      {ch === ' ' ? ' ' : ch}
                    </span>
                  ))}
                </span>
              </span>
            ))}
          </h1>

          <p
            data-hero-fade
            className="mx-auto mt-7 max-w-2xl text-balance text-[15px] leading-relaxed text-white/65 md:text-[18px]"
          >
            UGC, anuncios estáticos, foto de producto y video — producidos con la
            consistencia de tu marca, listos para vender en Meta, TikTok y tu tienda.
            <span className="block text-white/45">Sin equipo, sin set, sin esperar.</span>
          </p>

          <div data-hero-fade className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/sign-up"
              className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full bg-white px-7 py-4 text-[14px] font-semibold text-black shadow-[0_24px_60px_-12px_rgba(20,224,204,0.55)] transition hover:translate-y-[-1px]"
            >
              <span className="relative z-10">Empieza a producir</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="relative z-10 transition group-hover:translate-x-0.5">
                <path d="M5 12h14M13 5l7 7-7 7" />
              </svg>
            </Link>
            <a
              href="#estudio"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.03] px-6 py-4 text-[14px] font-medium text-white/85 backdrop-blur transition hover:border-white/25 hover:bg-white/[0.06]"
            >
              Ver demo
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12l7 7 7-7" />
              </svg>
            </a>
          </div>

          <div data-hero-fade className="mt-12 flex flex-wrap items-center justify-center gap-x-7 gap-y-3 text-[12px] text-white/55">
            <div className="flex items-center gap-2">
              <Stars />
              <span><strong className="text-white">4.9/5</strong> · 312 marcas</span>
            </div>
            <span className="hidden h-4 w-px bg-white/15 sm:block" />
            <div><strong className="text-white">10×</strong> más contenido publicado</div>
            <span className="hidden h-4 w-px bg-white/15 sm:block" />
            <div>Sin set, sin shootings</div>
          </div>
        </div>
      </div>

      {/* Logo strip */}
      <div className="relative border-y border-white/5 bg-white/[0.015] py-6">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-[#0a0a0a] to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-[#0a0a0a] to-transparent" />
        <div className="overflow-hidden">
          <div className="marquee flex w-max items-center gap-14 whitespace-nowrap pl-14 pr-14">
            {[...logos, ...logos].map((name, i) => (
              <span key={i} className="font-display text-[20px] font-semibold tracking-tight text-white/40">
                {name}
              </span>
            ))}
          </div>
        </div>
        <div className="mx-auto mt-3 max-w-7xl px-5 md:px-8">
          <p className="text-center text-[11px] uppercase tracking-[0.24em] text-white/35">
            Marcas que ya escalan su contenido con Riverz
          </p>
        </div>
      </div>

      {/* Scroll hint */}
      <div className="pointer-events-none absolute bottom-32 left-1/2 hidden -translate-x-1/2 md:flex" data-hero-fade>
        <div className="flex flex-col items-center gap-2 text-white/35">
          <span className="text-[10px] uppercase tracking-[0.32em]">Scroll</span>
          <span className="relative h-9 w-px overflow-hidden">
            <span className="absolute inset-x-0 top-0 h-3 w-px bg-white/60" style={{ animation: 'scroll-hint 2.4s ease-in-out infinite' }} />
          </span>
        </div>
      </div>
      <style jsx>{`
        @keyframes scroll-hint {
          0%   { transform: translateY(-100%); opacity: 0; }
          50%  { opacity: 1; }
          100% { transform: translateY(100%); opacity: 0; }
        }
      `}</style>
    </section>
  );
}

function Stars() {
  return (
    <span className="flex items-center gap-0.5 text-[#FBBF24]">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2l2.9 6.9L22 10l-5.5 4.8L18 22l-6-3.6L6 22l1.5-7.2L2 10l7.1-1.1L12 2z" />
        </svg>
      ))}
    </span>
  );
}
