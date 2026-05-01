'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
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

// Each backend status maps to a [floor, ceiling] window on the loader ring.
// The floor is GROUND TRUTH — when the backend advances the row's status,
// the ring snaps to at least the floor of the new segment. Within a segment
// we ramp smoothly toward the ceiling using REAL elapsed time since the
// status started (read from updated_at / stepLogs), so a page reload keeps
// the same percentage instead of restarting from the floor.
//
// Floor/ceiling allocation is roughly proportional to typical wall-clock
// time per stage so the ring's pace feels honest end-to-end:
//   analyzing  (Step 1, Gemini vision)        ~90s
//   adapting   (Step 2, Gemini vision)        ~80s
//   pending_generation (Step 4 claim)         ~5s
//   generating (Step 4+5, Nano Banana)        ~75s
//
// Total per image ≈ 4–5 minutes. The ranges below sum to 0→99; 100% is only
// reachable by `status='completed'`, at which point the parent unmounts the
// tile and shows the actual image.
const STATUS_RANGE: Record<string, { label: string; floor: number; ceiling: number }> = {
  pending_analysis:   { label: 'En cola',     floor: 0,   ceiling: 5  },
  pending_variation:  { label: 'En cola',     floor: 0,   ceiling: 5  },
  analyzing:          { label: 'Analizando',  floor: 5,   ceiling: 35 },
  adapting:           { label: 'Adaptando',   floor: 35,  ceiling: 65 },
  generating_prompt:  { label: 'Procesando',  floor: 65,  ceiling: 70 },
  pending_generation: { label: 'Procesando',  floor: 65,  ceiling: 70 },
  generating:         { label: 'Generando',   floor: 70,  ceiling: 99 },
  completed:          { label: 'Listo',       floor: 100, ceiling: 100 },
  failed:             { label: 'Error',       floor: 0,   ceiling: 0  },
};

// Empirical P75 wall-clock per status (in ms). Derived from observed kie.ai
// latencies per step. The ring's eased curve uses this as the "this status
// will probably take roughly N ms" anchor; if the real call takes longer,
// the ring asymptotes toward 95% of the segment ceiling without crossing.
const SEGMENT_DURATION_MS: Record<string, number> = {
  pending_analysis: 5_000,
  pending_variation: 5_000,
  analyzing: 120_000,
  adapting: 100_000,
  generating_prompt: 5_000,
  pending_generation: 10_000,
  generating: 90_000,
};

/**
 * Resolve the wall-clock time at which the row entered its current status.
 *
 * Priority of sources (most → least precise):
 *   1. The relevant stepLog's completedAt — these are the exact instants
 *      Gemini Step N finished, which is the same instant the row moved into
 *      Step N+1's status. Survives page reloads because stepLogs live on
 *      input_data in the DB.
 *   2. Row updated_at — bumped on every status transition (atomic claim).
 *      Slightly off if input_data was persisted after the claim, but the gap
 *      is microseconds in practice.
 *   3. created_at — last-resort fallback for brand-new rows.
 */
function getStatusStartedAtMs(gen: Generation): number {
  const logs: Array<{ step: number; status: string; completedAt: string }> = Array.isArray(
    gen.input_data?.stepLogs,
  )
    ? gen.input_data.stepLogs
    : [];
  const lastOk = (step: number) => {
    // Walk backwards so retries pick the most recent successful boundary.
    for (let i = logs.length - 1; i >= 0; i--) {
      const l = logs[i];
      if (l.step === step && l.status === 'ok') return new Date(l.completedAt).getTime();
    }
    return null;
  };
  let derived: number | null = null;
  switch (gen.status) {
    case 'analyzing':
      // Step 1 in flight — segment started at row claim, before any log exists.
      break;
    case 'adapting':
      derived = lastOk(1);
      break;
    case 'generating_prompt':
    case 'pending_generation':
      derived = lastOk(2);
      break;
    case 'generating':
      derived = lastOk(4) ?? lastOk(2);
      break;
    default:
      break;
  }
  if (derived) return derived;
  if (gen.updated_at) return new Date(gen.updated_at).getTime();
  if (gen.created_at) return new Date(gen.created_at).getTime();
  return Date.now();
}

/**
 * Minimalist loading tile, synced to backend status AND wall-clock time.
 *
 * The progress ring's value is determined by:
 *   1. The row's actual status → fixes the [floor, ceiling] segment.
 *   2. The real elapsed time since that status started → eases through the
 *      segment with a fixed time budget. Reloading the page just re-reads
 *      the segment start from the row, so the ring resumes where it was
 *      instead of snapping back to the floor.
 *
 * 100% is unreachable by simulation — only `status='completed'` lands it
 * there, at which point the parent unmounts the tile.
 */
function LoadingTile({ gen }: { gen: Generation; hint?: string; templateThumbnail?: string }) {
  const status = gen.status;
  const cfg = STATUS_RANGE[status] || STATUS_RANGE.pending_analysis;
  const segmentStartedAt = useMemo(
    () => getStatusStartedAtMs(gen),
    // We intentionally re-derive only when the status or the tracked timestamps
    // change — within a status, segmentStartedAt is invariant.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gen.id, gen.status, gen.updated_at, gen.input_data?.stepLogs?.length],
  );

  const computeProgress = (): number => {
    if (status === 'completed') return 100;
    if (status === 'failed') return cfg.floor;
    const segmentMs = SEGMENT_DURATION_MS[status] || 30_000;
    const elapsed = Math.max(0, Date.now() - segmentStartedAt);
    const t = Math.min(1, elapsed / segmentMs);
    const eased = 1 - Math.pow(1 - t, 2);
    // 0.95 keeps us short of the ceiling so the next status transition feels
    // like genuine forward motion instead of a no-op.
    return cfg.floor + (cfg.ceiling - cfg.floor) * eased * 0.95;
  };

  const [progress, setProgress] = useState<number>(() => computeProgress());

  useEffect(() => {
    if (status === 'failed' || status === 'completed') {
      setProgress(computeProgress());
      return;
    }
    setProgress(computeProgress());
    const id = setInterval(() => setProgress(computeProgress()), 500);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, segmentStartedAt]);

  const r = 44;
  const C = 2 * Math.PI * r;
  const dash = (C * progress) / 100;
  const isFailed = status === 'failed';

  return (
    <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-[#0f0f0f]">
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-4 text-center">
        <div className="relative h-16 w-16">
          <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50" cy="50" r={r}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="3"
              fill="none"
            />
            <circle
              cx="50" cy="50" r={r}
              stroke="currentColor"
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${C}`}
              className={cn(
                'transition-[stroke-dasharray] duration-500 ease-out',
                isFailed ? 'text-red-400' : 'text-[#07A498]',
              )}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={cn('text-[11px] font-medium tabular-nums', isFailed ? 'text-red-400' : 'text-gray-200')}>
              {isFailed ? '!' : `${Math.round(progress)}%`}
            </span>
          </div>
        </div>
        <p className="text-[11px] text-gray-500">{cfg.label}</p>
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
          {/* Subtle ring + small check when selected — no big overlay */}
          <div
            className={cn(
              'absolute inset-0 transition-all pointer-events-none rounded-xl',
              isSelected ? 'ring-2 ring-[#07A498] bg-[#07A498]/5' : '',
            )}
          />
          <div
            className={cn(
              'absolute top-3 right-3 flex h-6 w-6 items-center justify-center rounded-full transition-all',
              isSelected
                ? 'bg-[#07A498] text-white'
                : 'bg-black/40 text-white/0 group-hover:text-white/80 group-hover:bg-black/60',
            )}
          >
            <Check className="h-3.5 w-3.5" />
          </div>
        </>
      ) : isPending ? (
        <LoadingTile
          gen={gen}
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

      {/* Subtle "Editar" pill that appears on hover, only for completed.
          The full-image click handles selection — no separate checkbox. */}
      {isCompleted && (
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          className="absolute bottom-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-black/60 hover:bg-black/80 text-white text-[11px] font-medium transition opacity-0 group-hover:opacity-100"
        >
          <Edit2 className="h-3 w-3" />
          Editar
        </button>
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
    <div className="rounded-2xl overflow-hidden">
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
  
  // Throttle process-queue triggers. The query refetches every 2s while
  // generations are pending, which used to fire process-queue every 2s and
  // overlapping ticks each created their own Gemini calls. Now we only
  // POST process-queue at most once every 8s — the backend has its own
  // atomic claim per step so even concurrent calls are safe, but throttling
  // here removes the wasted HTTP roundtrips entirely.
  const lastProcessQueueAtRef = useRef<number>(0);
  const PROCESS_QUEUE_MIN_INTERVAL_MS = 8_000;

  useEffect(() => {
    const processQueue = async () => {
        // Trigger processing for any non-terminal status
        const needsProcessing = project?.generations?.some(
            (g: any) => ['pending_analysis', 'analyzing', 'adapting', 'generating_prompt', 'pending_generation', 'generating'].includes(g.status)
        );
        if (!needsProcessing) return;

        const now = Date.now();
        if (now - lastProcessQueueAtRef.current < PROCESS_QUEUE_MIN_INTERVAL_MS) return;
        lastProcessQueueAtRef.current = now;

        try {
            await fetch('/api/static-ads/process-queue', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId: params.id })
            });
        } catch (e) {
            console.error('Queue processing error', e);
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
    const targets = selectedImages
      .map((id) => project?.generations.find((g) => g.id === id))
      .filter((g): g is Generation => !!g?.result_url);
    if (targets.length === 0) return;

    toast.success(`Descargando ${targets.length} imagen${targets.length === 1 ? '' : 'es'}...`);
    // Fetch each as a Blob and trigger an actual download via an anchor
    // with the `download` attribute. This bypasses the browser opening the
    // image in a new tab (the previous behaviour that prompted this fix).
    for (const gen of targets) {
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
        console.error('Download failed for', gen.id, err);
      }
    }
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
              <LoadingTile
                gen={{
                  id: '__placeholder__',
                  result_url: '',
                  status: 'pending_analysis',
                  input_data: {},
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                } as Generation}
                hint="Iniciando"
              />
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
