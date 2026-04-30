'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Download, Check, Edit2, Loader2, Save, Undo2, X, Sparkles, Trash2, Clock, AlertCircle, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Generation {
  id: string;
  result_url: string;
  status: string;
  input_data: any;
  error_message?: string;
  version?: number;
  parent_id?: string;
  created_at?: string;
  updated_at?: string;
}

interface ProjectDetail {
  id: string;
  name: string;
  generations: Generation[];
}

// Status display config — `progress` (0..1) drives the circular progress ring
// inside LoadingTile so the user sees the pipeline advance, not just a generic
// spinner.
const statusConfig: Record<string, { label: string; color: string; progress: number }> = {
  pending_analysis:   { label: 'En cola',           color: 'text-gray-300',     progress: 0.05 },
  pending_variation:  { label: 'Esperando turno',   color: 'text-gray-300',     progress: 0.10 },
  analyzing:          { label: 'Analizando plantilla', color: 'text-cyan-300',  progress: 0.30 },
  adapting:           { label: 'Adaptando al producto', color: 'text-purple-300', progress: 0.55 },
  generating_prompt:  { label: 'Preparando prompt', color: 'text-indigo-300',   progress: 0.70 },
  pending_generation: { label: 'Encolando imagen',  color: 'text-cyan-300',     progress: 0.75 },
  generating:         { label: 'Generando imagen',  color: 'text-[#07A498]',    progress: 0.92 },
  completed:          { label: 'Listo',             color: 'text-green-400',    progress: 1.00 },
  failed:             { label: 'Error',             color: 'text-red-400',      progress: 0 },
};

// Minimal loading tile: thin ring + small percent + status text. No glass
// blur, no conic gradient, no template peek — just the bare progress info
// in the same 3:4 frame so the layout doesn't jump when the result lands.
function LoadingTile({ status, hint }: { status: string; hint?: string; templateThumbnail?: string }) {
  const cfg = statusConfig[status] || statusConfig.pending_analysis;
  // SVG circle math: r=44, circumference = 2πr ≈ 276.46
  const r = 44;
  const C = 2 * Math.PI * r;
  const dash = C * cfg.progress;

  return (
    <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-[#0f0f0f]">
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-4 text-center">
        <div className="relative h-16 w-16">
          <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50" cy="50" r={r}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="4"
              fill="none"
            />
            <circle
              cx="50" cy="50" r={r}
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${C}`}
              className={cn('transition-[stroke-dasharray] duration-500 ease-out', cfg.color)}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={cn('text-xs font-medium', cfg.color)}>
              {Math.round(cfg.progress * 100)}%
            </span>
          </div>
        </div>
        <p className="text-xs text-gray-400">{cfg.label}</p>
        {hint && (
          <p className="text-[10px] text-gray-600 line-clamp-1 max-w-[80%]">{hint}</p>
        )}
      </div>
    </div>
  );
}

interface TemplateGroup {
  templateId: string;
  templateName: string;
  templateThumbnail: string;
  variations: Generation[];
}

function VariationSlide({
  gen,
  isSelected,
  onToggleSelect,
  onEdit,
}: {
  gen: Generation;
  isSelected: boolean;
  onToggleSelect: () => void;
  onEdit: () => void;
}) {
  const isCompleted = gen.status === 'completed';
  const isFailed = gen.status === 'failed';
  const isPending = !isCompleted && !isFailed;
  const status = statusConfig[gen.status] || statusConfig.pending_analysis;
  const angle = gen.input_data?.variationAngle || `V${gen.input_data?.variationIndex || ''}`;
  const title = gen.input_data?.variationTitle || '';

  return (
    <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-[#0a0a0a]">
      {isCompleted && gen.result_url ? (
        <>
          <img
            src={gen.result_url}
            alt={title || `Variation ${gen.input_data?.variationIndex || ''}`}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            onClick={onToggleSelect}
          />
          <div
            className={cn(
              'absolute inset-0 flex items-center justify-center bg-[#07A498]/20 backdrop-blur-sm transition-opacity cursor-pointer',
              isSelected ? 'opacity-100' : 'opacity-0'
            )}
            onClick={onToggleSelect}
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#07A498] shadow-xl">
              <Check className="h-7 w-7 text-white" />
            </div>
          </div>
          <div className="absolute top-3 left-3 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide bg-black/60 text-white rounded-full pointer-events-none">
            {angle}
          </div>
          {gen.version && gen.version > 1 && (
            <div className="absolute top-3 right-3 px-2 py-0.5 text-[10px] font-medium bg-purple-500/90 text-white rounded-full pointer-events-none">
              v{gen.version}
            </div>
          )}
        </>
      ) : isPending ? (
        <LoadingTile
          status={gen.status}
          hint={angle}
          templateThumbnail={gen.input_data?.templateThumbnail}
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-gradient-to-br from-red-950/40 to-red-900/10 border border-red-500/20 rounded-xl">
          <AlertCircle className="h-12 w-12 mb-2 text-red-400" />
          <p className="text-sm font-bold text-red-400 mb-1">Error</p>
          <p className="text-[10px] text-red-400/70 line-clamp-3 text-center">{gen.error_message || 'Error en generación'}</p>
        </div>
      )}

      {/* Bottom action bar overlay (only on completed) */}
      {isCompleted && (
        <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-between">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={onToggleSelect}
              className="h-4 w-4 cursor-pointer rounded accent-[#07A498]"
              onClick={(e) => e.stopPropagation()}
            />
            {title && <span className="text-[11px] text-white/80 line-clamp-1 max-w-[170px]">{title}</span>}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/10 hover:bg-white/20 text-white text-[11px] font-medium transition"
          >
            <Edit2 className="h-3 w-3" />
            Editar
          </button>
        </div>
      )}
    </div>
  );
}

function TemplateCard({
  group,
  selectedImages,
  onToggleSelect,
  onEdit,
}: {
  group: TemplateGroup;
  selectedImages: string[];
  onToggleSelect: (id: string) => void;
  onEdit: (gen: Generation) => void;
}) {
  const [slideIndex, setSlideIndex] = useState(0);
  const variations = group.variations;
  const total = variations.length;
  const completed = variations.filter((v) => v.status === 'completed').length;
  const failed = variations.filter((v) => v.status === 'failed').length;
  const inProgress = total - completed - failed;
  const current = variations[Math.min(slideIndex, total - 1)];

  const next = () => setSlideIndex((i) => (i + 1) % total);
  const prev = () => setSlideIndex((i) => (i - 1 + total) % total);

  return (
    <div className="rounded-2xl border border-gray-800/60 bg-gradient-to-br from-[#1a1a1a] to-[#0f0f0f] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800/60">
        {group.templateThumbnail && (
          <img src={group.templateThumbnail} alt="" className="h-10 w-10 rounded-md object-cover border border-gray-800" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white line-clamp-1">{group.templateName}</p>
          <p className="text-[11px] text-gray-500">
            {completed}/{total} listas
            {inProgress > 0 && <span className="text-[#07A498]"> · {inProgress} en proceso</span>}
            {failed > 0 && <span className="text-red-400"> · {failed} fallidas</span>}
          </p>
        </div>
      </div>

      {/* Carousel */}
      <div className="relative group">
        <VariationSlide
          gen={current}
          isSelected={selectedImages.includes(current.id)}
          onToggleSelect={() => onToggleSelect(current.id)}
          onEdit={() => onEdit(current)}
        />

        {total > 1 && (
          <>
            <button
              onClick={prev}
              className="absolute left-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-black/60 backdrop-blur flex items-center justify-center text-white/80 hover:text-white hover:bg-black/80 transition opacity-0 group-hover:opacity-100"
              aria-label="Variación anterior"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={next}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-black/60 backdrop-blur flex items-center justify-center text-white/80 hover:text-white hover:bg-black/80 transition opacity-0 group-hover:opacity-100"
              aria-label="Variación siguiente"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}
      </div>

      {/* Dots */}
      {total > 1 && (
        <div className="flex items-center justify-center gap-1.5 py-3">
          {variations.map((v, i) => {
            const dotState =
              v.status === 'completed'
                ? 'bg-[#07A498]'
                : v.status === 'failed'
                  ? 'bg-red-500'
                  : 'bg-gray-600';
            const active = i === slideIndex;
            return (
              <button
                key={v.id}
                onClick={() => setSlideIndex(i)}
                className={cn(
                  'h-2 rounded-full transition-all',
                  active ? 'w-6 ring-1 ring-white/30' : 'w-2',
                  dotState
                )}
                aria-label={`Ir a variación ${i + 1}`}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ProjectDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [editingImage, setEditingImage] = useState<Generation | null>(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [generatedEditUrl, setGeneratedEditUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', params.id],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${params.id}`);
      if (!response.ok) throw new Error('Failed to fetch project');
      return response.json() as Promise<ProjectDetail>;
    },
    refetchInterval: (query) => {
        const data = query.state.data as ProjectDetail | undefined;
        // No data yet OR generations array hasn't been populated — keep
        // polling. The clone API inserts rows just before redirecting, but a
        // fast browser can render this page before those inserts land, leaving
        // the user staring at an empty grid forever if we don't poll.
        if (!data || !data.generations || data.generations.length === 0) return 2000;
        const hasPending = data.generations.some(
            (g: any) => ['pending_analysis', 'analyzing', 'adapting', 'generating_prompt', 'pending_generation', 'generating', 'processing'].includes(g.status)
        );
        return hasPending ? 2000 : false;
    }
  });
  
  // Effect to trigger queue processing if needed
  useEffect(() => {
    const processQueue = async () => {
        // Trigger processing for any non-terminal status
        const needsProcessing = project?.generations?.some(
            (g: any) => ['pending_analysis', 'analyzing', 'adapting', 'generating_prompt', 'pending_generation', 'generating'].includes(g.status)
        );
        if (needsProcessing) {
            try {
                await fetch('/api/static-ads/process-queue', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ projectId: params.id })
                });
            } catch (e) {
                console.error('Queue processing error', e);
            }
        }
    };
    
    if (project) {
        processQueue();
    }
  }, [project, params.id]);

  const toggleSelection = (id: string) => {
    setSelectedImages((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (!project) return;
    if (selectedImages.length === project.generations.length) {
      setSelectedImages([]);
    } else {
      setSelectedImages(project.generations.map((g) => g.id));
    }
  };

  const handleDownload = async () => {
    if (selectedImages.length === 0) return;
    
    // Simple download logic (opens in new tabs for now, zip would be better for many)
    selectedImages.forEach((id) => {
      const img = project?.generations.find((g) => g.id === id);
      if (img?.result_url) {
        window.open(img.result_url, '_blank');
      }
    });
    toast.success('Descarga iniciada');
  };

  // Edit Mutation - Uses new static-ads edit endpoint
  const editMutation = useMutation({
    mutationFn: async () => {
      if (!editingImage) return;
      setIsGenerating(true);
      setGeneratedEditUrl(null);

      // Call the new edit endpoint which handles Claude + Nano Banana internally
      const response = await fetch('/api/static-ads/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          generationId: editingImage.id,
          editInstructions: editPrompt
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        if (response.status === 402) {
          throw new Error(`Créditos insuficientes.`);
        }
        throw new Error(data.error || 'Error al editar imagen');
      }

      return {
        resultUrl: data.resultUrl,
        newGenerationId: data.newGenerationId,
        version: data.version
      };
    },
    onSuccess: (result) => {
      if (result) {
        setGeneratedEditUrl(result.resultUrl);
        toast.success(`Edición completada - Versión ${result.version || 2}`);
        // Refresh the project to show the new version
        queryClient.invalidateQueries({ queryKey: ['project', params.id] });
      }
      setIsGenerating(false);
    },
    onError: (error: any) => {
      setIsGenerating(false);
      toast.error(error.message || 'Error al editar imagen');
      console.error(error);
    }
  });

  const handleSaveEdit = async () => {
    // The new edit endpoint already saves the image, so we just need to close the drawer
    toast.success('Imagen guardada');
    setEditingImage(null);
    setGeneratedEditUrl(null);
    setEditPrompt('');
    // Refresh is already done in the mutation onSuccess
  };

  // Delete single generation
  const deleteGenerationMutation = useMutation({
    mutationFn: async (generationId: string) => {
      const response = await fetch(`/api/generations/${generationId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Error al eliminar');
      return response.json();
    },
    onSuccess: () => {
      toast.success('Imagen eliminada');
      queryClient.invalidateQueries({ queryKey: ['project', params.id] });
    },
    onError: () => {
      toast.error('Error al eliminar la imagen');
    }
  });

  // Delete entire project
  const deleteProjectMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/projects/${params.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Error al eliminar');
      return response.json();
    },
    onSuccess: () => {
      toast.success('Proyecto eliminado');
      router.push('/crear/static-ads/historial');
    },
    onError: () => {
      toast.error('Error al eliminar el proyecto');
    }
  });

  const handleDeleteSelected = () => {
    if (selectedImages.length === 0) return;
    if (!confirm(`¿Eliminar ${selectedImages.length} imagen(es) seleccionadas?`)) return;
    
    selectedImages.forEach(id => {
      deleteGenerationMutation.mutate(id);
    });
    setSelectedImages([]);
  };

  const handleDeleteProject = () => {
    if (!confirm('¿Eliminar todo el proyecto y todas sus imágenes?')) return;
    deleteProjectMutation.mutate();
  };

  // Group generations by template for the carousel UI.
  // Pre-migration projects (1 generation per template, no variationIndex) still work:
  // they end up as a "group" of 1, so the card shows a single non-carousel image.
  const templateGroups = useMemo<TemplateGroup[]>(() => {
    if (!project?.generations) return [];
    const map = new Map<string, Generation[]>();
    for (const gen of project.generations) {
      const tid = gen.input_data?.templateId || `__solo_${gen.id}`;
      if (!map.has(tid)) map.set(tid, []);
      map.get(tid)!.push(gen);
    }
    const groups: TemplateGroup[] = [];
    map.forEach((variations, templateId) => {
      variations.sort((a, b) => (a.input_data?.variationIndex || 0) - (b.input_data?.variationIndex || 0));
      const first = variations[0];
      groups.push({
        templateId,
        templateName: first.input_data?.templateName || 'Plantilla',
        templateThumbnail: first.input_data?.templateThumbnail || '',
        variations,
      });
    });
    return groups;
  }, [project?.generations]);

  // Calculate progress stats
  const progressStats = useMemo(() => {
    if (!project?.generations) return { completed: 0, failed: 0, inProgress: 0, total: 0, percentage: 0 };
    
    const completed = project.generations.filter(g => g.status === 'completed').length;
    const failed = project.generations.filter(g => g.status === 'failed').length;
    const total = project.generations.length;
    const inProgress = total - completed - failed;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    return { completed, failed, inProgress, total, percentage };
  }, [project?.generations]);

  const isProcessing = progressStats.inProgress > 0;

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-black">
        <Loader2 className="h-8 w-8 animate-spin text-[#07A498]" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-black text-white">
      {/* Main Content */}
      <div className={cn("flex-1 overflow-y-auto p-6 transition-all", editingImage ? "mr-[400px]" : "")}>
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/crear/static-ads/historial')}
              className="flex items-center gap-2 text-gray-400 transition hover:text-white"
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="text-sm">Volver</span>
            </button>
            <h1 className="text-2xl font-bold">{project?.name}</h1>
          </div>
          
          <div className="flex gap-3">
            {!isProcessing && (
              <>
                <Button
                  variant="outline"
                  onClick={handleSelectAll}
                  className="border-gray-700 text-gray-300 hover:text-white"
                >
                  {selectedImages.length === project?.generations.length ? 'Deseleccionar' : 'Seleccionar Todo'}
                </Button>
                {selectedImages.length > 0 && (
                  <>
                    <Button
                      onClick={handleDownload}
                      className="bg-[#07A498] text-white hover:bg-[#068f84]"
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Descargar ({selectedImages.length})
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleDeleteSelected}
                      className="border-red-500/50 text-red-400 hover:bg-red-500/10 hover:border-red-500"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Eliminar ({selectedImages.length})
                    </Button>
                  </>
                )}
              </>
            )}
            <Button
              variant="outline"
              onClick={handleDeleteProject}
              className="border-gray-700 text-gray-400 hover:text-red-400 hover:border-red-500/50"
              title="Eliminar proyecto completo"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Progress Bar - only show when processing */}
        {isProcessing && (
          <div className="mb-6 p-4 rounded-xl bg-[#141414] border border-gray-800">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-[#07A498]" />
                <span className="font-medium">Generando imágenes...</span>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-green-400">{progressStats.completed} completadas</span>
                <span className="text-gray-400">{progressStats.inProgress} en proceso</span>
                {progressStats.failed > 0 && <span className="text-red-400">{progressStats.failed} fallidas</span>}
              </div>
            </div>
            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-[#07A498] to-[#0AC6B7] transition-all duration-500"
                style={{ width: `${progressStats.percentage}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Estimado: ~{Math.max(1, Math.ceil(progressStats.inProgress * 0.5))} minutos restantes
            </p>
          </div>
        )}

        {/* Grid — one card per template, with carousel of variations.
            When there are no rows yet (clone API still inserting), we render
            a single LoadingTile placeholder so the user sees the same
            liquid-glass loading animation as a real tile. The query keeps
            polling, so the placeholder is replaced as soon as the row lands. */}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {templateGroups.length === 0 && (
            <div className="rounded-2xl border border-gray-800/60 bg-gradient-to-br from-[#1a1a1a] to-[#0f0f0f] overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800/60">
                <div className="h-10 w-10 rounded-md bg-white/5 animate-pulse" />
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="h-3 w-32 rounded bg-white/5 animate-pulse" />
                  <div className="h-2 w-20 rounded bg-white/5 animate-pulse" />
                </div>
              </div>
              <LoadingTile status="pending_analysis" hint="Iniciando" />
            </div>
          )}

          {templateGroups.map((group) => (
            <TemplateCard
              key={group.templateId}
              group={group}
              selectedImages={selectedImages}
              onToggleSelect={toggleSelection}
              onEdit={(gen) => {
                setEditingImage(gen);
                setEditPrompt('');
                setGeneratedEditUrl(null);
              }}
            />
          ))}
        </div>
      </div>

      {/* Edit Drawer */}
      <div 
        className={cn(
          "fixed right-0 top-0 h-screen w-[400px] bg-[#141414] border-l border-gray-800 shadow-2xl transition-transform duration-300 transform p-6 flex flex-col z-50",
          editingImage ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[#07A498]" />
            Editor IA
          </h2>
          <button 
            onClick={() => setEditingImage(null)}
            className="text-gray-400 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {editingImage && (
          <div className="flex-1 flex flex-col gap-6 overflow-y-auto">
            {/* Image Preview */}
            <div className="relative aspect-square rounded-lg overflow-hidden border border-gray-700">
              <img
                src={generatedEditUrl || editingImage.result_url}
                alt="Editing"
                className="h-full w-full object-cover"
              />
              {isGenerating && (
                <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-[#07A498] mb-2" />
                  <p className="text-sm text-gray-300">Generando magia...</p>
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-300 mb-2 block">
                  Instrucciones
                </label>
                <Textarea
                  placeholder="Ej: Cambia el fondo a un atardecer en la playa, haz que sonría más..."
                  value={editPrompt}
                  onChange={(e) => setEditPrompt(e.target.value)}
                  className="bg-[#0a0a0a] border-gray-800 focus:border-[#07A498] min-h-[100px]"
                />
              </div>

              <Button
                onClick={() => editMutation.mutate()}
                disabled={isGenerating || !editPrompt}
                className="w-full bg-[#07A498] hover:bg-[#068f84] text-white"
              >
                {isGenerating ? 'Generando...' : 'Generar Edición'}
              </Button>

              {generatedEditUrl && (
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <Button
                    variant="outline"
                    onClick={() => setGeneratedEditUrl(null)}
                    className="border-gray-700 hover:bg-gray-800 text-gray-300"
                  >
                    <Undo2 className="mr-2 h-4 w-4" />
                    Deshacer
                  </Button>
                  <Button
                    onClick={handleSaveEdit}
                    className="bg-white text-black hover:bg-gray-200"
                  >
                    <Save className="mr-2 h-4 w-4" />
                    Guardar
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
