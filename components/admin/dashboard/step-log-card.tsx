'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

export type StepImageLog = { url: string; sha256?: string; bytes?: number };
export type StepLogEntry = {
  step: number;
  status: 'ok' | 'error';
  startedAt: string;
  completedAt: string;
  model: string;
  promptSent: string;
  imagesSent: StepImageLog[];
  outputPreview?: string;
  errorMessage?: string;
};

export const STEP_NAMES: Record<number, string> = {
  1: 'Análisis de plantilla',
  2: 'Adaptación al producto',
  3: 'Generación de prompt',
  4: 'Nano Banana — generación',
};

export function formatBytes(n?: number) {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export function formatDuration(startISO: string, endISO: string) {
  const ms = new Date(endISO).getTime() - new Date(startISO).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '';
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

export function ImageThumb({ img }: { img: StepImageLog }) {
  return (
    <a
      href={img.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex w-32 flex-col gap-1 rounded-lg border border-gray-800 bg-[#0a0a0a] p-2 transition hover:border-brand-accent"
      title={img.url}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={img.url}
        alt=""
        className="h-24 w-full rounded object-cover"
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = 'none';
        }}
      />
      <div className="text-[10px] text-gray-400">
        {img.sha256 ? (
          <>
            <div className="font-mono">{img.sha256.slice(0, 12)}…</div>
            <div>{formatBytes(img.bytes)}</div>
          </>
        ) : (
          <div className="italic">URL directa</div>
        )}
      </div>
    </a>
  );
}

export function StepLogCard({ entry, header }: { entry: StepLogEntry; header?: React.ReactNode }) {
  const [showPrompt, setShowPrompt] = useState(false);
  const [showOutput, setShowOutput] = useState(false);
  const okBadge = entry.status === 'ok'
    ? 'bg-green-500/10 text-green-400'
    : 'bg-red-500/10 text-red-400';

  return (
    <div className="rounded-xl border border-gray-800 bg-[#0f0f0f] p-4">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <span className="rounded bg-brand-accent/10 px-2 py-1 text-xs font-semibold text-brand-accent">
          Paso {entry.step}
        </span>
        <span className="text-sm font-medium text-white">
          {STEP_NAMES[entry.step] || `Paso ${entry.step}`}
        </span>
        <span className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${okBadge}`}>
          {entry.status}
        </span>
        <span className="text-xs text-gray-400">
          {entry.model} · {formatDuration(entry.startedAt, entry.completedAt)}
        </span>
        <span className="ml-auto text-[10px] text-gray-500">
          {new Date(entry.startedAt).toLocaleString('es-ES')}
        </span>
      </div>

      {header && <div className="mb-3 text-xs text-gray-400">{header}</div>}

      <div className="mb-3">
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          Imágenes enviadas a kie.ai ({entry.imagesSent.length})
        </div>
        {entry.imagesSent.length === 0 ? (
          <div className="text-xs text-gray-500 italic">Ninguna imagen</div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {entry.imagesSent.map((img, i) => (
              <ImageThumb key={i} img={img} />
            ))}
          </div>
        )}
      </div>

      <div className="mb-2">
        <button
          type="button"
          onClick={() => setShowPrompt((v) => !v)}
          className="flex items-center gap-1 text-xs font-semibold text-gray-300 hover:text-white"
        >
          {showPrompt ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          Prompt enviado ({entry.promptSent.length} chars)
        </button>
        {showPrompt && (
          <pre className="mt-2 max-h-96 overflow-auto rounded-lg bg-black p-3 text-[11px] text-gray-300 whitespace-pre-wrap break-words">
            {entry.promptSent}
          </pre>
        )}
      </div>

      {entry.outputPreview && (
        <div className="mb-2">
          <button
            type="button"
            onClick={() => setShowOutput((v) => !v)}
            className="flex items-center gap-1 text-xs font-semibold text-gray-300 hover:text-white"
          >
            {showOutput ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            Respuesta ({entry.outputPreview.length} chars)
          </button>
          {showOutput && (
            <pre className="mt-2 max-h-96 overflow-auto rounded-lg bg-black p-3 text-[11px] text-gray-300 whitespace-pre-wrap break-words">
              {entry.outputPreview}
            </pre>
          )}
        </div>
      )}

      {entry.errorMessage && (
        <div className="mt-2 rounded-lg border border-red-500/30 bg-red-500/5 p-2 text-xs text-red-300">
          <span className="font-semibold">Error: </span>
          {entry.errorMessage}
        </div>
      )}
    </div>
  );
}
