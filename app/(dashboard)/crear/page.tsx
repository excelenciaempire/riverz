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
    id: 'editar-foto',
    name: 'Editar Foto',
    description: 'Edita imágenes con IA',
    icon: ImageIcon,
    href: '/crear/editar-foto',
    gradient: 'from-orange-500 to-red-500',
  },
  {
    id: 'static-ads',
    name: 'Static Ads',
    description: 'Plantillas y conceptos de anuncios',
    icon: Newspaper,
    href: '/crear/static-ads',
    gradient: 'from-indigo-500 to-purple-500',
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
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Selecciona Modo De Uso</h1>
        <p className="mt-2 text-gray-400">Elige qué tipo de contenido quieres crear</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {creationModes.map((mode) => {
          const Icon = mode.icon;
          
          return (
            <Link
              key={mode.id}
              href={mode.href}
              className="group relative overflow-hidden rounded-2xl border border-gray-700 bg-brand-dark-secondary p-8 transition-all hover:border-brand-accent hover:shadow-lg hover:shadow-brand-accent/20"
            >
              {/* Gradient background on hover */}
              <div className={`absolute inset-0 bg-gradient-to-br ${mode.gradient} opacity-0 transition-opacity group-hover:opacity-10`} />

              {/* Content */}
              <div className="relative">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-gray-800 group-hover:bg-brand-accent/20">
                  <Icon className="h-8 w-8 text-brand-accent" />
                </div>

                <h3 className="mb-2 text-xl font-semibold text-white">
                  {mode.name}
                </h3>

                <p className="text-sm text-gray-400">
                  {mode.description}
                </p>

                {/* Arrow indicator */}
                <div className="mt-4 flex items-center text-brand-accent opacity-0 transition-opacity group-hover:opacity-100">
                  <span className="text-sm font-medium">Comenzar</span>
                  <svg
                    className="ml-2 h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

