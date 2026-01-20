'use client';

import Link from 'next/link';
import { 
  Video, 
  Users, 
  Film, 
  ImageIcon, 
  Newspaper,
  Sparkles 
} from 'lucide-react';

const creationModes = [
  {
    id: 'ugc',
    name: 'UGC',
    description: 'Crea videos UGC con avatares IA',
    icon: Users,
    href: '/crear/ugc',
    gradient: 'from-purple-500 to-pink-500',
  },
  {
    id: 'face-swap',
    name: 'Face Swap',
    description: 'Intercambia rostros en videos',
    icon: Video,
    href: '/crear/face-swap',
    gradient: 'from-blue-500 to-cyan-500',
  },
  {
    id: 'clips',
    name: 'Clips',
    description: 'Genera videos cortos con IA',
    icon: Film,
    href: '/crear/clips',
    gradient: 'from-green-500 to-emerald-500',
  },
  {
    id: 'mejorar-calidad',
    name: 'Mejorar Calidad',
    description: 'Mejora la calidad de videos e imágenes',
    icon: Sparkles,
    href: '/crear/mejorar-calidad',
    gradient: 'from-yellow-500 to-orange-500',
  },
];

export default function CrearPage() {
  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-12 text-center">
        <h1 className="text-4xl font-bold text-white">Selecciona Modo De Uso</h1>
        <p className="mt-3 text-lg text-gray-400">Elige una herramienta para comenzar a crear</p>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        {creationModes.map((mode) => {
          return (
            <Link
              key={mode.id}
              href={mode.href}
              className="group relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-2xl border border-gray-800 bg-[#141414] transition-all hover:border-brand-accent hover:shadow-xl hover:shadow-brand-accent/20 hover:scale-105"
            >
              {/* Background gradient */}
              <div className={`absolute inset-0 bg-gradient-to-br ${mode.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-300`} />

              {/* Content */}
              <div className="relative text-center px-6">
                <h3 className="text-3xl font-semibold text-white mb-3">
                  {mode.name}
                </h3>
                <p className="text-sm text-gray-400">
                  {mode.description}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

