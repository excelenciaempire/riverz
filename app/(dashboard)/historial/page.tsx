'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useUser } from '@clerk/nextjs';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Loading } from '@/components/ui/loading';
import { Download, Eye, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Generation } from '@/types';

type FilterType = 'all' | 'videos' | 'images';

export default function HistorialPage() {
  const { user } = useUser();
  const [filter, setFilter] = useState<FilterType>('all');
  const [page, setPage] = useState(1);
  const pageSize = 12;

  const supabase = createClient();

  const { data, isLoading } = useQuery({
    queryKey: ['generations', user?.id, filter, page],
    queryFn: async () => {
      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('clerk_id', user!.id)
        .single();

      if (!userData) return { items: [], total: 0 };

      let query = supabase
        .from('generations')
        .select('*', { count: 'exact' })
        .eq('user_id', userData.id)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      // Apply filter
      if (filter === 'videos') {
        query = query.in('type', ['ugc', 'face_swap', 'clips', 'mejorar_calidad_video']);
      } else if (filter === 'images') {
        query = query.in('type', [
          'editar_foto_crear',
          'editar_foto_editar',
          'editar_foto_combinar',
          'editar_foto_clonar',
          'mejorar_calidad_imagen',
        ]);
      }

      const { data, error, count } = await query;

      if (error) throw error;

      return {
        items: data as Generation[],
        total: count || 0,
      };
    },
    enabled: !!user,
  });

  const deleteGeneration = async (id: string) => {
    try {
      await supabase.from('generations').delete().eq('id', id);
      // Refresh data
      window.location.reload();
    } catch (error) {
      console.error('Error deleting generation:', error);
    }
  };

  const totalPages = Math.ceil((data?.total || 0) / pageSize);

  if (isLoading) {
    return <Loading text="Cargando historial..." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white">Historial</h1>

        {/* Filter Tabs */}
        <div className="flex gap-4">
          <button
            onClick={() => {
              setFilter('all');
              setPage(1);
            }}
            className={`rounded-lg px-4 py-2 ${
              filter === 'all'
                ? 'bg-brand-accent text-white'
                : 'bg-brand-dark-secondary text-gray-400 hover:text-white'
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => {
              setFilter('videos');
              setPage(1);
            }}
            className={`rounded-lg px-4 py-2 ${
              filter === 'videos'
                ? 'bg-brand-accent text-white'
                : 'bg-brand-dark-secondary text-gray-400 hover:text-white'
            }`}
          >
            Videos
          </button>
          <button
            onClick={() => {
              setFilter('images');
              setPage(1);
            }}
            className={`rounded-lg px-4 py-2 ${
              filter === 'images'
                ? 'bg-brand-accent text-white'
                : 'bg-brand-dark-secondary text-gray-400 hover:text-white'
            }`}
          >
            Imágenes
          </button>
        </div>
      </div>

      {/* Content Grid */}
      {data && data.items.length > 0 ? (
        <>
          <div className="grid gap-6 md:grid-cols-3 lg:grid-cols-4">
            {data.items.map((item) => (
              <div
                key={item.id}
                className="group overflow-hidden rounded-lg border border-gray-700 bg-brand-dark-secondary transition hover:border-brand-accent"
              >
                {/* Thumbnail */}
                <div className="relative aspect-square bg-gray-800">
                  {item.result_url && (
                    <>
                      {item.type.includes('video') || item.type === 'ugc' || item.type === 'face_swap' || item.type === 'clips' ? (
                        <video
                          src={item.result_url}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <img
                          src={item.result_url}
                          alt={item.type}
                          className="h-full w-full object-cover"
                        />
                      )}
                    </>
                  )}

                  {/* Overlay on hover */}
                  <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/70 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button size="icon" variant="ghost">
                      <Eye className="h-5 w-5" />
                    </Button>
                    <Button size="icon" variant="ghost">
                      <Download className="h-5 w-5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => deleteGeneration(item.id)}
                    >
                      <Trash2 className="h-5 w-5 text-red-400" />
                    </Button>
                  </div>
                </div>

                {/* Info */}
                <div className="p-4">
                  <p className="mb-1 text-sm font-medium capitalize text-white">
                    {item.type.replace(/_/g, ' ')}
                  </p>
                  <p className="mb-2 text-xs text-gray-400">
                    {format(new Date(item.created_at), 'PPP', { locale: es })}
                  </p>
                  <p className="text-xs text-brand-accent">
                    {item.cost} créditos
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
              >
                Anterior
              </Button>

              <span className="text-sm text-gray-400">
                Página {page} de {totalPages}
              </span>

              <Button
                variant="outline"
                onClick={() => setPage(page + 1)}
                disabled={page === totalPages}
              >
                Siguiente
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="rounded-lg border border-gray-700 bg-brand-dark-secondary p-12 text-center">
          <p className="text-gray-400">No hay contenido en el historial</p>
        </div>
      )}
    </div>
  );
}

