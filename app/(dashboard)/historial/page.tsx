'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useUser } from '@clerk/nextjs';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Loading } from '@/components/ui/loading';
import { BulkUploadModal } from '@/components/meta-ads/bulk-upload-modal';
import { Download, Eye, Trash2, Check, Upload, X } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Generation } from '@/types';

type FilterType = 'all' | 'videos' | 'images';

export default function HistorialPage() {
  const { user } = useUser();
  const [filter, setFilter] = useState<FilterType>('all');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const pageSize = 12;

  const supabase = createClient();

  const { data, isLoading } = useQuery({
    queryKey: ['generations', user?.id, filter, page],
    queryFn: async () => {
      if (!user?.id) return { items: [], total: 0 };

      let query = supabase
        .from('generations')
        .select('*', { count: 'exact' })
        .eq('clerk_user_id', user.id)
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
          'static_ad_generation',
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
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      window.location.reload();
    } catch (error) {
      console.error('Error deleting generation:', error);
    }
  };

  const totalPages = Math.ceil((data?.total || 0) / pageSize);

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allOnPageSelected = useMemo(() => {
    if (!data?.items.length) return false;
    return data.items.every((it) => selectedIds.has(it.id));
  }, [data?.items, selectedIds]);

  const togglePage = () => {
    if (!data?.items) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) {
        for (const it of data.items) next.delete(it.id);
      } else {
        for (const it of data.items) next.add(it.id);
      }
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const selectedGenerations = useMemo(() => {
    if (!data?.items) return [] as Generation[];
    return data.items.filter((it) => selectedIds.has(it.id));
  }, [data?.items, selectedIds]);

  if (isLoading) {
    return <Loading text="Cargando historial..." />;
  }

  return (
    <div className="space-y-6 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white">Historial</h1>

        {/* Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          {data && data.items.length > 0 && (
            <button
              onClick={togglePage}
              className="rounded-lg border border-gray-700 bg-brand-dark-secondary px-3 py-2 text-xs text-gray-300 hover:border-brand-accent hover:text-white"
            >
              {allOnPageSelected ? 'Deseleccionar página' : 'Seleccionar página'}
            </button>
          )}
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
            {data.items.map((item) => {
              const isSelected = selectedIds.has(item.id);
              return (
                <div
                  key={item.id}
                  className={`group overflow-hidden rounded-lg border bg-brand-dark-secondary transition ${
                    isSelected ? 'border-brand-accent ring-2 ring-brand-accent/40' : 'border-gray-700 hover:border-brand-accent'
                  }`}
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

                    {/* Selection checkbox */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelected(item.id);
                      }}
                      aria-pressed={isSelected}
                      aria-label={isSelected ? 'Deseleccionar' : 'Seleccionar'}
                      className={`absolute left-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-md border transition ${
                        isSelected
                          ? 'border-brand-accent bg-brand-accent text-white'
                          : 'border-gray-500 bg-black/60 text-transparent hover:border-white hover:text-white'
                      }`}
                    >
                      <Check className="h-4 w-4" />
                    </button>

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
              );
            })}
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

      {/* Sticky bulk actions toolbar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2">
          <div className="flex items-center gap-3 rounded-2xl border border-gray-700 bg-[#0a0a0a]/95 px-4 py-3 shadow-2xl backdrop-blur">
            <span className="text-sm text-gray-300">
              <span className="font-semibold text-white">{selectedIds.size}</span> seleccionado{selectedIds.size === 1 ? '' : 's'}
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={clearSelection}
              className="text-gray-400 hover:text-white"
            >
              <X className="mr-1 h-3 w-3" />
              Limpiar
            </Button>
            <Button
              size="sm"
              onClick={() => setIsUploadModalOpen(true)}
              disabled={selectedGenerations.length === 0}
            >
              <Upload className="mr-2 h-4 w-4" />
              Subir a Meta Ads
            </Button>
          </div>
        </div>
      )}

      <BulkUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        selectedGenerations={selectedGenerations}
      />
    </div>
  );
}
