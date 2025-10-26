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
      <div className="mb-12 text-center">
        <h1 className="text-4xl font-bold text-white">Selecciona Modo De Uso</h1>
      </div>

      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
        {creationModes.map((mode) => {
          return (
            <Link
              key={mode.id}
              href={mode.href}
              className="group relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-3xl border-2 border-brand-accent bg-brand-dark-secondary transition-all hover:scale-[1.02] hover:shadow-2xl hover:shadow-brand-accent/30"
            >
              {/* Background gradient */}
              <div className={`absolute inset-0 bg-gradient-to-br ${mode.gradient} opacity-5 group-hover:opacity-20 transition-opacity`} />

              {/* Content */}
              <div className="relative text-center">
                <h3 className="text-3xl font-bold text-white">
                  {mode.name}
                </h3>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

