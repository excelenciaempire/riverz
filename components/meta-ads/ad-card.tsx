'use client';

import { useState } from 'react';
import {
  Play,
  Image as ImageIcon,
  Layers,
  Trophy,
  FileText,
  Eye,
  Download,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import type { MetaAdSummary } from '@/types/meta';
import { cn } from '@/lib/utils';

interface Props {
  ad: MetaAdSummary;
  onClick: () => void;
  selected?: boolean;
}

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  PAUSED: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
  DELETED: 'bg-red-500/20 text-red-300 border-red-500/30',
  ARCHIVED: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
};

function fmtCurrency(n?: string | number): string {
  if (n == null || n === '') return '$—';
  const num = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(num)) return '$—';
  return `$${num.toFixed(num >= 100 ? 0 : 2)}`;
}

async function downloadAsset(url: string, filename: string) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  } catch (err: any) {
    toast.error(`Descarga falló: ${err?.message || err}`);
  }
}

export function AdCard({ ad, onClick, selected }: Props) {
  const status = ad.effective_status || ad.status || '';
  const statusClass = STATUS_COLOR[status] || 'bg-gray-700/30 text-gray-300 border-gray-700';
  const insights = ad.insights;
  const intel = ad.intel;

  const isVideo = ad.media_kind === 'video';
  // Cards: prefer the highest-resolution source available so they don't
  // pixelate. For images, image_url is the original upload; thumbnail_url
  // is a tiny preview. For videos, the bigger of {creative.thumbnail_url,
  // /{video_id}/thumbnails biggest frame} is already in ad.thumbnail_url.
  const previewSrc = isVideo
    ? ad.thumbnail_url || ad.image_url || null
    : ad.image_url || ad.thumbnail_url || null;
  const playableVideoSrc = isVideo
    ? (ad.video_source_url || ad.intel?.asset_url || null)
    : null;
  const downloadUrl = isVideo ? playableVideoSrc : ad.image_url || ad.thumbnail_url;
  const downloadFilename = `${(ad.name || ad.id).replace(/[^a-z0-9-_]+/gi, '_')}.${
    isVideo ? 'mp4' : 'jpg'
  }`;

  const [showVideo, setShowVideo] = useState(false);
  const Icon = isVideo ? Play : ad.media_kind === 'carousel' ? Layers : ImageIcon;

  return (
    <div
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-xl border bg-[#141414] transition',
        selected
          ? 'border-brand-accent ring-2 ring-brand-accent/40'
          : 'border-gray-800 hover:border-brand-accent',
      )}
    >
      <div className="relative aspect-square w-full bg-black">
        {isVideo && showVideo && playableVideoSrc ? (
          <video
            src={playableVideoSrc}
            poster={ad.thumbnail_url || undefined}
            controls
            autoPlay
            playsInline
            className="h-full w-full object-cover"
            onClick={(e) => e.stopPropagation()}
          />
        ) : previewSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewSrc} alt={ad.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-gray-600">
            <Icon className="h-10 w-10" />
          </div>
        )}

        <div className="pointer-events-none absolute left-2 top-2 flex items-center gap-1 rounded-md bg-black/70 px-2 py-1 text-[10px] uppercase tracking-wide text-white">
          <Icon className="h-3 w-3" />
          {ad.media_kind}
        </div>

        {intel?.is_winner && (
          <div className="pointer-events-none absolute right-2 top-2 flex items-center gap-1 rounded-md bg-amber-500/90 px-2 py-1 text-[10px] font-semibold text-black">
            <Trophy className="h-3 w-3" />
            WINNER
          </div>
        )}

        {intel?.transcript && (
          <div
            className="pointer-events-none absolute right-2 bottom-2 rounded-md bg-emerald-500/80 p-1 text-black"
            title="Analizado con IA"
          >
            <FileText className="h-3 w-3" />
          </div>
        )}

        {/* Hover toolbar: download (always when we have a URL) + play / open
             original on Facebook when video source isn't available. */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/0 transition group-hover:bg-black/40">
          {!showVideo && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (isVideo) {
                    if (playableVideoSrc) {
                      setShowVideo(true);
                    } else if (ad.video_permalink_url) {
                      window.open(ad.video_permalink_url, '_blank', 'noopener,noreferrer');
                    } else {
                      onClick();
                    }
                  } else {
                    onClick();
                  }
                }}
                className="pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full bg-white/95 text-black opacity-0 shadow-lg transition group-hover:opacity-100 hover:bg-white"
                aria-label={isVideo ? 'Reproducir video' : 'Abrir detalle'}
                title={
                  isVideo
                    ? playableVideoSrc
                      ? 'Reproducir'
                      : ad.video_permalink_url
                        ? 'Ver en Facebook'
                        : 'Detalle'
                    : 'Detalle'
                }
              >
                {isVideo && !playableVideoSrc && ad.video_permalink_url ? (
                  <ExternalLink className="h-5 w-5" />
                ) : isVideo ? (
                  <Play className="h-6 w-6 fill-current" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
              {downloadUrl && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    downloadAsset(downloadUrl, downloadFilename);
                  }}
                  className="pointer-events-auto inline-flex items-center gap-1.5 rounded-md bg-black/80 px-2.5 py-1 text-[11px] font-medium text-white opacity-0 transition group-hover:opacity-100 hover:bg-black"
                  title="Descargar"
                >
                  <Download className="h-3 w-3" />
                  Descargar
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <button type="button" onClick={onClick} className="flex-1 cursor-pointer p-3 text-left">
        <p className="truncate text-sm font-medium text-white">{ad.name || ad.id}</p>
        <p className="truncate text-[11px] text-gray-500">{ad.adset_name || ad.adset_id}</p>
        <span className={cn('mt-1.5 inline-block rounded border px-1.5 py-0.5 text-[10px] font-medium', statusClass)}>
          {status || '—'}
        </span>
        <div className="mt-2.5 grid grid-cols-3 gap-1.5 text-[11px]">
          <Metric label="Spend" value={fmtCurrency(insights?.spend)} />
          <Metric label="CTR" value={insights?.ctr ? `${Number(insights.ctr).toFixed(2)}%` : '—'} />
          <Metric label="ROAS" value={insights?.roas ? `${insights.roas.toFixed(2)}x` : '—'} />
        </div>
      </button>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-black/40 px-1.5 py-1">
      <div className="text-[9px] uppercase text-gray-500">{label}</div>
      <div className="text-[11px] font-medium text-white">{value}</div>
    </div>
  );
}
