'use client';

import { useState } from 'react';
import { Play, Image as ImageIcon, Layers, Trophy, FileText, Eye } from 'lucide-react';
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

export function AdCard({ ad, onClick, selected }: Props) {
  const status = ad.effective_status || ad.status || '';
  const statusClass = STATUS_COLOR[status] || 'bg-gray-700/30 text-gray-300 border-gray-700';
  const insights = ad.insights;
  const intel = ad.intel;

  const isVideo = ad.media_kind === 'video';
  const playableSrc = isVideo
    ? (ad.video_source_url || ad.intel?.asset_url || null)
    : (ad.image_url || ad.thumbnail_url || ad.intel?.asset_url || null);

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
        {/* Media: video player when expanded, otherwise thumbnail with Play overlay */}
        {isVideo && showVideo && playableSrc ? (
          <video
            src={playableSrc}
            poster={ad.thumbnail_url || undefined}
            controls
            autoPlay
            playsInline
            className="h-full w-full object-cover"
            onClick={(e) => e.stopPropagation()}
          />
        ) : ad.thumbnail_url || ad.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={ad.thumbnail_url || ad.image_url || ''}
            alt={ad.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-gray-600">
            <Icon className="h-10 w-10" />
          </div>
        )}

        {/* Type badge */}
        <div className="pointer-events-none absolute left-2 top-2 flex items-center gap-1 rounded-md bg-black/70 px-2 py-1 text-[10px] uppercase tracking-wide text-white">
          <Icon className="h-3 w-3" />
          {ad.media_kind}
        </div>

        {/* Winner badge */}
        {intel?.is_winner && (
          <div className="pointer-events-none absolute right-2 top-2 flex items-center gap-1 rounded-md bg-amber-500/90 px-2 py-1 text-[10px] font-semibold text-black">
            <Trophy className="h-3 w-3" />
            WINNER
          </div>
        )}

        {/* Transcript indicator */}
        {intel?.transcript && (
          <div
            className="pointer-events-none absolute right-2 bottom-2 rounded-md bg-emerald-500/80 p-1 text-black"
            title="Analizado con IA"
          >
            <FileText className="h-3 w-3" />
          </div>
        )}

        {/* Play / Detail overlay (only when not playing video) */}
        {!(isVideo && showVideo) && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (isVideo && playableSrc) setShowVideo(true);
              else onClick();
            }}
            className="absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/30"
            aria-label={isVideo ? 'Reproducir video' : 'Abrir detalle'}
          >
            <span
              className={cn(
                'flex h-14 w-14 items-center justify-center rounded-full bg-white/90 text-black opacity-0 shadow-lg transition group-hover:opacity-100',
                !isVideo && 'h-12 w-12',
              )}
            >
              {isVideo ? <Play className="h-6 w-6 fill-current" /> : <Eye className="h-5 w-5" />}
            </span>
          </button>
        )}
      </div>

      {/* Body */}
      <button
        type="button"
        onClick={onClick}
        className="flex-1 cursor-pointer p-3 text-left"
      >
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
