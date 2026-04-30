'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Loader2, ArrowLeft, Folder, Calendar, Trash2, X, CheckSquare, Square, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Project {
  id: string;
  name: string;
  type: string;
  status: string;
  created_at: string;
}

export default function HistorialPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  // Multi-select state — toggling on the first checkbox enters select mode
  // and shows the bulk-delete bar. Clicking a card while in select mode
  // toggles its selection instead of opening it.
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);

  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects', 'static_ads'],
    queryFn: async () => {
      const response = await fetch('/api/projects?type=static_ads');
      if (!response.ok) throw new Error('Failed to fetch projects');
      return response.json() as Promise<Project[]>;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (projectId: string) => {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete project');
      return response.json();
    },
    onSuccess: () => {
      toast.success('Proyecto eliminado');
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setDeleteConfirm(null);
    },
    onError: () => {
      toast.error('Error al eliminar el proyecto');
    },
  });

  const handleDelete = (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    setDeleteConfirm(projectId);
  };

  const confirmDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (deleteConfirm) {
      deleteMutation.mutate(deleteConfirm);
    }
  };

  const toggleSelected = (projectId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const selectAll = () => {
    if (!projects) return;
    const allIds = projects.map((p) => p.id);
    setSelectedIds(
      selectedIds.size === allIds.length ? new Set() : new Set(allIds),
    );
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setIsBulkDeleting(true);
    const ids = [...selectedIds];
    // Bounded fan-out so a 50-project nuke doesn't open 50 sockets at once.
    const MAX_PARALLEL = 5;
    let ok = 0;
    let failed = 0;
    for (let i = 0; i < ids.length; i += MAX_PARALLEL) {
      const batch = ids.slice(i, i + MAX_PARALLEL);
      const results = await Promise.allSettled(
        batch.map((id) =>
          fetch(`/api/projects/${id}`, { method: 'DELETE' }).then((r) => {
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
          }),
        ),
      );
      results.forEach((r) => (r.status === 'fulfilled' ? ok++ : failed++));
    }
    setIsBulkDeleting(false);
    setBulkConfirmOpen(false);
    if (ok > 0) toast.success(`${ok} proyecto(s) eliminados`);
    if (failed > 0) toast.error(`${failed} no se pudieron eliminar`);
    queryClient.invalidateQueries({ queryKey: ['projects'] });
    exitSelectMode();
  };

  return (
    <div className="mx-auto max-w-[1800px] p-6 pb-24">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/crear/static-ads')}
            className="flex items-center gap-2 text-gray-400 transition hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="text-sm">Volver</span>
          </button>
          <h1 className="text-2xl font-bold text-white">Historial de Proyectos</h1>
        </div>
        {projects && projects.length > 0 && (
          <div className="flex gap-2">
            {selectMode ? (
              <>
                <Button variant="outline" onClick={selectAll} className="border-gray-700 text-gray-300">
                  {projects.length === selectedIds.size ? 'Deseleccionar todo' : 'Seleccionar todo'}
                </Button>
                <Button variant="outline" onClick={exitSelectMode} className="border-gray-700 text-gray-300">
                  Cancelar
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={() => setSelectMode(true)} className="border-gray-700 text-gray-300 hover:text-white">
                <CheckSquare className="mr-2 h-4 w-4" />
                Seleccionar
              </Button>
            )}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#07A498]" />
        </div>
      ) : projects?.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-800 bg-[#141414] py-20 text-center">
          <Folder className="mb-4 h-16 w-16 text-gray-700" />
          <h3 className="text-lg font-medium text-white">No hay proyectos</h3>
          <p className="mt-2 text-gray-400">
            Crea tu primer proyecto de Static Ads para verlo aquí.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {projects?.map((project) => {
            const isSelected = selectedIds.has(project.id);
            return (
            <div
              key={project.id}
              onClick={() => {
                if (selectMode) {
                  toggleSelected(project.id);
                } else {
                  router.push(`/crear/static-ads/historial/${project.id}`);
                }
              }}
              className={cn(
                'group relative cursor-pointer overflow-hidden rounded-xl border bg-[#1a2332] transition',
                isSelected
                  ? 'border-[#07A498] ring-2 ring-[#07A498]/40'
                  : 'border-gray-800 hover:border-[#07A498] hover:shadow-lg hover:shadow-[#07A498]/10',
              )}
            >
              {/* Selection checkbox — visible when in select mode, on hover otherwise */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (!selectMode) setSelectMode(true);
                  toggleSelected(project.id);
                }}
                className={cn(
                  'absolute top-2 left-2 z-10 flex h-7 w-7 items-center justify-center rounded-md border transition',
                  selectMode || isSelected
                    ? 'opacity-100'
                    : 'opacity-0 group-hover:opacity-100',
                  isSelected
                    ? 'bg-[#07A498] border-[#07A498] text-white'
                    : 'bg-black/60 border-gray-600 text-gray-300 hover:border-[#07A498]',
                )}
                aria-label={isSelected ? 'Deseleccionar' : 'Seleccionar'}
              >
                {isSelected ? <Check className="h-4 w-4" /> : <Square className="h-3.5 w-3.5" />}
              </button>

              {/* Single-delete button — hidden in select mode to avoid two delete UIs at once */}
              {!selectMode && (
                <button
                  onClick={(e) => handleDelete(e, project.id)}
                  className="absolute top-2 right-2 z-10 p-2 rounded-lg bg-red-500/10 text-red-400 opacity-0 group-hover:opacity-100 transition hover:bg-red-500/20"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}

              {/* Delete confirmation */}
              {deleteConfirm === project.id && (
                <div 
                  className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/90 p-4"
                  onClick={(e) => e.stopPropagation()}
                >
                  <p className="text-sm text-white text-center mb-4">¿Eliminar este proyecto?</p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => { e.stopPropagation(); setDeleteConfirm(null); }}
                      className="border-gray-600"
                    >
                      <X className="h-4 w-4 mr-1" />
                      No
                    </Button>
                    <Button
                      size="sm"
                      onClick={confirmDelete}
                      disabled={deleteMutation.isPending}
                      className="bg-red-500 hover:bg-red-600 text-white"
                    >
                      {deleteMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Trash2 className="h-4 w-4 mr-1" />
                          Sí, eliminar
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex h-32 items-center justify-center bg-[#0a0a0a] transition group-hover:bg-[#0f141c]">
                <Folder className="h-12 w-12 text-[#07A498]/50 group-hover:text-[#07A498]" />
              </div>
              <div className="p-4">
                <h3 className="mb-1 truncate text-lg font-semibold text-white group-hover:text-[#07A498]">
                  {project.name}
                </h3>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <Calendar className="h-3 w-3" />
                    <span>
                      {format(new Date(project.created_at), "d 'de' MMMM, yyyy", {
                        locale: es,
                      })}
                    </span>
                  </div>
                  {project.status === 'processing' && (
                    <span className="text-xs text-yellow-400 flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      En proceso
                    </span>
                  )}
                  {project.status === 'completed' && (
                    <span className="text-xs text-green-400 flex items-center gap-1">
                      <Check className="h-3 w-3" />
                      Listo
                    </span>
                  )}
                  {project.status === 'failed' && (
                    <span className="text-xs text-red-400">Error</span>
                  )}
                </div>
              </div>
            </div>
          );
          })}
        </div>
      )}

      {/* Bulk action bar — visible only when in select mode with at least one item picked */}
      {selectMode && selectedIds.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-800 bg-[#0a0a0a]/95 backdrop-blur-lg p-4">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#07A498]/20 text-[#07A498] font-bold">
                {selectedIds.size}
              </div>
              <div>
                <p className="text-sm font-medium text-white">
                  proyecto(s) seleccionado(s)
                </p>
                <p className="text-xs text-gray-400">Esta acción no se puede deshacer</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={exitSelectMode} className="border-gray-700">
                Cancelar
              </Button>
              <Button
                onClick={() => setBulkConfirmOpen(true)}
                disabled={isBulkDeleting}
                className="bg-red-500 hover:bg-red-600 text-white"
              >
                {isBulkDeleting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                Eliminar {selectedIds.size}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk confirm modal */}
      {bulkConfirmOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => !isBulkDeleting && setBulkConfirmOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-gray-800 bg-[#141414] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-2 text-lg font-bold text-white">
              ¿Eliminar {selectedIds.size} proyecto(s)?
            </h2>
            <p className="mb-6 text-sm text-gray-400">
              Esta acción borra cada proyecto y todas sus generaciones. No se puede deshacer.
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 border-gray-700"
                onClick={() => setBulkConfirmOpen(false)}
                disabled={isBulkDeleting}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleBulkDelete}
                disabled={isBulkDeleting}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white"
              >
                {isBulkDeleting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Eliminando…
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Sí, eliminar
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
