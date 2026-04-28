'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { ArrowUp, Image as ImageIcon, Loader2, Plus, Download } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';

type Status = 'pending_generation' | 'generating' | 'completed' | 'failed';

interface Generation {
  id: string;
  status: Status;
  result_url: string | null;
  error_message: string | null;
  cost: number | null;
  created_at: string;
  input_data: {
    prompt: string;
    firstFrameUrl?: string | null;
    lastFrameUrl?: string | null;
    model?: string;
    aspectRatio?: string;
    index?: number;
    total?: number;
  };
}

interface SessionDetail {
  id: string;
  name: string;
  generations: Generation[];
}

const MODEL_OPTIONS: Array<{ value: 'veo3' | 'veo3_fast' | 'veo3_lite'; label: string }> = [
  { value: 'veo3_fast', label: 'Veo 3.1 Fast' },
  { value: 'veo3', label: 'Veo 3.1 Quality' },
  { value: 'veo3_lite', label: 'Veo 3.1 Lite' },
];

const ASPECT_OPTIONS: Array<{ value: '9:16' | '16:9' | 'Auto'; label: string }> = [
  { value: '9:16', label: '9:16' },
  { value: '16:9', label: '16:9' },
  { value: 'Auto', label: 'Auto' },
];

async function uploadFrame(file: File): Promise<string> {
  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename: file.name, contentType: file.type }),
  });
  if (!res.ok) throw new Error(await res.text());
  const { signedUrl, publicUrl } = await res.json();

  const upload = await fetch(signedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });
  if (!upload.ok) throw new Error(`Upload failed: ${upload.status}`);
  return publicUrl;
}

function FramePicker({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: { url: string; preview: string } | null;
  onChange: (next: { url: string; preview: string } | null) => void;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file) return;
    setBusy(true);
    const preview = URL.createObjectURL(file);
    try {
      const url = await uploadFrame(file);
      onChange({ url, preview });
    } catch (err: any) {
      toast.error(`No se pudo subir ${label}: ${err.message || 'error'}`);
      URL.revokeObjectURL(preview);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'group relative h-12 w-12 overflow-hidden rounded-lg border border-gray-700 bg-gray-900/60 transition-colors',
          'hover:border-[#07A498] hover:bg-gray-900',
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
      >
        {busy ? (
          <div className="flex h-full w-full items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
          </div>
        ) : value ? (
          <>
            <img src={value.preview} alt={label} className="h-full w-full object-cover" />
            <div className="absolute inset-0 hidden items-center justify-center bg-black/60 group-hover:flex">
              <ImageIcon className="h-4 w-4 text-white" />
            </div>
          </>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-0.5 text-gray-400">
            <Plus className="h-4 w-4" />
            <span className="text-[9px] uppercase tracking-wide">{label}</span>
          </div>
        )}
      </button>
      {value && !busy && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="text-[10px] text-gray-500 hover:text-red-400"
        >
          quitar
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = '';
        }}
      />
    </div>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const map: Record<Status, { label: string; className: string }> = {
    pending_generation: { label: 'En cola', className: 'bg-gray-700/40 text-gray-300' },
    generating: { label: 'Generando', className: 'bg-[#07A498]/20 text-[#07A498]' },
    completed: { label: 'Listo', className: 'bg-green-500/20 text-green-400' },
    failed: { label: 'Error', className: 'bg-red-500/20 text-red-400' },
  };
  const m = map[status];
  return <span className={cn('inline-block rounded px-2 py-0.5 text-[11px]', m.className)}>{m.label}</span>;
}

function VideoTile({ gen }: { gen: Generation }) {
  const isReady = gen.status === 'completed' && gen.result_url;
  const isFailed = gen.status === 'failed';
  return (
    <div className="group relative aspect-[9/16] overflow-hidden rounded-xl border border-gray-800 bg-[#0a0a0a]">
      {isReady ? (
        <video
          src={gen.result_url!}
          controls
          className="h-full w-full object-cover"
          preload="metadata"
        />
      ) : isFailed ? (
        <div className="flex h-full flex-col items-center justify-center gap-2 p-3 text-center">
          <span className="text-xs font-medium text-red-400">Error</span>
          <span className="line-clamp-3 text-[10px] text-gray-500">{gen.error_message || 'kie.ai falló'}</span>
        </div>
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin text-[#07A498]" />
          <StatusBadge status={gen.status} />
        </div>
      )}
      {isReady && (
        <a
          href={gen.result_url!}
          download
          className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white opacity-0 transition-opacity hover:bg-black/80 group-hover:opacity-100"
          onClick={(e) => e.stopPropagation()}
        >
          <Download className="h-3.5 w-3.5" />
        </a>
      )}
    </div>
  );
}

interface MessageGroup {
  prompt: string;
  firstFrameUrl?: string | null;
  lastFrameUrl?: string | null;
  model?: string;
  aspectRatio?: string;
  createdAt: string;
  generations: Generation[];
}

function groupByMessage(generations: Generation[]): MessageGroup[] {
  const groups = new Map<string, MessageGroup>();
  const sorted = [...generations].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  for (const g of sorted) {
    const minute = Math.floor(new Date(g.created_at).getTime() / 60000);
    const key = `${g.input_data.prompt}|${g.input_data.firstFrameUrl || ''}|${g.input_data.lastFrameUrl || ''}|${minute}`;
    if (!groups.has(key)) {
      groups.set(key, {
        prompt: g.input_data.prompt,
        firstFrameUrl: g.input_data.firstFrameUrl,
        lastFrameUrl: g.input_data.lastFrameUrl,
        model: g.input_data.model,
        aspectRatio: g.input_data.aspectRatio,
        createdAt: g.created_at,
        generations: [],
      });
    }
    groups.get(key)!.generations.push(g);
  }
  return Array.from(groups.values());
}

export default function UGCChatPage() {
  return (
    <Suspense fallback={<div className="flex h-[calc(100vh-32px)] items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-gray-500" /></div>}>
      <UGCChatInner />
    </Suspense>
  );
}

function UGCChatInner() {
  const { user } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const supabase = createClient();

  const sessionIdFromUrl = searchParams.get('session');
  const [activeSessionId, setActiveSessionId] = useState<string | null>(sessionIdFromUrl);

  const [prompt, setPrompt] = useState('');
  const [firstFrame, setFirstFrame] = useState<{ url: string; preview: string } | null>(null);
  const [lastFrame, setLastFrame] = useState<{ url: string; preview: string } | null>(null);
  const [count, setCount] = useState(1);
  const [model, setModel] = useState<'veo3' | 'veo3_fast' | 'veo3_lite'>('veo3_fast');
  const [aspectRatio, setAspectRatio] = useState<'9:16' | '16:9' | 'Auto'>('9:16');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const sessionQuery = useQuery({
    queryKey: ['ugc-session', activeSessionId],
    enabled: !!activeSessionId,
    queryFn: async (): Promise<SessionDetail> => {
      const res = await fetch(`/api/projects/${activeSessionId}`);
      if (!res.ok) throw new Error('No se pudo cargar la sesión');
      return res.json();
    },
    refetchInterval: (q) => {
      const data = q.state.data as SessionDetail | undefined;
      const hasPending = data?.generations?.some(
        (g) => g.status === 'pending_generation' || g.status === 'generating',
      );
      return hasPending ? 3000 : false;
    },
  });

  const sessionsQuery = useQuery({
    queryKey: ['ugc-sessions', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, created_at')
        .eq('clerk_user_id', user!.id)
        .eq('type', 'ugc_chat')
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      return data || [];
    },
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      const body = {
        prompt: prompt.trim(),
        firstFrameUrl: firstFrame?.url || null,
        lastFrameUrl: lastFrame?.url || null,
        model,
        aspectRatio,
        count,
        projectId: activeSessionId,
      };
      const res = await fetch('/api/ugc/chat-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      return res.json();
    },
    onSuccess: (data) => {
      setPrompt('');
      setFirstFrame((prev) => {
        if (prev) URL.revokeObjectURL(prev.preview);
        return null;
      });
      setLastFrame((prev) => {
        if (prev) URL.revokeObjectURL(prev.preview);
        return null;
      });
      const newId = data.projectId || activeSessionId;
      if (!activeSessionId && data.projectId) {
        setActiveSessionId(data.projectId);
        const url = new URL(window.location.href);
        url.searchParams.set('session', data.projectId);
        window.history.replaceState({}, '', url.toString());
      }
      queryClient.invalidateQueries({ queryKey: ['ugc-session', newId] });
      queryClient.invalidateQueries({ queryKey: ['ugc-sessions', user?.id] });
      toast.success(`Generando ${data.generations?.length || count} video(s)`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const groups = useMemo<MessageGroup[]>(
    () => (sessionQuery.data ? groupByMessage(sessionQuery.data.generations) : []),
    [sessionQuery.data],
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [groups.length, sessionQuery.data?.generations.length]);

  const newSession = () => {
    setActiveSessionId(null);
    const url = new URL(window.location.href);
    url.searchParams.delete('session');
    window.history.replaceState({}, '', url.toString());
  };

  const canSend = prompt.trim().length > 0 && !sendMutation.isPending;

  return (
    <div className="flex h-[calc(100vh-32px)] gap-4 p-4">
      <aside className="hidden w-64 shrink-0 flex-col gap-3 lg:flex">
        <button
          onClick={newSession}
          className="flex items-center justify-center gap-2 rounded-lg border border-gray-800 bg-gray-900/40 px-3 py-2 text-sm text-gray-300 transition-colors hover:border-[#07A498] hover:text-white"
        >
          <Plus className="h-4 w-4" /> Nueva conversación
        </button>
        <div className="flex-1 overflow-y-auto pr-1">
          <p className="mb-2 px-1 text-[11px] font-medium uppercase tracking-wide text-gray-500">
            Historial
          </p>
          <div className="space-y-1">
            {(sessionsQuery.data || []).map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  setActiveSessionId(s.id);
                  const url = new URL(window.location.href);
                  url.searchParams.set('session', s.id);
                  window.history.replaceState({}, '', url.toString());
                }}
                className={cn(
                  'block w-full truncate rounded-md px-2.5 py-2 text-left text-sm transition-colors',
                  activeSessionId === s.id
                    ? 'bg-[#07A498]/10 text-white'
                    : 'text-gray-400 hover:bg-gray-900/50 hover:text-white',
                )}
                title={s.name}
              >
                {s.name}
              </button>
            ))}
            {sessionsQuery.data?.length === 0 && (
              <p className="px-2 text-xs text-gray-600">Sin conversaciones aún.</p>
            )}
          </div>
        </div>
      </aside>

      <main className="flex flex-1 flex-col">
        <header className="mb-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-white">Videos UGC</h1>
            <p className="text-xs text-gray-500">
              Veo 3.1 · prompt + frame inicial / final opcional · hasta 4 a la vez
            </p>
          </div>
          {activeSessionId && (
            <button onClick={newSession} className="text-xs text-gray-400 hover:text-white">
              Nueva conversación
            </button>
          )}
        </header>

        <div className="flex-1 overflow-y-auto rounded-xl border border-gray-800 bg-black/30 p-4">
          {!activeSessionId ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <p className="max-w-md text-sm text-gray-400">
                Describe el video que quieres crear. Sube una imagen como frame inicial y/o
                final si quieres más control sobre el resultado.
              </p>
            </div>
          ) : sessionQuery.isLoading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
            </div>
          ) : groups.length === 0 ? (
            <p className="text-sm text-gray-500">Esta conversación está vacía.</p>
          ) : (
            <div className="space-y-6">
              {groups.map((g, i) => (
                <div key={i} className="space-y-3">
                  <div className="rounded-xl bg-gray-900/40 px-4 py-3">
                    <div className="flex flex-wrap items-start gap-3">
                      {g.firstFrameUrl && (
                        <img src={g.firstFrameUrl} alt="inicial" className="h-16 w-16 rounded-md object-cover" />
                      )}
                      {g.lastFrameUrl && (
                        <img src={g.lastFrameUrl} alt="final" className="h-16 w-16 rounded-md object-cover" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="whitespace-pre-wrap text-sm text-gray-200">{g.prompt}</p>
                        <p className="mt-1 text-[10px] uppercase tracking-wide text-gray-500">
                          {g.model || 'veo3_fast'} · {g.aspectRatio || '9:16'} · {g.generations.length} video(s)
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {g.generations.map((gen) => (
                      <VideoTile key={gen.id} gen={gen} />
                    ))}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        <div className="mt-3 rounded-2xl border border-gray-800 bg-gray-900/40 p-3">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && canSend) {
                e.preventDefault();
                sendMutation.mutate();
              }
            }}
            disabled={sendMutation.isPending}
            placeholder="¿Qué quieres crear?"
            rows={2}
            className="w-full resize-none bg-transparent text-sm text-white placeholder:text-gray-500 focus:outline-none"
          />
          <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
            <div className="flex items-center gap-3">
              <FramePicker label="Inicial" value={firstFrame} onChange={setFirstFrame} disabled={sendMutation.isPending} />
              <FramePicker label="Final" value={lastFrame} onChange={setLastFrame} disabled={sendMutation.isPending} />
            </div>
            <div className="flex items-center gap-2">
              <select
                value={model}
                onChange={(e) => setModel(e.target.value as typeof model)}
                disabled={sendMutation.isPending}
                className="rounded-md border border-gray-700 bg-gray-900 px-2 py-1.5 text-xs text-gray-200 focus:border-[#07A498] focus:outline-none"
              >
                {MODEL_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <select
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value as typeof aspectRatio)}
                disabled={sendMutation.isPending}
                className="rounded-md border border-gray-700 bg-gray-900 px-2 py-1.5 text-xs text-gray-200 focus:border-[#07A498] focus:outline-none"
              >
                {ASPECT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <select
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                disabled={sendMutation.isPending}
                className="rounded-md border border-gray-700 bg-gray-900 px-2 py-1.5 text-xs text-gray-200 focus:border-[#07A498] focus:outline-none"
                title="Cantidad"
              >
                {[1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>x{n}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => sendMutation.mutate()}
                disabled={!canSend}
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-full transition-colors',
                  canSend
                    ? 'bg-[#07A498] text-white hover:bg-[#068f84]'
                    : 'cursor-not-allowed bg-gray-800 text-gray-600',
                )}
              >
                {sendMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowUp className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
