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

  const filterTabs: Array<{ id: FilterType; label: string }> = [
    { id: 'all', label: 'Todos' },
    { id: 'images', label: 'Imágenes' },
    { id: 'videos', label: 'Videos' },
  ];

  return (
    <div className="space-y-8 pb-24">
      <section className="page-hero">
        <p className="app-v2-eyebrow">Historial</p>
        <h1 className="app-v2-page-h1 mt-2">
          Tu trabajo,
          <br />
          <span className="text-[var(--rvz-ink-muted)]">en un solo lugar.</span>
        </h1>
        <p className="mt-4 max-w-xl text-[14px] leading-relaxed text-[var(--rvz-ink-muted)]">
          Cada pieza generada, lista para descargar, regenerar o subir directo a Meta Ads.
        </p>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-0.5 rounded-lg border border-[var(--rvz-card-border)] bg-[var(--rvz-bg-soft)] p-0.5">
          {filterTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setFilter(tab.id);
                setPage(1);
              }}
              className={`rounded-md px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.06em] transition ${
                filter === tab.id
                  ? 'bg-[var(--rvz-accent)] text-[var(--rvz-accent-fg)]'
                  : 'text-[var(--rvz-ink-muted)] hover:text-[var(--rvz-ink)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {data && data.items.length > 0 && (
          <button
            onClick={togglePage}
            className="rounded-lg border border-[var(--rvz-card-border)] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--rvz-ink-muted)] transition hover:border-[var(--rvz-card-hover-border)] hover:text-[var(--rvz-ink)]"
          >
            {allOnPageSelected ? 'Deseleccionar página' : 'Seleccionar página'}
          </button>
        )}
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
                  className={`card-cream group overflow-hidden p-0 transition ${
                    isSelected ? 'border-[var(--rvz-ink)] ring-2 ring-[var(--rvz-accent)]/50' : 'hover:border-[var(--rvz-card-hover-border)]'
                  }`}
                >
                  <div className="relative aspect-square bg-[var(--rvz-bg-soft)]">
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
                          ? 'border-[var(--rvz-ink)] bg-[var(--rvz-accent)] text-[var(--rvz-accent-fg)]'
                          : 'border-[var(--rvz-card-border)] bg-[var(--rvz-card)]/90 text-transparent hover:border-[var(--rvz-ink)] hover:text-[var(--rvz-ink)]'
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

                  <div className="p-3">
                    <p className="mb-0.5 text-[13px] font-medium capitalize text-[var(--rvz-ink)]">
                      {item.type.replace(/_/g, ' ')}
                    </p>
                    <p className="mb-1.5 text-[11px] text-[var(--rvz-ink-faint)]">
                      {format(new Date(item.created_at), 'PPP', { locale: es })}
                    </p>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--rvz-ink-muted)]">
                      {item.cost} créditos
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3">
              <Button variant="outline" onClick={() => setPage(page - 1)} disabled={page === 1}>
                Anterior
              </Button>
              <span className="text-[12px] uppercase tracking-[0.08em] text-[var(--rvz-ink-muted)]">
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
        <div className="card-cream p-12 text-center text-[var(--rvz-ink-muted)]">
          No hay contenido en el historial
        </div>
      )}

      {/* Sticky bulk actions toolbar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2">
          <div className="flex items-center gap-3 rounded-xl border border-[var(--rvz-card-dark-border)] bg-[var(--rvz-card-dark)] px-4 py-3 text-[var(--rvz-card-dark-fg)] shadow-2xl backdrop-blur">
            <span className="text-[13px] text-[var(--rvz-card-dark-muted)]">
              <span className="font-semibold text-[var(--rvz-card-dark-fg)]">{selectedIds.size}</span>{' '}
              seleccionado{selectedIds.size === 1 ? '' : 's'}
            </span>
            <button
              type="button"
              onClick={clearSelection}
              className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--rvz-card-dark-muted)] transition hover:text-[var(--rvz-card-dark-fg)]"
            >
              <X className="mr-1 inline h-3 w-3" />
              Limpiar
            </button>
            <Button
              size="sm"
              onClick={() => setIsUploadModalOpen(true)}
              disabled={selectedGenerations.length === 0}
            >
              <Upload className="mr-1.5 h-3.5 w-3.5" />
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
