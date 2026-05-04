'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  X,
  Trophy,
  ThumbsDown,
  FileText,
  Loader2,
  Copy,
  ExternalLink,
  Download,
  Sparkles,
  Mic,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AdPerformanceChart } from '@/components/meta-ads/ad-performance-chart';
import type { MetaAdSummary, MetaAdIntel } from '@/types/meta';
import { cn } from '@/lib/utils';

interface Props {
  ad: MetaAdSummary;
  onClose: () => void;
}

export function AdDetailPanel({ ad, onClose }: Props) {
  const queryClient = useQueryClient();
  const [intel, setIntel] = useState<MetaAdIntel | null>(ad.intel ?? null);
  const [notes, setNotes] = useState<string>(ad.intel?.notes ?? '');

  useEffect(() => {
    setIntel(ad.intel ?? null);
    setNotes(ad.intel?.notes ?? '');
  }, [ad.id, ad.intel]);

  const transcribeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/meta/ads/${ad.id}/transcribe`, { method: 'POST' });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || 'No se pudo transcribir');
      return body.intel as MetaAdIntel;
    },
    onSuccess: (newIntel) => {
      setIntel(newIntel);
      toast.success('Transcripción lista');
      queryClient.invalidateQueries({ queryKey: ['meta-ads'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const intelMutation = useMutation({
    mutationFn: async (payload: { is_winner?: boolean | null; notes?: string }) => {
      const res = await fetch(`/api/meta/ads/${ad.id}/intel`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || 'No se pudo guardar');
      return body.intel as MetaAdIntel;
    },
    onSuccess: (newIntel) => {
      setIntel(newIntel);
      queryClient.invalidateQueries({ queryKey: ['meta-ads'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const setWinner = (val: boolean | null) => intelMutation.mutate({ is_winner: val });
  const saveNotes = () => intelMutation.mutate({ notes });

  const isVideo = ad.media_kind === 'video';
  const playableUrl = isVideo
    ? ad.video_source_url || intel?.asset_url || null
    : ad.image_url || intel?.asset_url || ad.thumbnail_url || null;
  const iframeFallbackUrl = isVideo && !playableUrl ? ad.video_embed_url || null : null;
  const previewUrl = playableUrl || ad.thumbnail_url || ad.image_url || null;
  // Always download the full-resolution variant when we have it.
  const downloadUrl = isVideo
    ? playableUrl
    : ad.image_full_url || ad.image_url || intel?.asset_url || ad.thumbnail_url || null;
  const downloadFilename = `${(ad.name || ad.id).replace(/[^a-z0-9-_]+/gi, '_')}.${
    isVideo ? 'mp4' : 'jpg'
  }`;
  const insights = ad.insights || intel?.insights;
  const isTranscribing = transcribeMutation.isPending || intel?.transcript_status === 'running';

  const handleDownload = async () => {
    if (!downloadUrl) return;
    try {
      const res = await fetch(downloadUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = downloadFilename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (err: any) {
      toast.error(`Descarga falló: ${err?.message || err}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/70" onClick={onClose} />
      <aside className="relative flex w-full max-w-2xl flex-col overflow-y-auto border-l border-[var(--rvz-card-border)] bg-[#0d0d0d]">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--rvz-card-border)] bg-[#0d0d0d] px-6 py-4">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-[var(--rvz-ink)]">{ad.name || ad.id}</p>
            <p className="truncate text-xs text-[var(--rvz-ink-muted)]">{ad.campaign_name || ad.campaign_id} · {ad.adset_name || ad.adset_id}</p>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-[var(--rvz-ink-muted)] hover:bg-[var(--rvz-card)] hover:text-[var(--rvz-ink)]">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Media player */}
        <div className="border-b border-[var(--rvz-card-border)] bg-black p-4">
          <div className="relative mx-auto aspect-square max-w-md overflow-hidden rounded-lg bg-black">
            {isVideo && playableUrl ? (
              <video
                src={playableUrl}
                controls
                playsInline
                poster={ad.thumbnail_url || undefined}
                className="h-full w-full object-contain"
              />
            ) : iframeFallbackUrl ? (
              // No mp4 — embed Meta's official preview iframe so playback
              // still works (transcription won't, since we don't have bytes).
              <iframe
                src={iframeFallbackUrl}
                title={ad.name}
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
                className="h-full w-full border-0"
              />
            ) : isVideo && !playableUrl && previewUrl ? (
              <>
                <img src={previewUrl} alt={ad.name} className="h-full w-full object-contain opacity-90" />
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/40">
                  <p className="text-sm text-[var(--rvz-ink-muted)]">Meta no devolvió el source.</p>
                  {ad.video_permalink_url && (
                    <a
                      href={ad.video_permalink_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-xs font-medium text-black hover:bg-white/90"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Ver en Facebook
                    </a>
                  )}
                </div>
              </>
            ) : previewUrl ? (
              <img src={previewUrl} alt={ad.name} className="h-full w-full object-contain" />
            ) : (
              <div className="flex h-full items-center justify-center text-[var(--rvz-ink)]">Sin preview</div>
            )}
          </div>
        </div>

        <div className="space-y-5 px-6 py-5">
          {/* Quick winner toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setWinner(intel?.is_winner === true ? null : true)}
              disabled={intelMutation.isPending}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition',
                intel?.is_winner === true
                  ? 'border-amber-400 bg-amber-400 text-black'
                  : 'border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20',
              )}
            >
              <Trophy className="h-3.5 w-3.5" />
              {intel?.is_winner === true ? 'Es WINNER ✓' : 'Marcar como winner'}
            </button>
            <button
              onClick={() => setWinner(intel?.is_winner === false ? null : false)}
              disabled={intelMutation.isPending}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition',
                intel?.is_winner === false
                  ? 'border-red-400 bg-red-500 text-[var(--rvz-ink)]'
                  : 'border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20',
              )}
            >
              <ThumbsDown className="h-3.5 w-3.5" />
              {intel?.is_winner === false ? 'No funciona ✓' : 'Marcar no funciona'}
            </button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => transcribeMutation.mutate()}
              disabled={isTranscribing}
            >
              {isTranscribing ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : isVideo ? (
                <Mic className="mr-1.5 h-3.5 w-3.5" />
              ) : (
                <FileText className="mr-1.5 h-3.5 w-3.5" />
              )}
              {intel?.transcript
                ? isVideo
                  ? 'Re-transcribir'
                  : 'Re-analizar'
                : isVideo
                  ? 'Transcribir con IA'
                  : 'Analizar con IA'}
            </Button>
            {downloadUrl && (
              <button
                onClick={handleDownload}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--rvz-card-border)] bg-black/40 px-3 py-1.5 text-xs text-[var(--rvz-ink-muted)] hover:text-[var(--rvz-ink)]"
              >
                <Download className="h-3.5 w-3.5" />
                Descargar
              </button>
            )}
            {ad.link_url && (
              <a
                href={ad.link_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--rvz-card-border)] bg-black/40 px-3 py-1.5 text-xs text-[var(--rvz-ink-muted)] hover:text-[var(--rvz-ink)]"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Abrir destino
              </a>
            )}
          </div>

          {/* Insights */}
          {insights && (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              <Stat label="Spend" value={insights.spend ? `$${Number(insights.spend).toFixed(2)}` : '—'} />
              <Stat label="Impr." value={insights.impressions ?? '—'} />
              <Stat label="Clicks" value={insights.clicks ?? '—'} />
              <Stat label="CTR" value={insights.ctr ? `${Number(insights.ctr).toFixed(2)}%` : '—'} />
              <Stat label="CPC" value={insights.cpc ? `$${Number(insights.cpc).toFixed(2)}` : '—'} />
              <Stat label="ROAS" value={insights.roas ? `${insights.roas.toFixed(2)}x` : '—'} />
            </div>
          )}

          {/* Performance time-series */}
          <Section title="Performance">
            <AdPerformanceChart adId={ad.id} datePreset="last_30d" />
          </Section>

          {/* Copy */}
          <Section title="Copy del anuncio">
            <CopyRow label="Texto principal" value={ad.primary_text} />
            <CopyRow label="Headline" value={ad.headline} />
            <CopyRow label="CTA" value={ad.cta} />
            <CopyRow label="Link" value={ad.link_url} />
          </Section>

          {/* Comments mining */}
          <CommentsSection
            adId={ad.id}
            initialIntel={intel}
            onIntelUpdate={setIntel}
          />

          {/* Transcript */}
          <Section title={`${isVideo ? 'Transcripción' : 'Análisis'} IA · kie.ai / Gemini 3 Pro`}>
            {isTranscribing && <TranscribingAnimation isVideo={isVideo} />}

            {!isTranscribing && intel?.transcript_status === 'failed' && (
              <p className="rounded border border-red-900 bg-red-900/20 p-2 text-xs text-red-300">
                {intel.transcript_error || 'Falló el análisis'}
              </p>
            )}

            {!isTranscribing && intel?.transcript && (
              <div className="relative rounded-lg border border-[var(--rvz-card-border)] bg-black/40 p-3">
                <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-[var(--rvz-ink-muted)]">
                  {intel.transcript}
                </pre>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(intel.transcript || '');
                    toast.success('Copiado');
                  }}
                  className="absolute right-2 top-2 rounded p-1 text-[var(--rvz-ink-muted)] hover:bg-[var(--rvz-card)] hover:text-[var(--rvz-ink)]"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {!isTranscribing && !intel?.transcript && (
              <p className="text-xs text-[var(--rvz-ink-muted)]">
                {isVideo
                  ? 'Manda el video a kie.ai · Gemini 3 Pro y trae transcripción del audio + OCR del texto en pantalla + hook visual + ángulo. Queda guardado en tu base de datos.'
                  : 'Extrae hook visual, OCR del texto en pantalla y posible ángulo con kie.ai · Gemini 3 Pro. Queda guardado en tu base de datos.'}
              </p>
            )}
          </Section>

          {/* Notes */}
          <Section title="Notas privadas (memoria de la IA)">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Por qué funciona / no funciona, ángulo, hook, hipótesis..."
              className="h-24 w-full resize-y rounded-lg border border-[var(--rvz-card-border)] bg-black/40 p-3 text-sm text-[var(--rvz-ink)] placeholder-gray-600 focus:border-[var(--rvz-ink)] focus:outline-none"
            />
            <Button size="sm" onClick={saveNotes} disabled={intelMutation.isPending}>
              {intelMutation.isPending ? 'Guardando...' : 'Guardar notas'}
            </Button>
          </Section>
        </div>
      </aside>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h4 className="text-xs uppercase tracking-wide text-[var(--rvz-ink-muted)]">{title}</h4>
      {children}
    </div>
  );
}

function CopyRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="rounded border border-[var(--rvz-card-border)] bg-black/30 p-2.5">
      <p className="text-[10px] uppercase text-[var(--rvz-ink-muted)]">{label}</p>
      <p className="mt-0.5 break-words text-sm text-[var(--rvz-ink)]">{value}</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-[var(--rvz-card-border)] bg-black/30 p-2">
      <div className="text-[9px] uppercase text-[var(--rvz-ink-muted)]">{label}</div>
      <div className="text-sm font-semibold text-[var(--rvz-ink)]">{value}</div>
    </div>
  );
}

function TranscribingAnimation({ isVideo }: { isVideo: boolean }) {
  return (
    <div className="overflow-hidden rounded-lg border border-[var(--rvz-ink)]/30 bg-gradient-to-br from-brand-accent/10 via-black/40 to-emerald-500/10 p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className="relative">
          <Sparkles className="h-4 w-4 text-[var(--rvz-ink)]" />
          <span className="absolute inset-0 animate-ping rounded-full bg-[var(--rvz-accent)]/40" />
        </div>
        <p className="text-sm font-medium text-[var(--rvz-ink)]">
          {isVideo
            ? 'Transcribiendo audio + visuales · kie.ai / Gemini 3 Pro'
            : 'Analizando · kie.ai / Gemini 3 Pro'}
        </p>
      </div>
      <div className="space-y-1.5">
        <SkeletonBar width="92%" delay="0ms" />
        <SkeletonBar width="78%" delay="150ms" />
        <SkeletonBar width="85%" delay="300ms" />
        <SkeletonBar width="64%" delay="450ms" />
        <SkeletonBar width="71%" delay="600ms" />
      </div>
      <p className="mt-3 text-[11px] text-[var(--rvz-ink-muted)]">
        {isVideo
          ? 'kie.ai está bajando el video, mandándolo a Gemini 3 Pro y esperando la respuesta. Suele tardar 30–90 s.'
          : 'kie.ai está mandando la imagen a Gemini 3 Pro. Suele tardar pocos segundos.'}
      </p>
    </div>
  );
}

function SkeletonBar({ width, delay }: { width: string; delay: string }) {
  return (
    <div
      className="h-2.5 animate-pulse rounded bg-[var(--rvz-bg-soft)]"
      style={{ width, animationDelay: delay }}
    />
  );
}

function CommentsSection({
  adId,
  initialIntel,
  onIntelUpdate,
}: {
  adId: string;
  initialIntel: MetaAdIntel | null;
  onIntelUpdate: (intel: MetaAdIntel) => void;
}) {
  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/meta/ads/${adId}/comments?force=1`, { method: 'POST' });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || 'Falló la sincronización');
      return body.intel as MetaAdIntel;
    },
    onSuccess: (newIntel) => {
      onIntelUpdate(newIntel);
      toast.success('Comentarios sincronizados');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const insights = initialIntel?.comments_insights ?? null;
  const summary = initialIntel?.comments_summary ?? null;
  const syncedAt = initialIntel?.comments_synced_at ?? null;

  return (
    <Section title="Comentarios">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-[var(--rvz-ink-muted)]">
          {syncedAt
            ? `Sincronizado: ${new Date(syncedAt).toLocaleString('es')}`
            : 'Aún no sincronizado.'}
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
        >
          {syncMutation.isPending ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          )}
          {syncedAt ? 'Resincronizar' : 'Sincronizar ahora'}
        </Button>
      </div>

      {insights ? (
        <div className="space-y-3">
          <SentimentBars sentiment={insights.sentiment} total={insights.total} />
          {summary && (
            <p className="rounded border border-[var(--rvz-card-border)] bg-black/30 p-2.5 text-xs text-[var(--rvz-ink-muted)]">
              {summary}
            </p>
          )}
          <CommentsBucket title="Top objeciones" items={insights.top_objections} accent="red" />
          <CommentsBucket title="Top dudas" items={insights.top_questions} accent="blue" />
          <CommentsBucket title="Elogios" items={insights.praise} accent="emerald" />
        </div>
      ) : (
        <p className="text-xs text-[var(--rvz-ink-muted)]">
          Aprieta "Sincronizar ahora" para traer los comentarios del post + análisis de sentimiento +
          objeciones recurrentes (kie.ai · Gemini 3 Pro).
        </p>
      )}
    </Section>
  );
}

function SentimentBars({
  sentiment,
  total,
}: {
  sentiment: { positive: number; negative: number; question: number; neutral: number };
  total: number;
}) {
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-[var(--rvz-ink-muted)]">
        <span>Sentimiento</span>
        <span>{total} comentarios</span>
      </div>
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-black/40">
        <div className="bg-emerald-500" style={{ width: `${pct(sentiment.positive)}%` }} />
        <div className="bg-blue-500" style={{ width: `${pct(sentiment.question)}%` }} />
        <div className="bg-gray-500" style={{ width: `${pct(sentiment.neutral)}%` }} />
        <div className="bg-red-500" style={{ width: `${pct(sentiment.negative)}%` }} />
      </div>
      <div className="flex flex-wrap gap-3 text-[11px]">
        <SentimentDot color="emerald" label={`Positivos ${sentiment.positive}`} />
        <SentimentDot color="blue" label={`Preguntas ${sentiment.question}`} />
        <SentimentDot color="gray" label={`Neutros ${sentiment.neutral}`} />
        <SentimentDot color="red" label={`Negativos ${sentiment.negative}`} />
      </div>
    </div>
  );
}

function SentimentDot({ color, label }: { color: string; label: string }) {
  const map: Record<string, string> = {
    emerald: 'bg-emerald-500',
    blue: 'bg-blue-500',
    gray: 'bg-gray-500',
    red: 'bg-red-500',
  };
  return (
    <span className="inline-flex items-center gap-1 text-[var(--rvz-ink-muted)]">
      <span className={`h-2 w-2 rounded-full ${map[color]}`} />
      {label}
    </span>
  );
}

function CommentsBucket({
  title,
  items,
  accent,
}: {
  title: string;
  items?: string[];
  accent: 'red' | 'blue' | 'emerald';
}) {
  if (!items || items.length === 0) return null;
  const map: Record<string, string> = {
    red: 'border-red-500/30 bg-red-500/5',
    blue: 'border-blue-500/30 bg-blue-500/5',
    emerald: 'border-emerald-500/30 bg-emerald-500/5',
  };
  return (
    <div className={`rounded border p-2 ${map[accent]}`}>
      <p className="text-[10px] uppercase tracking-wide text-[var(--rvz-ink-muted)]">{title}</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-[var(--rvz-ink)]">
        {items.slice(0, 5).map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </div>
  );
}
