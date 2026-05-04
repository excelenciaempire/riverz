'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Loader2, ArrowLeft, Folder, Calendar, Trash2, X, CheckSquare, Square, Check, Image as ImageIcon, AlertCircle, Edit2, Columns2, Download } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { prettyName } from '@/lib/pretty-name';

interface Project {
  id: string;
  name: string;
  type: string;
  status: string;
  created_at: string;
}

interface FlatGeneration {
  id: string;
  status: string;
  result_url: string | null;
  project_id: string;
  input_data: any;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

const PENDING_STATUSES = new Set([
  'pending_analysis',
  'pending_variation',
  'analyzing',
  'adapting',
  'generating_prompt',
  'pending_generation',
  'generating',
]);

const STATUS_LABEL: Record<string, string> = {
  pending_analysis: 'En cola',
  pending_variation: 'En cola',
  analyzing: 'Analizando',
  adapting: 'Adaptando',
  generating_prompt: 'Procesando',
  pending_generation: 'Procesando',
  generating: 'Generando',
};

/**
 * Single tile in the flat (sin-carpetas) view.
 *
 * Mirrors the look of `VariationSlide` in /historial/[id]:
 *   - completed → image at natural aspect ratio (no crop) with a hover
 *                 overlay holding the same Editar / Comparar / Descargar
 *                 actions. Click on the image opens the comparison modal
 *                 (same as in the per-project view). Editar redirects to
 *                 the project page with ?edit=genId to open the AI editor
 *                 drawer there — we don't duplicate the drawer here.
 *   - pending  → loader card sized to a 3:4 placeholder (same approximate
 *                geometry as a typical ad) so the masonry doesn't reflow
 *                when the image lands.
 *   - failed   → red card with the truncated error.
 *
 * Selection check lives at top-right; click it to enter multi-select.
 * When the parent is in select mode the hover pills are suppressed so the
 * click target is unambiguous.
 */
function FlatGenerationTile({
  gen,
  isSelected,
  onToggleSelect,
  onCompare,
  onEdit,
  onDownload,
  selectMode,
}: {
  gen: FlatGeneration;
  isSelected: boolean;
  onToggleSelect: () => void;
  onCompare: () => void;
  onEdit: () => void;
  onDownload: () => void;
  selectMode: boolean;
}) {
  const isCompleted = gen.status === 'completed' && !!gen.result_url;
  const isFailed = gen.status === 'failed';
  const isPending = !isCompleted && !isFailed;
  const label =
    gen.input_data?.ideaHeadline ||
    gen.input_data?.templateName ||
    gen.input_data?.productName ||
    'Imagen';

  if (isCompleted) {
    return (
      <div className="group relative mb-4 break-inside-avoid overflow-hidden rounded-xl bg-[var(--rvz-bg)]">
        {/* Image is intentionally inert: in selectMode click toggles
            selection, otherwise nothing happens. The Editar / Comparar /
            Descargar pills in the hover overlay are the only triggers
            for those actions — same as in the per-project view. */}
        <img
          src={gen.result_url!}
          alt={label}
          loading="lazy"
          decoding="async"
          onClick={() => { if (selectMode) onToggleSelect(); }}
          className={cn(
            'block w-full h-auto select-none',
            selectMode ? 'cursor-pointer' : 'cursor-default'
          )}
          draggable={false}
        />
        <div
          className={cn(
            'absolute inset-0 transition-all pointer-events-none rounded-xl',
            isSelected ? 'ring-2 ring-[#07A498] bg-[#07A498]/5' : '',
          )}
        />
        <button
          onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}
          aria-label={isSelected ? 'Deseleccionar' : 'Seleccionar'}
          className={cn(
            'absolute top-3 right-3 flex h-6 w-6 items-center justify-center rounded-full transition-all cursor-pointer z-10',
            isSelected
              ? 'bg-[#07A498] text-[var(--rvz-ink)]'
              : 'bg-black/40 text-[var(--rvz-ink-faint)] hover:text-[var(--rvz-ink)] hover:bg-black/70 group-hover:text-[var(--rvz-ink)] group-hover:bg-black/60',
          )}
        >
          <Check className="h-3.5 w-3.5" />
        </button>

        {/* Hover overlay — suppressed in selectMode so the user only has one
            click target (the image itself = toggle selection). Pills are
            compact so all three fit even on the narrowest column. */}
        {!selectMode && (
          <div className="absolute bottom-0 left-0 right-0 flex flex-wrap items-center justify-center gap-1.5 px-2 pt-8 pb-3 bg-gradient-to-t from-black/85 via-black/45 to-transparent opacity-0 group-hover:opacity-100 transition">
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-black/70 hover:bg-black/90 text-[var(--rvz-ink)] text-[11px] font-medium transition border border-[var(--rvz-card-border)] whitespace-nowrap"
            >
              <Edit2 className="h-3 w-3" />
              Editar
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onCompare(); }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-black/70 hover:bg-black/90 text-[var(--rvz-ink)] text-[11px] font-medium transition border border-[var(--rvz-card-border)] whitespace-nowrap"
            >
              <Columns2 className="h-3 w-3" />
              Comparar
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDownload(); }}
              aria-label="Descargar"
              title="Descargar"
              className="flex items-center justify-center h-[26px] w-[26px] shrink-0 rounded-md bg-black/70 hover:bg-black/90 text-[var(--rvz-ink)] transition border border-[var(--rvz-card-border)]"
            >
              <Download className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
    );
  }

  if (isPending) {
    return (
      <div className="mb-4 break-inside-avoid relative aspect-[3/4] overflow-hidden rounded-xl bg-[#0f0f0f] border border-[var(--rvz-card-border)]">
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-3 text-center">
          <Loader2 className="h-5 w-5 animate-spin text-[#07A498]" />
          <p className="text-[11px] text-[var(--rvz-ink-muted)]">{STATUS_LABEL[gen.status] || 'Procesando'}</p>
          <p className="line-clamp-2 text-[10px] text-[var(--rvz-ink)]">{label}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4 break-inside-avoid relative aspect-[3/4] overflow-hidden rounded-xl">
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-3 border border-red-500/20 bg-red-950/30 text-center rounded-xl">
        <AlertCircle className="h-5 w-5 text-red-400" />
        <p className="text-[11px] font-medium text-red-400">Error</p>
        <p className="line-clamp-2 text-[10px] text-red-400/70">
          {gen.error_message || 'Generación fallida'}
        </p>
      </div>
    </div>
  );
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
  // "Sin carpetas" toggle. When ON, the project-folder grid is replaced by
  // a flat tile-per-image view across ALL of the user's static-ad projects.
  // Persisted in localStorage so the preference survives reloads — users
  // who like the flat view shouldn't have to reach for the toggle every time.
  const [flatView, setFlatView] = useState(false);
  // Hydrate from localStorage on mount. Effect (not initializer) so the
  // first render matches SSR markup and React doesn't yell about hydration.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem('riverz.historial.flatView');
    if (stored === '1') setFlatView(true);
  }, []);

  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects', 'static_ads'],
    queryFn: async () => {
      const response = await fetch('/api/projects?type=static_ads');
      if (!response.ok) throw new Error('Failed to fetch projects');
      return response.json() as Promise<Project[]>;
    },
  });

  // Flat-view-specific state. Lives only when flatView is on; entering
  // selectMode for the project grid is unrelated.
  //
  // Compare and Edit do NOT live here: they reuse the modal/drawer in
  // /historial/[id] via query params (?compare=<genId> / ?edit=<genId>).
  // That keeps a single implementation of those UIs and matches the
  // owner's principle: con-carpetas vs sin-carpetas is just a *grouping*
  // toggle, not a separate set of features.
  const [flatSelectedIds, setFlatSelectedIds] = useState<Set<string>>(new Set());
  const flatSelectMode = flatSelectedIds.size > 0;

  const toggleFlatSelected = (id: string) => {
    setFlatSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Mirror the download logic from /historial/[id]: fetch the image as a
  // blob and trigger a real save dialog via an anchor with `download`.
  // Otherwise the browser tends to navigate to the image instead of saving.
  const downloadOne = async (gen: FlatGeneration) => {
    if (!gen.result_url) return;
    try {
      const res = await fetch(gen.result_url);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = `riverz_${gen.id.slice(0, 8)}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (err: any) {
      toast.error(`No se pudo descargar: ${err.message || err}`);
    }
  };
  const downloadFlat = downloadOne;

  const [isBulkFlatBusy, setIsBulkFlatBusy] = useState<null | 'download' | 'delete'>(null);
  const [bulkFlatDeleteOpen, setBulkFlatDeleteOpen] = useState(false);

  // Multi-download: serializes through downloadOne for the selected generations
  // that actually have a result_url. Pending/failed tiles in the selection are
  // skipped silently — they have nothing to download.
  const bulkDownloadFlat = async () => {
    if (!flatGens) return;
    const targets = flatGens.filter((g) => flatSelectedIds.has(g.id) && g.result_url);
    if (targets.length === 0) {
      toast.error('Las imágenes seleccionadas todavía no tienen resultado');
      return;
    }
    setIsBulkFlatBusy('download');
    try {
      for (const g of targets) {
        await downloadOne(g);
      }
      toast.success(`Descargadas ${targets.length}`);
    } finally {
      setIsBulkFlatBusy(null);
    }
  };

  // Multi-delete: hits /api/generations/<id> for each selected generation
  // with bounded fan-out so a 25-image nuke doesn't open 25 sockets at once.
  // Refetches the list at the end so removed tiles disappear immediately.
  const bulkDeleteFlat = async () => {
    const ids = Array.from(flatSelectedIds);
    if (ids.length === 0) return;
    setIsBulkFlatBusy('delete');
    const MAX_PARALLEL = 5;
    let ok = 0;
    let failed = 0;
    for (let i = 0; i < ids.length; i += MAX_PARALLEL) {
      const batch = ids.slice(i, i + MAX_PARALLEL);
      const results = await Promise.allSettled(
        batch.map((id) =>
          fetch(`/api/generations/${id}`, { method: 'DELETE' }).then((r) => {
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
          })
        )
      );
      results.forEach((r) => (r.status === 'fulfilled' ? ok++ : failed++));
    }
    setIsBulkFlatBusy(null);
    setBulkFlatDeleteOpen(false);
    if (ok > 0) toast.success(`${ok} imagen(es) eliminada(s)`);
    if (failed > 0) toast.error(`${failed} no se pudieron eliminar`);
    queryClient.invalidateQueries({ queryKey: ['static-ads-all-generations'] });
    setFlatSelectedIds(new Set());
  };

  // Fetch the flat generations only when the toggle is on. Refetches every
  // 4s while there's at least one pending tile so the loaders advance to
  // images without a manual refresh — same cadence the per-project page uses.
  const { data: flatGens, isLoading: isLoadingFlat } = useQuery({
    queryKey: ['static-ads-all-generations'],
    queryFn: async () => {
      const r = await fetch('/api/static-ads/all-generations');
      if (!r.ok) throw new Error('Failed to fetch generations');
      const data = await r.json();
      return data.generations as FlatGeneration[];
    },
    enabled: flatView,
    refetchInterval: (query) => {
      const data = query.state.data as FlatGeneration[] | undefined;
      if (!data || data.length === 0) return false;
      return data.some((g) => PENDING_STATUSES.has(g.status)) ? 4000 : false;
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
            className="flex items-center gap-2 text-[var(--rvz-ink-muted)] transition hover:text-[var(--rvz-ink)]"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="text-sm">Volver</span>
          </button>
          <h1 className="text-2xl font-bold text-[var(--rvz-ink)]">Historial de Proyectos</h1>
        </div>
        {projects && projects.length > 0 && (
          <div className="flex items-center gap-3">
            {/* Sin-carpetas toggle. Hidden while in select mode — multi-select
                operates on projects, not individual generations, so mixing
                the two would be confusing. */}
            {!selectMode && (
              <button
                type="button"
                onClick={() => {
                  const next = !flatView;
                  setFlatView(next);
                  if (typeof window !== 'undefined') {
                    window.localStorage.setItem('riverz.historial.flatView', next ? '1' : '0');
                  }
                }}
                className="flex items-center gap-2 rounded-lg border border-[var(--rvz-card-border)] bg-[var(--rvz-card)] px-3 py-2 text-sm text-[var(--rvz-ink-muted)] transition hover:border-[#07A498] hover:text-[var(--rvz-ink)]"
                aria-pressed={flatView}
                title={flatView ? 'Volver a ver carpetas' : 'Ver todas las imágenes sin carpetas'}
              >
                <ImageIcon className="h-4 w-4" />
                <span className="hidden sm:inline">Sin carpetas</span>
                <span
                  className={cn(
                    'relative inline-flex h-5 w-9 items-center rounded-full transition',
                    flatView ? 'bg-[#07A498]' : 'bg-[var(--rvz-bg-soft)]',
                  )}
                  aria-hidden="true"
                >
                  <span
                    className={cn(
                      'inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition',
                      flatView ? 'translate-x-[1.25rem]' : 'translate-x-[0.25rem]',
                    )}
                  />
                </span>
              </button>
            )}

            {selectMode ? (
              <>
                <Button variant="outline" onClick={selectAll} className="border-[var(--rvz-card-border)] text-[var(--rvz-ink-muted)]">
                  {projects.length === selectedIds.size ? 'Deseleccionar todo' : 'Seleccionar todo'}
                </Button>
                <Button variant="outline" onClick={exitSelectMode} className="border-[var(--rvz-card-border)] text-[var(--rvz-ink-muted)]">
                  Cancelar
                </Button>
              </>
            ) : (
              !flatView && (
                <Button variant="outline" onClick={() => setSelectMode(true)} className="border-[var(--rvz-card-border)] text-[var(--rvz-ink-muted)] hover:text-[var(--rvz-ink)]">
                  <CheckSquare className="mr-2 h-4 w-4" />
                  Seleccionar
                </Button>
              )
            )}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#07A498]" />
        </div>
      ) : projects?.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-[var(--rvz-card-border)] bg-[var(--rvz-card)] py-20 text-center">
          <Folder className="mb-4 h-16 w-16 text-[var(--rvz-ink)]" />
          <h3 className="text-lg font-medium text-[var(--rvz-ink)]">No hay proyectos</h3>
          <p className="mt-2 text-[var(--rvz-ink-muted)]">
            Crea tu primer proyecto de Static Ads para verlo aquí.
          </p>
        </div>
      ) : flatView ? (
        // Flat view — every generation across every project as a tile, no
        // folder grouping. Layout = CSS columns masonry so each image keeps
        // its natural aspect ratio (matches the static-ads template grid).
        isLoadingFlat && !flatGens ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-[#07A498]" />
          </div>
        ) : !flatGens || flatGens.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-[var(--rvz-card-border)] bg-[var(--rvz-card)] py-20 text-center">
            <ImageIcon className="mb-4 h-16 w-16 text-[var(--rvz-ink)]" />
            <h3 className="text-lg font-medium text-[var(--rvz-ink)]">No hay generaciones aún</h3>
            <p className="mt-2 text-[var(--rvz-ink-muted)]">
              Las imágenes aparecerán aquí en cuanto los proyectos terminen de procesar.
            </p>
          </div>
        ) : (
          <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4">
            {flatGens.map((gen) => (
              <FlatGenerationTile
                key={gen.id}
                gen={gen}
                isSelected={flatSelectedIds.has(gen.id)}
                selectMode={flatSelectMode}
                onToggleSelect={() => toggleFlatSelected(gen.id)}
                onCompare={() => router.push(`/crear/static-ads/historial/${gen.project_id}?compare=${gen.id}`)}
                onEdit={() => router.push(`/crear/static-ads/historial/${gen.project_id}?edit=${gen.id}`)}
                onDownload={() => downloadFlat(gen)}
              />
            ))}
          </div>
        )
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
                  : 'border-[var(--rvz-card-border)] hover:border-[#07A498] hover:shadow-lg hover:shadow-[#07A498]/10',
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
                    ? 'bg-[#07A498] border-[#07A498] text-[var(--rvz-ink)]'
                    : 'bg-black/60 border-[var(--rvz-card-hover-border)] text-[var(--rvz-ink-muted)] hover:border-[#07A498]',
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
                  <p className="text-sm text-[var(--rvz-ink)] text-center mb-4">¿Eliminar este proyecto?</p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => { e.stopPropagation(); setDeleteConfirm(null); }}
                      className="border-[var(--rvz-card-hover-border)]"
                    >
                      <X className="h-4 w-4 mr-1" />
                      No
                    </Button>
                    <Button
                      size="sm"
                      onClick={confirmDelete}
                      disabled={deleteMutation.isPending}
                      className="bg-red-500 hover:bg-red-600 text-[var(--rvz-ink)]"
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

              <div className="flex h-32 items-center justify-center bg-[var(--rvz-bg)] transition group-hover:bg-[#0f141c]">
                <Folder className="h-12 w-12 text-[#07A498]/50 group-hover:text-[#07A498]" />
              </div>
              <div className="p-4">
                <h3 className="mb-1 truncate text-lg font-semibold text-[var(--rvz-ink)] group-hover:text-[#07A498]">
                  {prettyName(project.name)}
                </h3>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-[var(--rvz-ink-muted)]">
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
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--rvz-card-border)] bg-[var(--rvz-bg)]/95 backdrop-blur-lg p-4">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#07A498]/20 text-[#07A498] font-bold">
                {selectedIds.size}
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--rvz-ink)]">
                  proyecto(s) seleccionado(s)
                </p>
                <p className="text-xs text-[var(--rvz-ink-muted)]">Esta acción no se puede deshacer</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={exitSelectMode} className="border-[var(--rvz-card-border)]">
                Cancelar
              </Button>
              <Button
                onClick={() => setBulkConfirmOpen(true)}
                disabled={isBulkDeleting}
                className="bg-red-500 hover:bg-red-600 text-[var(--rvz-ink)]"
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
            className="w-full max-w-sm rounded-2xl border border-[var(--rvz-card-border)] bg-[var(--rvz-card)] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-2 text-lg font-bold text-[var(--rvz-ink)]">
              ¿Eliminar {selectedIds.size} proyecto(s)?
            </h2>
            <p className="mb-6 text-sm text-[var(--rvz-ink-muted)]">
              Esta acción borra cada proyecto y todas sus generaciones. No se puede deshacer.
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 border-[var(--rvz-card-border)]"
                onClick={() => setBulkConfirmOpen(false)}
                disabled={isBulkDeleting}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleBulkDelete}
                disabled={isBulkDeleting}
                className="flex-1 bg-red-500 hover:bg-red-600 text-[var(--rvz-ink)]"
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

      {/* Flat-view bulk action bar — visible whenever ≥1 generation is
          selected in flat mode. Mirrors the project-grid bulk bar UX so the
          mental model stays the same: pick, then act. Download skips
          tiles that don't have a result yet; delete hits the per-id endpoint. */}
      {flatView && flatSelectMode && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--rvz-card-border)] bg-[var(--rvz-bg)]/95 backdrop-blur-lg p-4">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#07A498]/20 text-[#07A498] font-bold">
                {flatSelectedIds.size}
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--rvz-ink)]">imagen(es) seleccionada(s)</p>
                <p className="text-xs text-[var(--rvz-ink-muted)]">Descarga en lote o elimina las elegidas</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setFlatSelectedIds(new Set())} className="border-[var(--rvz-card-border)]">
                Cancelar
              </Button>
              <Button
                onClick={bulkDownloadFlat}
                disabled={isBulkFlatBusy !== null}
                className="bg-[#07A498] text-[var(--rvz-ink)] hover:bg-[#068f84]"
              >
                {isBulkFlatBusy === 'download' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                Descargar {flatSelectedIds.size}
              </Button>
              <Button
                onClick={() => setBulkFlatDeleteOpen(true)}
                disabled={isBulkFlatBusy !== null}
                className="bg-red-500 hover:bg-red-600 text-[var(--rvz-ink)]"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Eliminar {flatSelectedIds.size}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm modal for the flat-view multi-delete. Same shape as the
          project-grid bulk confirm so the user sees a familiar dialog. */}
      {bulkFlatDeleteOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => isBulkFlatBusy !== 'delete' && setBulkFlatDeleteOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-[var(--rvz-card-border)] bg-[var(--rvz-card)] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-2 text-lg font-bold text-[var(--rvz-ink)]">
              ¿Eliminar {flatSelectedIds.size} imagen(es)?
            </h2>
            <p className="mb-6 text-sm text-[var(--rvz-ink-muted)]">
              Las imágenes se borrarán de su proyecto. La acción no se puede deshacer.
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 border-[var(--rvz-card-border)]"
                onClick={() => setBulkFlatDeleteOpen(false)}
                disabled={isBulkFlatBusy === 'delete'}
              >
                Cancelar
              </Button>
              <Button
                onClick={bulkDeleteFlat}
                disabled={isBulkFlatBusy === 'delete'}
                className="flex-1 bg-red-500 hover:bg-red-600 text-[var(--rvz-ink)]"
              >
                {isBulkFlatBusy === 'delete' ? (
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
