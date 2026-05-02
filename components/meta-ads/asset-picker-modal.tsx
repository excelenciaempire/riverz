'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Image as ImageIcon, Video, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Loading } from '@/components/ui/loading';
import { cn } from '@/lib/utils';
import type { Generation } from '@/types';

const VIDEO_TYPES = new Set(['ugc', 'face_swap', 'clips', 'mejorar_calidad_video']);

type Filter = 'all' | 'videos' | 'images';

interface AssetPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (generations: Generation[]) => void;
  alreadyPickedIds?: string[];
}

export function AssetPickerModal({
  isOpen,
  onClose,
  onSelect,
  alreadyPickedIds = [],
}: AssetPickerModalProps) {
  const [filter, setFilter] = useState<Filter>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const generationsQuery = useQuery({
    queryKey: ['asset-picker-generations', filter],
    queryFn: async () => {
      const res = await fetch(`/api/generations?filter=${filter}&limit=200`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `HTTP ${res.status}`);
      }
      const body = (await res.json()) as { generations: Generation[] };
      return body.generations ?? [];
    },
    enabled: isOpen,
  });

  const items = useMemo(() => {
    const blocked = new Set(alreadyPickedIds);
    return (generationsQuery.data || []).filter((g) => !blocked.has(g.id));
  }, [generationsQuery.data, alreadyPickedIds]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const confirm = () => {
    const picked = items.filter((g) => selected.has(g.id));
    onSelect(picked);
    setSelected(new Set());
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative z-10 flex h-[85vh] w-full max-w-5xl flex-col rounded-2xl border border-gray-800 bg-[#141414] shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-800 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Importar assets</h2>
            <p className="text-xs text-gray-400">
              Selecciona generaciones de tu historial para añadirlas como filas en la grilla.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex items-center justify-between border-b border-gray-800 px-6 py-3">
          <div className="flex gap-2">
            {(['all', 'videos', 'images'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-medium transition',
                  filter === f
                    ? 'bg-brand-accent text-white'
                    : 'bg-[#0a0a0a] text-gray-400 hover:text-white',
                )}
              >
                {f === 'all' ? 'Todos' : f === 'videos' ? 'Videos' : 'Imágenes'}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500">
            <span className="text-white">{selected.size}</span> seleccionados
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {generationsQuery.isLoading ? (
            <Loading />
          ) : generationsQuery.isError ? (
            <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-12 text-center">
              <p className="text-red-400">
                Error cargando generaciones:{' '}
                {(generationsQuery.error as Error)?.message ?? 'desconocido'}
              </p>
              <button
                onClick={() => generationsQuery.refetch()}
                className="mt-2 text-xs text-brand-accent hover:underline"
              >
                Reintentar
              </button>
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-xl border border-gray-800 bg-[#0a0a0a] p-12 text-center">
              <p className="text-gray-400">
                {(generationsQuery.data || []).length === 0
                  ? 'No hay generaciones completadas para esta cuenta.'
                  : 'Todas las generaciones ya están en la grilla.'}
              </p>
              <a href="/historial" className="mt-2 inline-block text-xs text-brand-accent hover:underline">
                Ver historial →
              </a>
            </div>
          ) : (
            <div className="grid gap-3 grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
              {items.map((g) => {
                const isVideo = VIDEO_TYPES.has(g.type) || g.type.includes('video');
                const isSelected = selected.has(g.id);
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => toggle(g.id)}
                    className={cn(
                      'group relative aspect-square overflow-hidden rounded-lg border bg-gray-900 transition',
                      isSelected
                        ? 'border-brand-accent ring-2 ring-brand-accent/40'
                        : 'border-gray-800 hover:border-brand-accent',
                    )}
                  >
                    {g.result_url &&
                      (isVideo ? (
                        <video src={g.result_url} className="h-full w-full object-cover" muted />
                      ) : (
                        <img src={g.result_url} className="h-full w-full object-cover" alt="" />
                      ))}
                    <div className="absolute left-1.5 top-1.5">
                      <div
                        className={cn(
                          'flex h-6 w-6 items-center justify-center rounded border transition',
                          isSelected
                            ? 'border-brand-accent bg-brand-accent text-white'
                            : 'border-gray-500 bg-black/60 text-transparent group-hover:text-white',
                        )}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </div>
                    </div>
                    <div className="absolute right-1.5 top-1.5 rounded-md bg-black/70 px-1.5 py-0.5 text-[9px] uppercase text-white">
                      {isVideo ? <Video className="inline h-3 w-3" /> : <ImageIcon className="inline h-3 w-3" />}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-gray-800 px-6 py-4">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={confirm} disabled={selected.size === 0}>
            Añadir {selected.size > 0 ? `${selected.size} ` : ''}assets
          </Button>
        </div>
      </div>
    </div>
  );
}
