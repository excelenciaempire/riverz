'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, TrendingUp, Video, Image as ImageIcon, Sparkles } from 'lucide-react';

const categories = [
  { id: 'all', name: 'Todo', icon: Sparkles },
  { id: 'trending', name: 'Tendencias', icon: TrendingUp },
  { id: 'videos', name: 'Videos', icon: Video },
  { id: 'images', name: 'Imágenes', icon: ImageIcon },
];

const inspirationItems = [
  {
    id: 1,
    title: 'UGC Video de Producto',
    description: 'Video testimonial de producto usando avatar IA',
    thumbnail: 'https://via.placeholder.com/400x300',
    type: 'video',
    trending: true,
  },
  {
    id: 2,
    title: 'Face Swap Creativo',
    description: 'Intercambio de rostros para contenido viral',
    thumbnail: 'https://via.placeholder.com/400x300',
    type: 'video',
    trending: true,
  },
  {
    id: 3,
    title: 'Anuncio Estático Minimalista',
    description: 'Diseño limpio para redes sociales',
    thumbnail: 'https://via.placeholder.com/400x300',
    type: 'image',
    trending: false,
  },
  {
    id: 4,
    title: 'Clip Animado de Producto',
    description: 'Video corto animado con IA',
    thumbnail: 'https://via.placeholder.com/400x300',
    type: 'video',
    trending: true,
  },
  {
    id: 5,
    title: 'Edición de Foto Profesional',
    description: 'Antes y después con IA',
    thumbnail: 'https://via.placeholder.com/400x300',
    type: 'image',
    trending: false,
  },
  {
    id: 6,
    title: 'Combinación de Imágenes',
    description: 'Fusión creativa de múltiples elementos',
    thumbnail: 'https://via.placeholder.com/400x300',
    type: 'image',
    trending: false,
  },
];

export default function InspiracionPage() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredItems = inspirationItems.filter((item) => {
    if (selectedCategory !== 'all') {
      if (selectedCategory === 'trending' && !item.trending) return false;
      if (selectedCategory === 'videos' && item.type !== 'video') return false;
      if (selectedCategory === 'images' && item.type !== 'image') return false;
    }
    if (searchQuery) {
      return (
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Inspiración</h1>
        <p className="mt-2 text-gray-400">
          Descubre ideas y ejemplos para tus próximas creaciones
        </p>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
        <Input
          type="text"
          placeholder="Buscar inspiración..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Category Filter */}
      <div className="flex gap-4 overflow-x-auto">
        {categories.map((category) => {
          const Icon = category.icon;
          return (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-6 py-3 transition ${
                selectedCategory === category.id
                  ? 'bg-brand-accent text-white'
                  : 'bg-brand-dark-secondary text-gray-400 hover:text-white'
              }`}
            >
              <Icon className="h-5 w-5" />
              {category.name}
            </button>
          );
        })}
      </div>

      {/* Inspiration Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredItems.map((item) => (
          <div
            key={item.id}
            className="group cursor-pointer overflow-hidden rounded-lg border border-gray-700 bg-brand-dark-secondary transition hover:border-brand-accent"
          >
            {/* Thumbnail */}
            <div className="relative aspect-video bg-gray-800">
              <img
                src={item.thumbnail}
                alt={item.title}
                className="h-full w-full object-cover"
              />
              
              {/* Overlay on hover */}
              <div className="absolute inset-0 flex items-center justify-center bg-black/70 opacity-0 transition-opacity group-hover:opacity-100">
                <Button size="sm">
                  Ver Detalles
                </Button>
              </div>

              {/* Trending Badge */}
              {item.trending && (
                <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-brand-accent px-3 py-1 text-xs font-medium text-white">
                  <TrendingUp className="h-3 w-3" />
                  Tendencia
                </div>
              )}

              {/* Type Badge */}
              <div className="absolute bottom-2 left-2 rounded-full bg-black/50 px-3 py-1 text-xs text-white backdrop-blur-sm">
                {item.type === 'video' ? 'Video' : 'Imagen'}
              </div>
            </div>

            {/* Info */}
            <div className="p-4">
              <h3 className="mb-1 font-semibold text-white">{item.title}</h3>
              <p className="text-sm text-gray-400">{item.description}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {filteredItems.length === 0 && (
        <div className="rounded-lg border border-gray-700 bg-brand-dark-secondary p-12 text-center">
          <p className="text-gray-400">
            No se encontraron resultados para tu búsqueda
          </p>
        </div>
      )}
    </div>
  );
}

