'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, User, Image as ImageIcon, Trash2, Play, Sparkles, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Scene {
  id: string;
  scene_index: number;
  start_sec: number;
  end_sec: number;
  type: 'actor' | 'broll';
  keyframe_path: string | null;
  keyframe_path_signed_url?: string;
  audio_text: string | null;
  status: string;
}

interface Project {
  id: string;
  name: string | null;
  status: string;
  source_video_path: string | null;
  source_video_path_signed_url?: string;
  source_duration_sec: number | null;
  transcript: any;
}

interface Asset {
  id: string;
  scene_id: string | null;
  kind: string;
  storage_path: string;
  storage_path_signed_url?: string;
  duration_sec: number | null;
}

interface ProjectResponse {
  project: Project;
  scenes: Scene[];
  assets: Asset[];
  jobs: { id: string; kind: string; status: string; error_message: string | null }[];
}

const STATUS_HINT: Record<string, string> = {
  ingesting: 'Subiendo y extrayendo audio...',
  scenes_ready: 'Escenas detectadas, transcribiendo audio...',
  awaiting_user_review: 'Listo para revisar',
  processing: 'Generando clips con IA...',
  completed: 'Listo',
  failed: 'Error',
};

export default function StealerProjectPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const projectId = params.id;

  const { data, isLoading } = useQuery({
    queryKey: ['stealer-project', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/stealer/projects/${projectId}`);
      if (!res.ok) throw new Error('Failed to load project');
      return res.json() as Promise<ProjectResponse>;
    },
    refetchInterval: (q) => {
      const p = q.state.data?.project;
      if (!p) return 3000;
      // Poll while pre-review or while jobs are running.
      return ['ingesting', 'scenes_ready', 'processing'].includes(p.status) ? 3000 : false;
    },
  });

  const project = data?.project;
  const scenes = useMemo(() => data?.scenes || [], [data?.scenes]);

  // Local working copy so the user can adjust scene boundaries without each
  // change hitting the backend immediately. We only persist on blur / explicit save.
  const [draft, setDraft] = useState<Record<string, Partial<Scene>>>({});
  const editable = project?.status === 'awaiting_user_review';

  useEffect(() => {
    setDraft({});
  }, [scenes.length, project?.status]);

  const totalDuration = project?.source_duration_sec || 0;

  const patchScene = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Scene> }) => {
      const res = await fetch(`/api/stealer/scenes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed');
      return json.scene as Scene;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stealer-project', projectId] });
    },
    onError: (err: any) => toast.error(err.message || 'No se pudo guardar la escena'),
  });

  const deleteScene = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/stealer/scenes/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || 'Delete failed');
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stealer-project', projectId] }),
    onError: (err: any) => toast.error(err.message || 'No se pudo eliminar'),
  });

  const startGeneration = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/stealer/projects/${projectId}/start`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to start');
      return json;
    },
    onSuccess: () => {
      toast.success('Generación iniciada');
      qc.invalidateQueries({ queryKey: ['stealer-project', projectId] });
    },
    onError: (err: any) => toast.error(err.message || 'No se pudo iniciar'),
  });

  if (isLoading || !project) {
    return (
      <div className="flex h-screen items-center justify-center bg-black">
        <Loader2 className="h-8 w-8 animate-spin text-[#07A498]" />
      </div>
    );
  }

  const completed = scenes.filter((s) => s.status === 'completed').length;
  const failed = scenes.filter((s) => s.status === 'failed').length;
  const inProgress = scenes.length - completed - failed;

  return (
    <div className="min-h-screen bg-black text-white p-6 lg:p-10">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/crear/stealer" className="text-gray-400 hover:text-white">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold">{project.name || `Proyecto ${project.id.slice(0, 6)}`}</h1>
              <p className="text-xs text-gray-500">{STATUS_HINT[project.status] || project.status}</p>
            </div>
          </div>

          {editable && scenes.length > 0 && (
            <Button
              onClick={() => startGeneration.mutate()}
              disabled={startGeneration.isPending}
              className="bg-[#07A498] text-white hover:bg-[#068f84]"
            >
              {startGeneration.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Aprobar y generar
            </Button>
          )}
        </div>

        {/* Source preview */}
        {project.source_video_path_signed_url && (
          <video
            src={project.source_video_path_signed_url}
            controls
            className="w-full max-w-3xl rounded-xl border border-gray-800"
          />
        )}

        {/* Status banner while waiting for the worker */}
        {(project.status === 'ingesting' || project.status === 'scenes_ready') && (
          <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-4 flex items-center gap-3 text-blue-200 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            {STATUS_HINT[project.status]}
          </div>
        )}

        {project.status === 'failed' && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 flex items-center gap-3 text-red-200 text-sm">
            <AlertCircle className="h-4 w-4" />
            Algo falló durante el procesamiento. Revisa los jobs abajo.
          </div>
        )}

        {/* Timeline */}
        {scenes.length > 0 && (
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Escenas detectadas ({scenes.length})</h2>
              <p className="text-xs text-gray-500">
                {editable
                  ? 'Marca cada escena como Actor o B-Roll, ajusta tiempos si quieres, luego aprueba.'
                  : `${completed} listas · ${inProgress} en proceso · ${failed} con error`}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {scenes.map((scene) => {
                const d = draft[scene.id] || {};
                const start = (d.start_sec as number) ?? scene.start_sec;
                const end = (d.end_sec as number) ?? scene.end_sec;
                const duration = (end - start).toFixed(2);
                const type = (d.type as 'actor' | 'broll') ?? scene.type;
                const sceneAsset = data?.assets?.find((a) => a.scene_id === scene.id && (a.kind === 'actor_clip' || a.kind === 'broll_clip' || a.kind === 'lipsync_clip'));

                return (
                  <div key={scene.id} className="rounded-xl border border-gray-800 bg-[#141414] overflow-hidden">
                    <div className="relative aspect-[9/16] bg-[#0a0a0a]">
                      {sceneAsset?.storage_path_signed_url ? (
                        <video
                          src={sceneAsset.storage_path_signed_url}
                          controls
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                      ) : scene.keyframe_path_signed_url ? (
                        <img
                          src={scene.keyframe_path_signed_url}
                          alt={`Escena ${scene.scene_index}`}
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
                        </div>
                      )}
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/60 text-[10px] font-mono">
                        #{scene.scene_index + 1} · {duration}s
                      </div>
                    </div>

                    <div className="p-3 space-y-2">
                      {/* Type toggle */}
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          disabled={!editable}
                          onClick={() => patchScene.mutate({ id: scene.id, patch: { type: 'actor' } })}
                          className={cn(
                            'flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition border',
                            type === 'actor'
                              ? 'bg-purple-500/20 text-purple-200 border-purple-500/40'
                              : 'bg-[#0a0a0a] text-gray-400 border-gray-800',
                            !editable && 'opacity-60 cursor-not-allowed'
                          )}
                        >
                          <User className="h-3.5 w-3.5" />
                          Actor
                        </button>
                        <button
                          disabled={!editable}
                          onClick={() => patchScene.mutate({ id: scene.id, patch: { type: 'broll' } })}
                          className={cn(
                            'flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition border',
                            type === 'broll'
                              ? 'bg-amber-500/20 text-amber-200 border-amber-500/40'
                              : 'bg-[#0a0a0a] text-gray-400 border-gray-800',
                            !editable && 'opacity-60 cursor-not-allowed'
                          )}
                        >
                          <ImageIcon className="h-3.5 w-3.5" />
                          B-Roll
                        </button>
                      </div>

                      {/* Bounds editing */}
                      {editable && (
                        <div className="grid grid-cols-2 gap-1.5">
                          <SecondsField
                            label="Inicio"
                            value={start}
                            min={0}
                            max={end - 0.1}
                            onChange={(v) => setDraft((d) => ({ ...d, [scene.id]: { ...d[scene.id], start_sec: v } }))}
                            onCommit={(v) => patchScene.mutate({ id: scene.id, patch: { start_sec: v } })}
                          />
                          <SecondsField
                            label="Fin"
                            value={end}
                            min={start + 0.1}
                            max={totalDuration || 9999}
                            onChange={(v) => setDraft((d) => ({ ...d, [scene.id]: { ...d[scene.id], end_sec: v } }))}
                            onCommit={(v) => patchScene.mutate({ id: scene.id, patch: { end_sec: v } })}
                          />
                        </div>
                      )}

                      {/* Status / delete */}
                      <div className="flex items-center justify-between text-[10px] uppercase tracking-wide">
                        <span className={cn(
                          'font-medium',
                          scene.status === 'completed' && 'text-green-400',
                          scene.status === 'failed' && 'text-red-400',
                          scene.status === 'pending' && 'text-gray-500',
                        )}>
                          {scene.status}
                        </span>
                        {editable && (
                          <button
                            onClick={() => {
                              if (confirm('Eliminar esta escena?')) deleteScene.mutate(scene.id);
                            }}
                            className="text-gray-500 hover:text-red-400 transition"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Jobs (debug-ish; helpful while the pipeline is being built out) */}
        {data?.jobs && data.jobs.length > 0 && (
          <details className="rounded-xl border border-gray-800 bg-[#0a0a0a] p-4 text-xs">
            <summary className="cursor-pointer text-gray-400">Jobs internos ({data.jobs.length})</summary>
            <div className="mt-3 space-y-1 font-mono text-[11px]">
              {data.jobs.map((j) => (
                <div key={j.id} className="flex justify-between gap-3">
                  <span className="text-gray-300">{j.kind}</span>
                  <span className={cn(
                    j.status === 'succeeded' && 'text-green-400',
                    j.status === 'failed' && 'text-red-400',
                    j.status === 'running' && 'text-blue-400',
                    j.status === 'pending' && 'text-gray-500',
                  )}>
                    {j.status}
                  </span>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}

function SecondsField({
  label,
  value,
  min,
  max,
  onChange,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
  onCommit: (n: number) => void;
}) {
  return (
    <label className="block">
      <span className="text-[9px] uppercase tracking-wider text-gray-500">{label}</span>
      <input
        type="number"
        step={0.1}
        min={min}
        max={max}
        value={Number(value).toFixed(2)}
        onChange={(e) => onChange(Number(e.target.value))}
        onBlur={(e) => {
          const v = Math.min(max, Math.max(min, Number(e.target.value)));
          onCommit(v);
        }}
        className="mt-0.5 w-full bg-[#0a0a0a] border border-gray-800 rounded px-2 py-1 text-xs text-white"
      />
    </label>
  );
}
