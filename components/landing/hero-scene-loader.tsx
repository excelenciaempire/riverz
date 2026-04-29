'use client';

import dynamic from 'next/dynamic';

// Three.js es client-only, así que cargamos la escena con SSR off para evitar
// que Next intente prerenderizar Canvas en el servidor.
export const HeroScene3D = dynamic(
  () => import('./hero-scene').then((m) => m.HeroScene),
  {
    ssr: false,
    loading: () => (
      <div className="absolute inset-0 grid place-items-center">
        <div className="h-32 w-32 animate-pulse rounded-full bg-gradient-to-br from-[#14E0CC]/40 via-[#A78BFA]/30 to-[#F472B6]/30 blur-2xl" />
      </div>
    ),
  }
);
