'use client';

import { CheckCircle2, Loader2, XCircle, Clock, Image as ImageIcon, Video } from 'lucide-react';
import type { MetaUpload, MetaUploadStatus } from '@/types/meta';
import { cn } from '@/lib/utils';

interface Props {
  upload: Pick<MetaUpload, 'id' | 'status' | 'asset_type' | 'error_message' | 'meta_asset_hash' | 'meta_asset_id'>;
  thumbnailUrl?: string;
  label?: string;
}

const STATUS_LABEL: Record<MetaUploadStatus, string> = {
  pending: 'En cola',
  uploading: 'Subiendo',
  processing: 'Procesando en Meta',
  ready: 'Listo',
  failed: 'Error',
};

export function UploadStatusRow({ upload, thumbnailUrl, label }: Props) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-[var(--rvz-card-border)] bg-black/40 p-3">
      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-[var(--rvz-card)]">
        {thumbnailUrl ? (
          upload.asset_type === 'video' ? (
            <video src={thumbnailUrl} className="h-full w-full object-cover" muted />
          ) : (
            <img src={thumbnailUrl} alt="" className="h-full w-full object-cover" />
          )
        ) : upload.asset_type === 'video' ? (
          <Video className="absolute inset-0 m-auto h-5 w-5 text-[var(--rvz-ink-muted)]" />
        ) : (
          <ImageIcon className="absolute inset-0 m-auto h-5 w-5 text-[var(--rvz-ink-muted)]" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[var(--rvz-ink)]">{label || upload.id.slice(-8)}</p>
        <p
          className={cn('truncate text-xs', {
            'text-[var(--rvz-ink-muted)]': upload.status === 'pending' || upload.status === 'uploading' || upload.status === 'processing',
            'text-green-400': upload.status === 'ready',
            'text-red-400': upload.status === 'failed',
          })}
        >
          {STATUS_LABEL[upload.status]}
          {upload.status === 'failed' && upload.error_message ? ` — ${upload.error_message}` : ''}
          {upload.status === 'ready' && upload.meta_asset_hash ? ` · hash ${upload.meta_asset_hash.slice(0, 10)}…` : ''}
          {upload.status === 'ready' && !upload.meta_asset_hash && upload.meta_asset_id ? ` · id ${upload.meta_asset_id}` : ''}
        </p>
      </div>
      <div className="shrink-0">
        {upload.status === 'ready' && <CheckCircle2 className="h-5 w-5 text-green-400" />}
        {upload.status === 'failed' && <XCircle className="h-5 w-5 text-red-400" />}
        {(upload.status === 'uploading' || upload.status === 'processing') && (
          <Loader2 className="h-5 w-5 animate-spin text-[var(--rvz-ink)]" />
        )}
        {upload.status === 'pending' && <Clock className="h-5 w-5 text-[var(--rvz-ink-muted)]" />}
      </div>
    </div>
  );
}
