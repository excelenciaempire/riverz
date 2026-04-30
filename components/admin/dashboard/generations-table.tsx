'use client';

import { Fragment, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';

type StepImageLog = { url: string; sha256?: string; bytes?: number };
type StepLogEntry = {
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

const STEP_NAMES: Record<number, string> = {
  1: 'Análisis de plantilla',
  2: 'Adaptación al producto',
  3: 'Generación de prompt',
  4: 'Nano Banana — generación',
};

function formatBytes(n?: number) {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function formatDuration(startISO: string, endISO: string) {
  const ms = new Date(endISO).getTime() - new Date(startISO).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '';
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

function ImageThumb({ img }: { img: StepImageLog }) {
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

function StepLogCard({ entry }: { entry: StepLogEntry }) {
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

function GenerationDetailPanel({ inputData }: { inputData: any }) {
  const stepLogs: StepLogEntry[] = Array.isArray(inputData?.stepLogs) ? inputData.stepLogs : [];
  const templateThumb: string | undefined = inputData?.templateThumbnail;
  const productImages: string[] = Array.isArray(inputData?.productImages) ? inputData.productImages : [];

  return (
    <div className="space-y-6 px-6 py-6">
      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
          Inputs originales
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <div className="mb-1 text-[11px] text-gray-500">Plantilla seleccionada</div>
            {templateThumb ? (
              <a href={templateThumb} target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={templateThumb}
                  alt=""
                  className="h-32 rounded-lg border border-gray-800 object-cover"
                />
              </a>
            ) : (
              <div className="text-xs text-gray-500 italic">Sin plantilla</div>
            )}
            <div className="mt-1 text-[10px] text-gray-500">
              {inputData?.templateName} · {inputData?.templateAspectRatio || '—'}
            </div>
          </div>
          <div>
            <div className="mb-1 text-[11px] text-gray-500">
              Imágenes del producto ({productImages.length})
            </div>
            <div className="flex flex-wrap gap-2">
              {productImages.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt=""
                    className="h-20 w-20 rounded-lg border border-gray-800 object-cover"
                  />
                </a>
              ))}
            </div>
            <div className="mt-1 text-[10px] text-gray-500">
              {inputData?.productName}
            </div>
          </div>
        </div>
      </div>

      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
          Trazabilidad de pasos ({stepLogs.length})
        </div>
        {stepLogs.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-800 p-4 text-xs text-gray-500">
            Esta generación no tiene logs de pasos. Es probable que se haya
            generado antes de que se activara la auditoría por paso.
          </div>
        ) : (
          <div className="space-y-3">
            {stepLogs.map((entry, i) => (
              <StepLogCard key={i} entry={entry} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function GenerationsTable() {
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const supabase = createClient();

  const { data: generations, isLoading } = useQuery({
    queryKey: ['admin-generations', typeFilter, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('generations')
        .select('*, users(email)')
        .order('created_at', { ascending: false })
        .limit(100);

      if (typeFilter !== 'all') query = query.eq('type', typeFilter);
      if (statusFilter !== 'all') query = query.eq('status', statusFilter);

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    refetchInterval: 10000,
  });

  const statusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-500 bg-green-500/10';
      case 'processing': return 'text-yellow-500 bg-yellow-500/10';
      case 'failed': return 'text-red-500 bg-red-500/10';
      default: return 'text-gray-500 bg-gray-500/10';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-4">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-lg border border-gray-800 bg-[#1a1a1a] px-4 py-2 text-white"
        >
          <option value="all">Todos los tipos</option>
          <option value="static_ad_generation">Static Ads (clonación)</option>
          <option value="ugc">UGC</option>
          <option value="face_swap">Face Swap</option>
          <option value="clips">Clips</option>
          <option value="editar_foto_crear">Editar Foto - Crear</option>
          <option value="editar_foto_editar">Editar Foto - Editar</option>
          <option value="editar_foto_combinar">Editar Foto - Combinar</option>
          <option value="editar_foto_clonar">Editar Foto - Clonar</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-gray-800 bg-[#1a1a1a] px-4 py-2 text-white"
        >
          <option value="all">Todos los estados</option>
          <option value="pending">Pendiente</option>
          <option value="processing">Procesando</option>
          <option value="completed">Completado</option>
          <option value="failed">Fallido</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-gray-800 bg-[#141414]">
        <table className="w-full">
          <thead className="border-b border-gray-800 bg-[#0a0a0a]">
            <tr>
              <th className="w-10 px-2 py-4"></th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-white">Usuario</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-white">Tipo</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-white">Estado</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-white">Costo</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-white">Resultado</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-white">Fecha</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                  Cargando generaciones...
                </td>
              </tr>
            ) : generations && generations.length > 0 ? (
              generations.map((gen: any) => {
                const isExpanded = expandedId === gen.id;
                const hasDetail = gen.input_data && (
                  Array.isArray(gen.input_data.stepLogs) ||
                  gen.input_data.templateThumbnail ||
                  Array.isArray(gen.input_data.productImages)
                );
                return (
                  <Fragment key={gen.id}>
                    <tr
                      className={`transition ${hasDetail ? 'cursor-pointer hover:bg-[#0a0a0a]' : ''}`}
                      onClick={() => hasDetail && setExpandedId(isExpanded ? null : gen.id)}
                    >
                      <td className="px-2 py-4 text-gray-400">
                        {hasDetail ? (
                          isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
                        ) : null}
                      </td>
                      <td className="px-6 py-4 text-sm text-white">{gen.users?.email || 'N/A'}</td>
                      <td className="px-6 py-4 text-sm text-white">{gen.type}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${statusColor(gen.status)}`}>
                          {gen.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-brand-accent">
                        {gen.cost || 0}
                      </td>
                      <td className="px-6 py-4">
                        {gen.result_url ? (
                          <a
                            href={gen.result_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-2 text-brand-accent hover:underline"
                          >
                            Ver <ExternalLink className="h-4 w-4" />
                          </a>
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-400">
                        {new Date(gen.created_at).toLocaleString('es-ES')}
                      </td>
                    </tr>
                    {isExpanded && hasDetail && (
                      <tr className="bg-[#0a0a0a]">
                        <td colSpan={7} className="border-t border-gray-800">
                          <GenerationDetailPanel inputData={gen.input_data} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            ) : (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                  No se encontraron generaciones
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
