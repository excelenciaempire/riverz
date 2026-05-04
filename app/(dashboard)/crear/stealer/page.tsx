'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Upload, Loader2, Film, Clock, User2, Mic2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface StealerProjectListItem {
  id: string;
  name: string | null;
  status: string;
  source_duration_sec: number | null;
  created_at: string;
}

const STATUS_LABEL: Record<string, { label: string; tone: 'gray' | 'blue' | 'green' | 'red' }> = {
  ingesting: { label: 'Ingestando', tone: 'blue' },
  scenes_ready: { label: 'Detectando escenas', tone: 'blue' },
  awaiting_user_review: { label: 'Listo para revisar', tone: 'green' },
  processing: { label: 'Generando clips', tone: 'blue' },
  completed: { label: 'Completado', tone: 'green' },
  failed: { label: 'Error', tone: 'red' },
};

const TONE_CLASS: Record<string, string> = {
  gray: 'text-[var(--rvz-ink-muted)] bg-gray-500/10 border-[var(--rvz-card-border)]',
  blue: 'text-blue-300 bg-blue-500/10 border-blue-500/30',
  green: 'text-green-300 bg-green-500/10 border-green-500/30',
  red: 'text-red-300 bg-red-500/10 border-red-500/30',
};

interface AvatarOpt { id: string; name: string; image_url: string }
interface VoiceOpt { id: string; name: string; language: string | null; gender: string | null; accent: string | null }

export default function StealerLandingPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [avatarId, setAvatarId] = useState<string | null>(null);
  const [voiceId, setVoiceId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['stealer-projects'],
    queryFn: async () => {
      const res = await fetch('/api/stealer/projects');
      if (!res.ok) throw new Error('Failed to load projects');
      return res.json() as Promise<{ projects: StealerProjectListItem[] }>;
    },
    refetchInterval: 10000,
  });

  const { data: avatars } = useQuery({
    queryKey: ['avatars'],
    queryFn: async () => {
      const res = await fetch('/api/avatars');
      if (!res.ok) return { avatars: [] };
      return res.json() as Promise<{ avatars: AvatarOpt[] }>;
    },
    staleTime: 60000,
  });

  const { data: voices } = useQuery({
    queryKey: ['voices'],
    queryFn: async () => {
      const res = await fetch('/api/voices');
      if (!res.ok) return { voices: [] };
      return res.json() as Promise<{ voices: VoiceOpt[] }>;
    },
    staleTime: 60000,
  });

  const handleSubmit = async () => {
    if (!file) {
      toast.error('Selecciona un video MP4 primero');
      return;
    }
    if (file.size > 500 * 1024 * 1024) {
      toast.error('El video supera 500 MB');
      return;
    }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      if (name.trim()) fd.append('name', name.trim());
      if (avatarId) fd.append('avatar_id', avatarId);
      if (voiceId) fd.append('voice_id', voiceId);

      const res = await fetch('/api/stealer/ingest', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to ingest');

      toast.success('Video subido. Detectando escenas...');
      router.push(`/crear/stealer/${json.projectId}`);
    } catch (err: any) {
      toast.error(err.message || 'Error al subir');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-[var(--rvz-ink)] p-6 lg:p-10">
      <div className="mx-auto max-w-5xl space-y-10">
        {/* Header */}
        <header>
          <h1 className="text-3xl font-bold">STEALER · Clonador de anuncios</h1>
          <p className="mt-2 text-sm text-[var(--rvz-ink-muted)] max-w-2xl">
            Sube un anuncio ganador. Detectamos escenas y voz, regeneramos cada plano con tu marca,
            y te devolvemos un paquete de clips listos para subir a Meta Ads.
          </p>
        </header>

        {/* Upload card */}
        <section className="rounded-2xl border border-[var(--rvz-card-border)] bg-gradient-to-br from-[#141414] to-[#0a0a0a] p-6">
          <h2 className="mb-4 text-lg font-semibold">Nuevo proyecto</h2>

          <div className="grid gap-5">
            <div>
              <Label className="text-sm text-[var(--rvz-ink-muted)]">Nombre (opcional)</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Anuncio Mascarilla Q4"
                className="mt-1 bg-[var(--rvz-bg)] border-[var(--rvz-card-border)]"
              />
            </div>

            <div>
              <Label className="text-sm text-[var(--rvz-ink-muted)]">Video fuente (MP4, máx. 500 MB)</Label>
              <div
                onClick={() => fileRef.current?.click()}
                className={cn(
                  'mt-1 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[var(--rvz-card-border)] bg-[var(--rvz-bg)] py-10 transition hover:border-[#07A498]',
                  file && 'border-[#07A498]/50 bg-[#07A498]/5'
                )}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept="video/mp4,video/quicktime,video/webm"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
                {file ? (
                  <>
                    <Film className="h-10 w-10 text-[#07A498] mb-3" />
                    <p className="text-sm font-medium">{file.name}</p>
                    <p className="text-xs text-[var(--rvz-ink-muted)]">{(file.size / 1024 / 1024).toFixed(1)} MB · click para cambiar</p>
                  </>
                ) : (
                  <>
                    <Upload className="h-10 w-10 text-[var(--rvz-ink-muted)] mb-3" />
                    <p className="text-sm">Arrastra el archivo aquí o click para seleccionar</p>
                    <p className="text-xs text-[var(--rvz-ink)] mt-1">Vertical 9:16 funciona mejor para Meta Ads</p>
                  </>
                )}
              </div>
            </div>

            {/* Avatar selector — only relevant for actor scenes; optional. */}
            <div>
              <Label className="text-sm text-[var(--rvz-ink-muted)] flex items-center gap-2">
                <User2 className="h-3.5 w-3.5" />
                Avatar para escenas de actor (opcional)
              </Label>
              <p className="mt-1 text-xs text-[var(--rvz-ink-muted)]">
                Si no eliges, las escenas de actor usan el frame original como referencia visual.
              </p>
              <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                <button
                  type="button"
                  onClick={() => setAvatarId(null)}
                  className={cn(
                    'shrink-0 flex items-center justify-center w-16 h-16 rounded-lg border text-[10px] uppercase tracking-wide',
                    avatarId === null ? 'border-[#07A498] bg-[#07A498]/10 text-[#07A498]' : 'border-[var(--rvz-card-border)] bg-[var(--rvz-bg)] text-[var(--rvz-ink-muted)]'
                  )}
                >
                  Ninguno
                </button>
                {avatars?.avatars?.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setAvatarId(a.id)}
                    className={cn(
                      'shrink-0 w-16 h-16 rounded-lg border overflow-hidden relative',
                      avatarId === a.id ? 'border-[#07A498] ring-2 ring-[#07A498]/40' : 'border-[var(--rvz-card-border)]'
                    )}
                    title={a.name}
                  >
                    {a.image_url ? (
                      <img src={a.image_url} alt={a.name} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-[10px] text-[var(--rvz-ink-muted)]">{a.name}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Voice selector — feeds ElevenLabs TTS. Optional: if none, audio fuente. */}
            <div>
              <Label className="text-sm text-[var(--rvz-ink-muted)] flex items-center gap-2">
                <Mic2 className="h-3.5 w-3.5" />
                Voz para el audio nuevo (opcional)
              </Label>
              <p className="mt-1 text-xs text-[var(--rvz-ink-muted)]">
                Sin voz = mantenemos la voz del anuncio original. Con voz = re-narramos el guion con ElevenLabs.
              </p>
              <select
                value={voiceId || ''}
                onChange={(e) => setVoiceId(e.target.value || null)}
                className="mt-2 w-full bg-[var(--rvz-bg)] border border-[var(--rvz-card-border)] rounded-md px-3 py-2 text-sm text-[var(--rvz-ink)]"
              >
                <option value="">Sin voz (usar audio original)</option>
                {voices?.voices?.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                    {v.language ? ` · ${v.language}` : ''}
                    {v.gender ? ` · ${v.gender}` : ''}
                    {v.accent ? ` · ${v.accent}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <Button
              onClick={handleSubmit}
              disabled={!file || uploading}
              className="bg-[#07A498] text-[var(--rvz-ink)] hover:bg-[#068f84]"
            >
              {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {uploading ? 'Subiendo...' : 'Iniciar análisis'}
            </Button>
          </div>
        </section>

        {/* Project list */}
        <section>
          <h2 className="mb-4 text-lg font-semibold">Mis proyectos</h2>
          {isLoading ? (
            <div className="flex items-center gap-2 text-[var(--rvz-ink-muted)] text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando...
            </div>
          ) : data?.projects?.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--rvz-card-border)] p-10 text-center text-[var(--rvz-ink-muted)] text-sm">
              No tienes proyectos todavía. Sube un video arriba para empezar.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data?.projects?.map((p) => {
                const meta = STATUS_LABEL[p.status] || { label: p.status, tone: 'gray' as const };
                return (
                  <Link
                    key={p.id}
                    href={`/crear/stealer/${p.id}`}
                    className="group rounded-xl border border-[var(--rvz-card-border)] bg-[var(--rvz-card)] p-4 transition hover:border-[var(--rvz-card-border)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{p.name || `Proyecto ${p.id.slice(0, 6)}`}</p>
                        <div className="mt-1 flex items-center gap-2 text-xs text-[var(--rvz-ink-muted)]">
                          <Clock className="h-3 w-3" />
                          {p.source_duration_sec ? `${Math.round(p.source_duration_sec)}s` : '—'}
                          <span>·</span>
                          <span>{new Date(p.created_at).toLocaleDateString('es-CO')}</span>
                        </div>
                      </div>
                      <span className={cn('shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium', TONE_CLASS[meta.tone])}>
                        {meta.label}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
