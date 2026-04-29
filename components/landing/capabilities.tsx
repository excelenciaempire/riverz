'use client';

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Film, Image as ImageIcon, Sparkles, ArrowUpRight, Wand2, Zap, ScanFace } from 'lucide-react';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

type Cap = {
  icon: React.ComponentType<{ size?: number }>;
  title: string;
  tag: string;
  desc: string;
  span: string;
  visual: 'ugc' | 'static' | 'clips' | 'face' | 'photo' | 'upscale';
  hue: string;
};

const caps: Cap[] = [
  {
    icon: Film,
    title: 'UGC con avatares',
    tag: 'Video',
    desc: 'Vende como un creador top sin contratar uno. Avatares humanos presentan tu producto en cualquier idioma.',
    span: 'lg:col-span-2 lg:row-span-2',
    visual: 'ugc',
    hue: '#F59E0B',
  },
  {
    icon: ImageIcon,
    title: 'Anuncios estáticos',
    tag: 'Performance',
    desc: 'Plantillas para Meta y TikTok con tu identidad. Lotes de variaciones para A/B testing.',
    span: 'lg:col-span-2',
    visual: 'static',
    hue: '#F472B6',
  },
  {
    icon: Sparkles,
    title: 'Clips para feed',
    tag: 'Reels · TikTok',
    desc: 'Clips cortos con hooks calibrados al feed. Listo para subir.',
    span: '',
    visual: 'clips',
    hue: '#A78BFA',
  },
  {
    icon: ScanFace,
    title: 'Face Swap',
    tag: 'Series infinitas',
    desc: 'Tu mismo creador con distintos rostros. Multiplica creators sin contratar.',
    span: '',
    visual: 'face',
    hue: '#14E0CC',
  },
  {
    icon: Wand2,
    title: 'Foto de producto',
    tag: 'Catálogo',
    desc: 'Crea, edita o cambia el fondo de tu producto. Catálogo profesional sin estudio.',
    span: 'lg:col-span-2',
    visual: 'photo',
    hue: '#22D3EE',
  },
  {
    icon: Zap,
    title: 'Calidad 4K',
    tag: 'Mastering',
    desc: 'Sube la resolución de tus videos y fotos a 4K. Listo para placement premium.',
    span: 'lg:col-span-2',
    visual: 'upscale',
    hue: '#34D399',
  },
];

export function Capabilities() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      gsap.from('[data-cap-h]', {
        y: 60,
        opacity: 0,
        stagger: 0.08,
        duration: 1,
        ease: 'expo.out',
        scrollTrigger: { trigger: el, start: 'top 75%' },
      });

      gsap.utils.toArray<HTMLElement>('[data-cap-card]').forEach((card, i) => {
        gsap.from(card, {
          y: 80,
          opacity: 0,
          rotate: i % 2 === 0 ? -1.5 : 1.5,
          duration: 0.9,
          ease: 'power3.out',
          scrollTrigger: { trigger: card, start: 'top 85%' },
        });
      });
    }, el);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={root} id="contenido" className="relative overflow-hidden py-24 md:py-32">
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-x-0 top-1/2 h-[60%] -translate-y-1/2 bg-[radial-gradient(ellipse_60%_50%_at_50%_50%,rgba(244,114,182,0.08),transparent_70%)]" />
      </div>

      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <span data-cap-h className="block text-[11px] font-semibold uppercase tracking-[0.32em] text-[#34D399]">
            Todo lo que tu marca necesita
          </span>
          <h2 data-cap-h className="font-display mt-5 text-[clamp(32px,6vw,72px)] font-semibold leading-[0.98] tracking-[-0.03em]">
            Anuncios, video, foto y catálogo<br className="hidden sm:block" />
            {' '}<span className="text-gradient-primary">de un mismo estudio.</span>
          </h2>
          <p data-cap-h className="mx-auto mt-5 max-w-2xl text-[15px] leading-relaxed text-white/60 md:text-[17px]">
            Cada formato producido con la identidad de tu marca y listo para
            cada canal. Sin freelancers, sin retrasos, sin shootings.
          </p>
        </div>

        <div className="mt-16 grid auto-rows-[260px] grid-cols-1 gap-3 sm:auto-rows-[240px] sm:grid-cols-2 lg:auto-rows-[220px] lg:grid-cols-4">
          {caps.map((c, i) => (
            <CapCard key={c.title} cap={c} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

function CapCard({ cap, index }: { cap: Cap; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const Icon = cap.icon;

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const rotY = (x - 0.5) * 10;
    const rotX = (0.5 - y) * 10;
    el.style.transform = `perspective(1000px) rotateX(${rotX}deg) rotateY(${rotY}deg)`;
    el.style.setProperty('--mx', `${x * 100}%`);
    el.style.setProperty('--my', `${y * 100}%`);
  };

  const handleLeave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.transform = 'perspective(1000px) rotateX(0) rotateY(0)';
  };

  return (
    <div
      ref={ref}
      data-cap-card
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      className={`tilt group relative overflow-hidden rounded-3xl border border-white/[0.07] bg-gradient-to-br from-white/[0.05] to-white/[0.01] p-5 ${cap.span}`}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: `radial-gradient(360px circle at var(--mx,50%) var(--my,50%), ${cap.hue}28, transparent 60%)` }}
      />
      <div className="relative h-[58%] overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0a0a0a]">
        <CapVisual variant={cap.visual} hue={cap.hue} index={index} />
      </div>
      <div className="relative mt-4 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-lg" style={{ background: `${cap.hue}18`, color: cap.hue, border: `1px solid ${cap.hue}30` }}>
              <Icon size={14} />
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: cap.hue }}>{cap.tag}</span>
          </div>
          <h3 className="mt-2 font-display text-[18px] font-semibold tracking-tight text-white">{cap.title}</h3>
          <p className="mt-1 text-[12px] leading-relaxed text-white/55 line-clamp-2">{cap.desc}</p>
        </div>
        <ArrowUpRight size={18} className="mt-1 flex-shrink-0 text-white/30 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-white" />
      </div>
    </div>
  );
}

function CapVisual({ variant, hue, index }: { variant: Cap['visual']; hue: string; index: number }) {
  if (variant === 'ugc') {
    return (
      <svg viewBox="0 0 480 280" className="h-full w-full">
        <defs>
          <linearGradient id={`ugc-g-${index}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={hue} stopOpacity="0.35" />
            <stop offset="100%" stopColor="#0a0a0a" stopOpacity="0" />
          </linearGradient>
          <radialGradient id={`ugc-face-${index}`}>
            <stop offset="0%" stopColor="#fff" stopOpacity="0.9" />
            <stop offset="100%" stopColor={hue} stopOpacity="0.4" />
          </radialGradient>
        </defs>
        <rect width="480" height="280" fill={`url(#ugc-g-${index})`} />
        <g transform="translate(170,30)">
          <rect width="140" height="220" rx="22" fill="#0f0f0f" stroke={`${hue}60`} />
          <rect x="6" y="6" width="128" height="208" rx="16" fill="#141414" />
          <circle cx="70" cy="90" r="32" fill={`url(#ugc-face-${index})`} />
          <rect x="30" y="140" width="80" height="6" rx="3" fill={`${hue}80`} />
          <rect x="40" y="154" width="60" height="4" rx="2" fill="#ffffff35" />
          <rect x="36" y="166" width="68" height="4" rx="2" fill="#ffffff20" />
          <circle cx="70" cy="190" r="14" fill={hue} />
          <polygon points="65,184 65,196 78,190" fill="#0a0a0a" />
        </g>
        <g stroke={hue} strokeWidth="2" strokeLinecap="round">
          {[0, 1, 2, 3, 4].map((i) => (
            <line key={`l${i}`} x1={40 + i * 14} x2={40 + i * 14} y1={140 - (i % 2 === 0 ? 10 : 24)} y2={140 + (i % 2 === 0 ? 10 : 24)} opacity={0.4 + i * 0.12} />
          ))}
          {[0, 1, 2, 3, 4].map((i) => (
            <line key={`r${i}`} x1={420 - i * 14} x2={420 - i * 14} y1={140 - (i % 2 === 0 ? 10 : 24)} y2={140 + (i % 2 === 0 ? 10 : 24)} opacity={0.4 + i * 0.12} />
          ))}
        </g>
      </svg>
    );
  }
  if (variant === 'static') {
    return (
      <svg viewBox="0 0 480 220" className="h-full w-full">
        <defs>
          <linearGradient id={`st-g-${index}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={hue} stopOpacity="0.4" />
            <stop offset="100%" stopColor="#0a0a0a" stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect width="480" height="220" fill={`url(#st-g-${index})`} opacity="0.5" />
        {[
          { x: 30, y: 30, w: 130, h: 160 },
          { x: 175, y: 30, w: 130, h: 160 },
          { x: 320, y: 30, w: 130, h: 160 },
        ].map((r, i) => (
          <g key={i} transform={`translate(${r.x},${r.y})`}>
            <rect width={r.w} height={r.h} rx="10" fill="#141414" stroke={`${hue}40`} />
            <rect x="10" y="10" width={r.w - 20} height={r.h * 0.5} rx="6" fill={`${hue}${i === 1 ? '60' : '30'}`} />
            <rect x="10" y={r.h * 0.55 + 10} width={r.w * 0.7} height="6" rx="3" fill="#ffffff60" />
            <rect x="10" y={r.h * 0.55 + 24} width={r.w * 0.5} height="4" rx="2" fill="#ffffff30" />
            <rect x="10" y={r.h - 30} width="56" height="14" rx="7" fill={hue} />
          </g>
        ))}
      </svg>
    );
  }
  if (variant === 'clips') {
    return (
      <svg viewBox="0 0 240 220" className="h-full w-full">
        <defs>
          <linearGradient id={`cl-g-${index}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={hue} stopOpacity="0.4" />
            <stop offset="100%" stopColor="#0a0a0a" stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect width="240" height="220" fill={`url(#cl-g-${index})`} />
        <g transform="translate(0,140)">
          <line x1="20" x2="220" y1="0" y2="0" stroke="#ffffff20" />
          {Array.from({ length: 16 }).map((_, i) => (
            <line key={i} x1={20 + i * 13} x2={20 + i * 13} y1="-10" y2="10" stroke={`${hue}80`} strokeWidth={i % 4 === 0 ? 2 : 1} opacity={i % 4 === 0 ? 1 : 0.5} />
          ))}
          <circle cx={120} cy={0} r="6" fill={hue} className="float-y" />
        </g>
        <g transform="translate(70,30)">
          <rect width="100" height="80" rx="8" fill="#141414" stroke={`${hue}60`} />
          <polygon points="42,30 42,50 60,40" fill={hue} />
        </g>
      </svg>
    );
  }
  if (variant === 'face') {
    return (
      <svg viewBox="0 0 240 220" className="h-full w-full">
        <defs>
          <radialGradient id={`fa-1-${index}`}>
            <stop offset="0%" stopColor="#fff" stopOpacity="0.9" />
            <stop offset="100%" stopColor={hue} stopOpacity="0.3" />
          </radialGradient>
          <radialGradient id={`fa-2-${index}`}>
            <stop offset="0%" stopColor={hue} stopOpacity="1" />
            <stop offset="100%" stopColor="#0a0a0a" stopOpacity="0.2" />
          </radialGradient>
        </defs>
        <circle cx="80" cy="110" r="48" fill={`url(#fa-1-${index})`} />
        <circle cx="160" cy="110" r="48" fill={`url(#fa-2-${index})`} />
        <path d="M 110 110 C 120 90, 130 90, 140 110" stroke={hue} strokeWidth="2" fill="none" strokeDasharray="4 4" className="flow-path" />
        <text x="80" y="180" textAnchor="middle" fill="#ffffff60" fontSize="10" fontWeight="600" letterSpacing="2">SOURCE</text>
        <text x="160" y="180" textAnchor="middle" fill={hue} fontSize="10" fontWeight="600" letterSpacing="2">TARGET</text>
      </svg>
    );
  }
  if (variant === 'photo') {
    return (
      <svg viewBox="0 0 480 220" className="h-full w-full">
        <defs>
          <linearGradient id={`ph-g-${index}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#0a0a0a" />
            <stop offset="100%" stopColor={hue} stopOpacity="0.5" />
          </linearGradient>
        </defs>
        <rect width="480" height="220" fill={`url(#ph-g-${index})`} opacity="0.6" />
        <g transform="translate(40,30)">
          <rect width="400" height="160" rx="12" fill="#141414" />
          <rect x="0" y="0" width="200" height="160" rx="12" fill="#1a1a1a" />
          <rect x="200" y="0" width="200" height="160" fill={`${hue}40`} />
          <line x1="200" x2="200" y1="0" y2="160" stroke="#fff" strokeWidth="2" />
          <circle cx="200" cy="80" r="14" fill="#fff" />
          <path d="M 195 75 L 190 80 L 195 85 M 205 75 L 210 80 L 205 85" stroke="#0a0a0a" strokeWidth="2" fill="none" strokeLinecap="round" />
          <text x="100" y="155" textAnchor="middle" fill="#ffffff60" fontSize="10" fontWeight="600" letterSpacing="2">BEFORE</text>
          <text x="300" y="155" textAnchor="middle" fill="#0a0a0a" fontSize="10" fontWeight="700" letterSpacing="2">AFTER</text>
        </g>
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 480 220" className="h-full w-full">
      <defs>
        <linearGradient id={`up-g-${index}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#0a0a0a" />
          <stop offset="100%" stopColor={hue} stopOpacity="0.45" />
        </linearGradient>
      </defs>
      <rect width="480" height="220" fill={`url(#up-g-${index})`} opacity="0.6" />
      <g transform="translate(40,40)">
        {Array.from({ length: 8 }).map((_, y) =>
          Array.from({ length: 8 }).map((_, x) => (
            <rect key={`${x}-${y}`} x={x * 18} y={y * 18} width="16" height="16" fill="#1a1a1a" stroke="#ffffff20" />
          ))
        )}
      </g>
      <text x="100" y="200" textAnchor="middle" fill="#ffffff60" fontSize="10" fontWeight="600" letterSpacing="2">SD</text>
      <g transform="translate(220,110)">
        <path d="M -10 0 L 30 0" stroke={hue} strokeWidth="2" />
        <path d="M 22 -6 L 30 0 L 22 6" stroke={hue} strokeWidth="2" fill="none" />
      </g>
      <g transform="translate(280,28)">
        {Array.from({ length: 16 }).map((_, y) =>
          Array.from({ length: 8 }).map((_, x) => (
            <rect key={`${x}-${y}`} x={x * 20} y={y * 10} width="18" height="8" fill={`${hue}${(((x + y) * 7) % 60 + 20).toString(16).padStart(2, '0')}`} stroke="#ffffff10" />
          ))
        )}
      </g>
      <text x="360" y="200" textAnchor="middle" fill={hue} fontSize="10" fontWeight="700" letterSpacing="2">4K</text>
    </svg>
  );
}
