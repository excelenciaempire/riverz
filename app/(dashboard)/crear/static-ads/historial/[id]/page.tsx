'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Download, Check, Edit2, Loader2, X, Sparkles, Trash2, Clock, AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, Columns2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { prettyName } from '@/lib/pretty-name';

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

/**
 * Circular progress ring for the edit drawer overlay, time-synced to the
 * kie.ai Nano Banana edit call. There's no backend status stream for a
 * single edit (the /api/static-ads/edit endpoint blocks until the poll
 * completes), so we ease 0→95% over the empirical P75 wall-clock for the
 * `generating` segment (SEGMENT_DURATION_MS.generating). When the fetch
 * resolves and `active` flips false, the parent unmounts the overlay,
 * which is the de-facto "100% complete" signal.
 */
function EditProgressRing({ active }: { active: boolean }) {
  const SEGMENT_MS = SEGMENT_DURATION_MS.generating; // ~90s — matches LoadingTile
  const startedAtRef = useRef<number>(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!active) return;
    startedAtRef.current = Date.now();
    const tick = () => {
      const elapsed = Math.max(0, Date.now() - startedAtRef.current);
      const t = Math.min(1, elapsed / SEGMENT_MS);
      const eased = 1 - Math.pow(1 - t, 2);
      // Cap short of 100 so the actual completion (overlay unmount) feels
      // like real forward motion instead of a no-op.
      setProgress(eased * 95);
    };
    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [active, SEGMENT_MS]);

  const r = 44;
  const C = 2 * Math.PI * r;
  const dash = (C * progress) / 100;

  return (
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
          className="text-[#07A498] transition-[stroke-dasharray] duration-200 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[11px] font-medium tabular-nums text-gray-200">
          {Math.round(progress)}%
        </span>
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
  onCompare,
  onDownload,
}: {
  gen: Generation;
  isSelected: boolean;
  onToggleSelect: () => void;
  onEdit: () => void;
  onCompare: () => void;
  onDownload: () => void;
}) {
  const isCompleted = gen.status === 'completed';
  const isFailed = gen.status === 'failed';
  const isPending = !isCompleted && !isFailed;
  const angle = gen.input_data?.variationAngle || `V${gen.input_data?.variationIndex || ''}`;
  const title = gen.input_data?.variationTitle || '';

  if (isCompleted && gen.result_url) {
    return (
      <div className="relative overflow-hidden rounded-xl bg-[#0a0a0a]">
        {/* Image renders at its natural aspect ratio so masonry placement
            matches the static-ads template grid — no forced 3:4 crop. The
            image itself is intentionally inert: clicking does nothing. The
            Editar / Comparar actions live in the hover overlay below. */}
        <img
          src={gen.result_url}
          alt={title || `Variation ${gen.input_data?.variationIndex || ''}`}
          className="block w-full h-auto select-none"
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
              ? 'bg-[#07A498] text-white'
              : 'bg-black/40 text-white/40 hover:text-white hover:bg-black/70 group-hover:text-white/80 group-hover:bg-black/60',
          )}
        >
          <Check className="h-3.5 w-3.5" />
        </button>

        {/* Hover overlay anchored to the bottom of the image, holding the two
            actions: Editar (opens AI editor drawer) and Comparar (opens the
            template-vs-result modal). */}
        <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-2 px-3 pt-8 pb-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-black/70 hover:bg-black/90 text-white text-[12px] font-medium transition border border-white/10"
          >
            <Edit2 className="h-3.5 w-3.5" />
            Editar
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onCompare(); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-black/70 hover:bg-black/90 text-white text-[12px] font-medium transition border border-white/10"
          >
            <Columns2 className="h-3.5 w-3.5" />
            Comparar
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDownload(); }}
            aria-label="Descargar"
            title="Descargar"
            className="flex items-center justify-center h-[30px] w-[30px] rounded-md bg-black/70 hover:bg-black/90 text-white transition border border-white/10"
          >
            <Download className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  if (isPending) {
    return (
      <LoadingTile
        gen={gen}
        hint={angle}
        templateThumbnail={gen.input_data?.templateThumbnail}
      />
    );
  }

  return (
    <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-[#0a0a0a]">
      <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-gradient-to-br from-red-950/40 to-red-900/10 border border-red-500/20 rounded-xl">
        <AlertCircle className="h-12 w-12 mb-2 text-red-400" />
        <p className="text-sm font-bold text-red-400 mb-1">Error</p>
        <p className="text-[10px] text-red-400/70 line-clamp-3 text-center">{gen.error_message || 'Error en generación'}</p>
      </div>
    </div>
  );
}

function TemplateCard({
  group,
  selectedImages,
  onToggleSelect,
  onEdit,
  onCompare,
  onDownload,
}: {
  group: TemplateGroup;
  selectedImages: string[];
  onToggleSelect: (id: string) => void;
  onEdit: (gen: Generation) => void;
  onCompare: (gen: Generation) => void;
  onDownload: (gen: Generation) => void;
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
    <div className="mb-4 break-inside-avoid rounded-2xl overflow-hidden">
      {/* Carousel */}
      <div className="relative group">
        <VariationSlide
          gen={current}
          isSelected={selectedImages.includes(current.id)}
          onToggleSelect={() => onToggleSelect(current.id)}
          onEdit={() => onEdit(current)}
          onCompare={() => onCompare(current)}
          onDownload={() => onDownload(current)}
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
  const [comparingGen, setComparingGen] = useState<Generation | null>(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  // Currently-displayed version inside the editor drawer. Each edit produces a
  // new generation linked to its parent via parent_id, so a "version chain" is
  // just the ancestor/descendant walk from the original `editingImage`.
  const [currentVersionId, setCurrentVersionId] = useState<string | null>(null);
  // After a successful edit, the new generation's id may not be in the React
  // Query cache yet (refetch is in flight). Stash it here and a small effect
  // navigates to it as soon as it lands in the chain.
  const [pendingVersionId, setPendingVersionId] = useState<string | null>(null);

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
  
  // Adaptive throttle for process-queue triggers.
  //
  // Two regimes:
  //   - SLOW (8s) while any row is in a Gemini step (analyzing/adapting/...).
  //     Each tick that "claims" Step 1 or 2 burns 60–120s of LLM time, and
  //     the atomic CAS on status already serializes them, so spamming the
  //     endpoint just adds wasted HTTP roundtrips with no UX gain.
  //   - FAST (3s) when every active row has reached Nano Banana phase
  //     (pending_generation / generating). Step 5 is just a single cheap
  //     GET to kie.ai's /jobs/recordInfo + (on SUCCESS) a download+upload
  //     to Supabase Storage. Polling faster here directly shortens the
  //     "98% Generando stuck after kie.ai already finished" window — that
  //     used to be up to 8s of pure waiting on the throttle alone.
  const lastProcessQueueAtRef = useRef<number>(0);
  const PROCESS_QUEUE_SLOW_MS = 8_000;
  const PROCESS_QUEUE_FAST_MS = 3_000;

  useEffect(() => {
    const processQueue = async () => {
        const earlyPhaseStatuses = ['pending_analysis', 'analyzing', 'adapting', 'generating_prompt'];
        const latePhaseStatuses  = ['pending_generation', 'generating'];

        const inEarlyPhase = project?.generations?.some((g: any) => earlyPhaseStatuses.includes(g.status)) ?? false;
        const inLatePhase  = project?.generations?.some((g: any) => latePhaseStatuses.includes(g.status))  ?? false;

        if (!inEarlyPhase && !inLatePhase) return;

        const interval = inEarlyPhase ? PROCESS_QUEUE_SLOW_MS : PROCESS_QUEUE_FAST_MS;
        const now = Date.now();
        if (now - lastProcessQueueAtRef.current < interval) return;
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

  // Pull the image bytes through fetch + Blob so the browser respects the
  // `download` attribute. Loading the URL directly opens it in a new tab on
  // most browsers (Supabase Storage serves with inline disposition).
  const downloadGeneration = async (gen: Generation) => {
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
      console.error('Download failed for', gen.id, err);
      toast.error('Error al descargar la imagen');
    }
  };

  const handleDownload = async () => {
    if (selectedImages.length === 0) return;
    const targets = selectedImages
      .map((id) => project?.generations.find((g) => g.id === id))
      .filter((g): g is Generation => !!g?.result_url);
    if (targets.length === 0) return;

    toast.success(`Descargando ${targets.length} imagen${targets.length === 1 ? '' : 'es'}...`);
    for (const gen of targets) await downloadGeneration(gen);
  };

  const handleDownloadOne = async (gen: Generation) => {
    if (!gen.result_url) return;
    toast.success('Descargando imagen…');
    await downloadGeneration(gen);
  };

  // Build the version chain that contains `editingImage`. We walk parent_id
  // back to the chain root (a generation with no parent in this project) and
  // then forward to its newest descendant, picking the most-recently-created
  // child at each fork. The result is an ordered list from v1 → vN that the
  // editor drawer paginates through with chevrons.
  const versionChain = useMemo<Generation[]>(() => {
    if (!editingImage || !project?.generations?.length) return editingImage ? [editingImage] : [];
    const all = project.generations;
    const byId = new Map(all.map(g => [g.id, g]));
    const childrenByParent = new Map<string, Generation[]>();
    for (const g of all) {
      if (!g.parent_id) continue;
      const arr = childrenByParent.get(g.parent_id) ?? [];
      arr.push(g);
      childrenByParent.set(g.parent_id, arr);
    }
    let root: Generation = editingImage;
    while (root.parent_id && byId.has(root.parent_id)) {
      root = byId.get(root.parent_id)!;
    }
    const chain: Generation[] = [root];
    let cur: Generation | undefined = root;
    while (cur) {
      const kids = childrenByParent.get(cur.id);
      if (!kids?.length) break;
      const next = kids.slice().sort(
        (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      )[0];
      chain.push(next);
      cur = next;
    }
    return chain;
  }, [editingImage, project]);

  // When the drawer opens (or the user re-opens with a different image), jump
  // the viewer to that image. The chain above will span its full version history.
  useEffect(() => {
    if (editingImage) {
      setCurrentVersionId(editingImage.id);
      setPendingVersionId(null);
      setEditPrompt('');
    } else {
      setCurrentVersionId(null);
      setPendingVersionId(null);
    }
  }, [editingImage?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // After a successful edit, navigate to the new version as soon as it shows
  // up in the refetched chain.
  useEffect(() => {
    if (!pendingVersionId) return;
    if (versionChain.some(g => g.id === pendingVersionId)) {
      setCurrentVersionId(pendingVersionId);
      setPendingVersionId(null);
    }
  }, [pendingVersionId, versionChain]);

  const currentVersionIdx = versionChain.findIndex(g => g.id === currentVersionId);
  const currentVersion = currentVersionIdx >= 0 ? versionChain[currentVersionIdx] : editingImage;
  const hasPrevVersion = currentVersionIdx > 0;
  const hasNextVersion = currentVersionIdx >= 0 && currentVersionIdx < versionChain.length - 1;

  // Edit Mutation - Uses new static-ads edit endpoint
  const editMutation = useMutation({
    mutationFn: async () => {
      if (!editingImage) return;
      // Source the edit from the *exact same object* that backs the visible
      // <img>. `currentVersion` is what the drawer is rendering right now, so
      // sending its id (instead of the looser `currentVersionId ?? editingImage.id`
      // fallback) guarantees the photo on screen is the photo kie.ai receives,
      // even if the chain is mid-refetch or the id state lags by a tick.
      const source = currentVersion ?? editingImage;
      if (!source) return;
      setIsGenerating(true);

      const response = await fetch('/api/static-ads/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          generationId: source.id,
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
        // Stash the new generation id and let the chain effect navigate to it
        // once the React Query refetch surfaces it.
        setPendingVersionId(result.newGenerationId);
        setEditPrompt('');
        toast.success(`Edición completada - Versión ${result.version || 2}`);
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
      <div className={cn("flex-1 overflow-y-auto transition-all", editingImage ? "mr-[560px]" : "")}>
        <div className="mx-auto max-w-[1800px] p-6">
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
            <h1 className="text-2xl font-bold">{prettyName(project?.name)}</h1>
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

        {/* Masonry — same column layout as the templates grid (static-ads page).
            Each card flows into the shortest column, so images render at their
            natural aspect ratio without forced 3:4 cropping. */}
        <div className="columns-2 lg:columns-3 xl:columns-4 gap-4">
          {templateGroups.length === 0 && (
            <div className="mb-4 break-inside-avoid rounded-2xl border border-gray-800/60 bg-gradient-to-br from-[#1a1a1a] to-[#0f0f0f] overflow-hidden">
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
              }}
              onCompare={(gen) => setComparingGen(gen)}
              onDownload={(gen) => handleDownloadOne(gen)}
            />
          ))}
        </div>
        </div>
      </div>

      {/* Comparison modal — centered card (not fullscreen) showing the
          original template thumbnail next to the generated result. Both
          images use object-contain inside a fixed-aspect cell so they sit
          side by side at the same visual size, regardless of source aspect. */}
      {comparingGen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setComparingGen(null)}
        >
          <div
            className="relative w-full max-w-3xl max-h-[85vh] flex flex-col rounded-2xl border border-gray-800 bg-[#141414] shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Floating close button — the named header was removed because
                template names are often raw filenames that look ugly to the
                customer. The modal stands on its own without a title. */}
            <button
              onClick={() => setComparingGen(null)}
              className="absolute top-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white/80 hover:text-white hover:bg-black/80 transition"
              aria-label="Cerrar comparación"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex-1 grid grid-cols-2 gap-3 p-4 overflow-auto">
              <div className="flex flex-col items-center gap-2">
                <div className="text-[10px] uppercase tracking-wider text-gray-400">
                  Plantilla original
                </div>
                {comparingGen.input_data?.templateThumbnail ? (
                  <img
                    src={comparingGen.input_data.templateThumbnail}
                    alt="Plantilla original"
                    className="max-w-full max-h-[60vh] w-auto h-auto rounded-lg border border-white/10 object-contain"
                  />
                ) : (
                  <div className="flex items-center justify-center w-full aspect-[3/4] rounded-lg border border-white/10 text-gray-500 text-xs">
                    Sin plantilla original
                  </div>
                )}
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="text-[10px] uppercase tracking-wider text-[#07A498]">
                  Resultado generado
                </div>
                <img
                  src={comparingGen.result_url}
                  alt="Resultado generado"
                  className="max-w-full max-h-[60vh] w-auto h-auto rounded-lg border border-white/10 object-contain"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Drawer */}
      <div
        className={cn(
          "fixed right-0 top-0 h-screen w-[560px] bg-[#141414] border-l border-gray-800 shadow-2xl transition-transform duration-300 transform p-6 flex flex-col z-50",
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

        {editingImage && currentVersion && (
          // min-h-0 lets the inner image area actually shrink/grow to fit
          // available vertical space instead of forcing a scrollbar on the
          // whole drawer when the image is tall.
          <div className="flex-1 min-h-0 flex flex-col gap-4">
            {/* Image preview — fills all space the controls don't need.
                object-contain keeps any aspect ratio (3:4, 1:1, 9:16) visible
                end-to-end without cropping. */}
            <div className="relative flex-1 min-h-0 rounded-lg overflow-hidden border border-gray-700 bg-[#0a0a0a] flex items-center justify-center">
              <img
                src={currentVersion.result_url}
                alt={`Versión ${currentVersionIdx + 1}`}
                className="max-h-full max-w-full w-auto h-auto object-contain"
              />

              {/* Version pager — arrows live INSIDE the image so the layout
                  stays compact and feels like a carousel. Only render an arrow
                  when there's somewhere to go. */}
              {hasPrevVersion && !isGenerating && (
                <button
                  type="button"
                  onClick={() => setCurrentVersionId(versionChain[currentVersionIdx - 1].id)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur flex items-center justify-center text-white transition shadow-lg"
                  aria-label="Versión anterior"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
              )}
              {hasNextVersion && !isGenerating && (
                <button
                  type="button"
                  onClick={() => setCurrentVersionId(versionChain[currentVersionIdx + 1].id)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur flex items-center justify-center text-white transition shadow-lg"
                  aria-label="Siguiente versión"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              )}

              {versionChain.length > 1 && (
                <div className="absolute top-2 right-2 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur text-[11px] font-medium text-white tabular-nums">
                  v{currentVersionIdx + 1} / {versionChain.length}
                </div>
              )}

              {isGenerating && (
                <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-3">
                  <EditProgressRing active={isGenerating} />
                  <p className="text-sm text-gray-300">Generando magia...</p>
                </div>
              )}
            </div>

            {/* Controls — always visible at the bottom of the drawer, never
                scrolled out of reach. */}
            <div className="shrink-0 space-y-3">
              <Textarea
                placeholder="Ej: Cambia el fondo a un atardecer en la playa, haz que sonría más..."
                value={editPrompt}
                onChange={(e) => setEditPrompt(e.target.value)}
                disabled={isGenerating}
                className="bg-[#0a0a0a] border-gray-800 focus:border-[#07A498] min-h-[88px] resize-none"
              />

              <Button
                onClick={() => editMutation.mutate()}
                disabled={isGenerating || !editPrompt}
                className="w-full bg-[#07A498] hover:bg-[#068f84] text-white h-11"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generando...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generar Edición
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
