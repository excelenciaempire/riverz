'use client';

import { Fragment, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, ChevronLeft, ExternalLink, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { StepLogCard, type StepLogEntry, STEP_NAMES } from './step-log-card';

const PAGE_SIZE = 50;

type GenerationRow = {
  id: string;
  type: string;
  status: string;
  cost: number | null;
  result_url: string | null;
  created_at: string;
  clerk_user_id: string | null;
  error_message: string | null;
  input_data: any;
  users?: { email: string | null };
};

type GenerationsResponse = {
  generations: GenerationRow[];
  pagination: { total: number; page: number; limit: number; totalPages: number };
};

const TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'Todos los tipos' },
  { value: 'static_ad_generation', label: 'Static Ad · Generación' },
  { value: 'static_ad_edit', label: 'Static Ad · Edición' },
  { value: 'static_ads_ideacion', label: 'Static Ad · Ideación' },
  { value: 'ugc', label: 'UGC' },
  { value: 'ugc_video', label: 'UGC Video' },
  { value: 'ugc_chat', label: 'UGC Chat' },
  { value: 'face_swap', label: 'Face Swap' },
  { value: 'clips', label: 'Clips' },
  { value: 'editar_foto_crear', label: 'Editar Foto · Crear' },
  { value: 'editar_foto_editar', label: 'Editar Foto · Editar' },
  { value: 'editar_foto_combinar', label: 'Editar Foto · Combinar' },
  { value: 'editar_foto_clonar', label: 'Editar Foto · Clonar' },
  { value: 'editar_foto_draw_edit', label: 'Editar Foto · Draw & Edit' },
  { value: 'mejorar_calidad_video', label: 'Mejorar Calidad Video' },
  { value: 'mejorar_calidad_imagen', label: 'Mejorar Calidad Imagen' },
];

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'Todos los estados' },
  { value: 'pending_analysis', label: 'Pendiente análisis' },
  { value: 'analyzing', label: 'Analizando' },
  { value: 'adapting', label: 'Adaptando' },
  { value: 'pending_generation', label: 'Pendiente generación' },
  { value: 'generating', label: 'Generando' },
  { value: 'completed', label: 'Completado' },
  { value: 'failed', label: 'Fallido' },
];

const STEP_FILTER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'Todos los pasos' },
  { value: 'step-failed:1', label: 'Falló en Paso 1 (análisis)' },
  { value: 'step-failed:2', label: 'Falló en Paso 2 (adaptación)' },
  { value: 'step-failed:3', label: 'Falló en Paso 3 (prompt)' },
  { value: 'step-failed:4', label: 'Falló en Paso 4 (Nano Banana)' },
  { value: 'has-errors', label: 'Cualquier paso con error' },
  { value: 'reached:1', label: 'Llegó a Paso 1+' },
  { value: 'reached:2', label: 'Llegó a Paso 2+' },
  { value: 'reached:3', label: 'Llegó a Paso 3+' },
  { value: 'reached:4', label: 'Llegó a Paso 4+' },
];

const TOTAL_STEPS = 4;

function statusColor(status: string) {
  switch (status) {
    case 'completed':
      return 'text-green-500 bg-green-500/10';
    case 'processing':
    case 'analyzing':
    case 'adapting':
    case 'generating':
      return 'text-yellow-500 bg-yellow-500/10';
    case 'failed':
      return 'text-red-500 bg-red-500/10';
    default:
      return 'text-gray-500 bg-gray-500/10';
  }
}

function StepProgress({ stepLogs, status }: { stepLogs: StepLogEntry[]; status: string }) {
  // Per-step state: green if any 'ok' entry exists, red if any 'error', dim otherwise.
  const perStep = new Map<number, 'ok' | 'error' | 'pending'>();
  for (const e of stepLogs) {
    const cur = perStep.get(e.step);
    if (e.status === 'error') perStep.set(e.step, 'error');
    else if (e.status === 'ok' && cur !== 'error') perStep.set(e.step, 'ok');
  }

  return (
    <div className="flex gap-1">
      {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((n) => {
        const state = perStep.get(n);
        const cls =
          state === 'ok'
            ? 'bg-green-500/20 text-green-400 border-green-500/40'
            : state === 'error'
            ? 'bg-red-500/20 text-red-400 border-red-500/40'
            : status === 'completed'
            ? 'bg-green-500/10 text-green-500/60 border-green-500/20'
            : 'bg-gray-800 text-gray-600 border-gray-700';
        return (
          <span
            key={n}
            title={`Paso ${n}: ${STEP_NAMES[n] || ''} — ${state || 'sin entrada'}`}
            className={`inline-flex h-6 w-6 items-center justify-center rounded border text-[10px] font-bold ${cls}`}
          >
            {n}
          </span>
        );
      })}
    </div>
  );
}

function GenerationDetailPanel({ row }: { row: GenerationRow }) {
  const inputData = row.input_data || {};
  const stepLogs: StepLogEntry[] = Array.isArray(inputData.stepLogs) ? inputData.stepLogs : [];
  const sortedSteps = [...stepLogs].sort(
    (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
  );
  const templateThumb: string | undefined = inputData.templateThumbnail;
  const productImages: string[] = Array.isArray(inputData.productImages) ? inputData.productImages : [];

  return (
    <div className="space-y-6 px-6 py-6">
      {row.error_message && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-300">
          <span className="font-semibold">Mensaje de error: </span>
          {row.error_message}
        </div>
      )}

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
                <img src={templateThumb} alt="" className="h-32 rounded-lg border border-gray-800 object-cover" />
              </a>
            ) : (
              <div className="text-xs text-gray-500 italic">Sin plantilla</div>
            )}
            <div className="mt-1 text-[10px] text-gray-500">
              {inputData.templateName} · {inputData.templateAspectRatio || '—'}
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
                  <img src={url} alt="" className="h-20 w-20 rounded-lg border border-gray-800 object-cover" />
                </a>
              ))}
            </div>
            <div className="mt-1 text-[10px] text-gray-500">{inputData.productName}</div>
          </div>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Trazabilidad de pasos ({sortedSteps.length})
          </div>
          <div className="text-[10px] text-gray-500 font-mono">
            ID: {row.id}
          </div>
        </div>
        {sortedSteps.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-800 p-4 text-xs text-gray-500">
            Esta generación no tiene logs de pasos. Es probable que se haya generado antes de que se
            activara la auditoría por paso, o que aún no haya iniciado.
          </div>
        ) : (
          <div className="space-y-3">
            {sortedSteps.map((entry, i) => (
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
  const [stepFilter, setStepFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<GenerationsResponse>({
    queryKey: ['admin-generations', typeFilter, statusFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
      });
      if (typeFilter !== 'all') params.set('type', typeFilter);
      if (statusFilter !== 'all') params.set('status', statusFilter);

      const res = await fetch(`/api/admin/generations?${params.toString()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to fetch generations');
      return res.json();
    },
    refetchInterval: 5000,
  });

  const generations = data?.generations || [];
  const pagination = data?.pagination;

  // Client-side filtering for search + step filter (these are too granular to
  // push to the API without schema changes; the dataset per-page is small).
  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return generations.filter((g) => {
      const stepLogs: StepLogEntry[] = Array.isArray(g.input_data?.stepLogs) ? g.input_data.stepLogs : [];

      if (stepFilter !== 'all') {
        if (stepFilter === 'has-errors') {
          if (!stepLogs.some((s) => s.status === 'error')) return false;
        } else if (stepFilter.startsWith('step-failed:')) {
          const target = parseInt(stepFilter.split(':')[1], 10);
          if (!stepLogs.some((s) => s.step === target && s.status === 'error')) return false;
        } else if (stepFilter.startsWith('reached:')) {
          const target = parseInt(stepFilter.split(':')[1], 10);
          if (!stepLogs.some((s) => s.step >= target)) return false;
        }
      }

      if (term) {
        const haystack = [
          g.users?.email || '',
          g.clerk_user_id || '',
          g.id,
          g.error_message || '',
          g.input_data?.productName || '',
          g.input_data?.templateName || '',
          ...stepLogs.map((s) => s.model || ''),
          ...stepLogs.map((s) => s.errorMessage || ''),
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(term)) return false;
      }

      return true;
    });
  }, [generations, searchTerm, stepFilter]);

  // Aggregate stepLogs across the visible page for the summary cards.
  const summary = useMemo(() => {
    let totalSteps = 0;
    let okSteps = 0;
    let errSteps = 0;
    for (const g of filtered) {
      const logs: StepLogEntry[] = Array.isArray(g.input_data?.stepLogs) ? g.input_data.stepLogs : [];
      for (const e of logs) {
        totalSteps++;
        if (e.status === 'ok') okSteps++;
        else if (e.status === 'error') errSteps++;
      }
    }
    return {
      generations: filtered.length,
      totalSteps,
      okSteps,
      errSteps,
      failedGenerations: filtered.filter((g) => g.status === 'failed').length,
    };
  }, [filtered]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Generaciones &amp; Logs</h2>
        <p className="mt-2 text-gray-400">
          Cada fila es una generación con sus pasos auditados (prompts + imágenes enviadas a kie.ai).
          Refresco automático cada 5 s.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-gray-800 bg-[#141414] p-4">
          <p className="text-xs uppercase tracking-wide text-gray-500">Generaciones</p>
          <p className="mt-1 text-2xl font-bold text-white">{summary.generations}</p>
        </div>
        <div className="rounded-2xl border border-gray-800 bg-[#141414] p-4">
          <p className="text-xs uppercase tracking-wide text-gray-500">Pasos ejecutados</p>
          <p className="mt-1 text-2xl font-bold text-white">{summary.totalSteps}</p>
        </div>
        <div className="rounded-2xl border border-gray-800 bg-[#141414] p-4">
          <p className="text-xs uppercase tracking-wide text-gray-500">Pasos exitosos</p>
          <p className="mt-1 text-2xl font-bold text-green-500">{summary.okSteps}</p>
        </div>
        <div className="rounded-2xl border border-gray-800 bg-[#141414] p-4">
          <p className="text-xs uppercase tracking-wide text-gray-500">Pasos con error</p>
          <p className="mt-1 text-2xl font-bold text-red-500">{summary.errSteps}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[260px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            type="text"
            placeholder="Buscar por email, ID, producto, plantilla, modelo, error..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-800 bg-[#1a1a1a] px-4 py-2 text-white"
        >
          {TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-800 bg-[#1a1a1a] px-4 py-2 text-white"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select
          value={stepFilter}
          onChange={(e) => setStepFilter(e.target.value)}
          className="rounded-lg border border-gray-800 bg-[#1a1a1a] px-4 py-2 text-white"
        >
          {STEP_FILTER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        {pagination && (
          <p className="ml-auto self-center text-sm text-gray-400">
            Total filtrado: <span className="font-bold text-white">{pagination.total.toLocaleString()}</span>
          </p>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-gray-800 bg-[#141414]">
        <table className="w-full">
          <thead className="border-b border-gray-800 bg-[#0a0a0a]">
            <tr>
              <th className="w-10 px-2 py-4"></th>
              <th className="px-4 py-4 text-left text-sm font-semibold text-white">Usuario</th>
              <th className="px-4 py-4 text-left text-sm font-semibold text-white">Tipo</th>
              <th className="px-4 py-4 text-left text-sm font-semibold text-white">Estado</th>
              <th className="px-4 py-4 text-left text-sm font-semibold text-white">Pasos</th>
              <th className="px-4 py-4 text-left text-sm font-semibold text-white">Costo</th>
              <th className="px-4 py-4 text-left text-sm font-semibold text-white">Resultado</th>
              <th className="px-4 py-4 text-left text-sm font-semibold text-white">Fecha</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {isLoading ? (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-gray-400">Cargando generaciones...</td>
              </tr>
            ) : filtered.length > 0 ? (
              filtered.map((gen) => {
                const isExpanded = expandedId === gen.id;
                const stepLogs: StepLogEntry[] = Array.isArray(gen.input_data?.stepLogs) ? gen.input_data.stepLogs : [];
                const hasDetail = stepLogs.length > 0 || gen.input_data?.templateThumbnail || gen.error_message;
                const hasError = gen.status === 'failed' || stepLogs.some((s) => s.status === 'error');
                return (
                  <Fragment key={gen.id}>
                    <tr
                      className={`transition ${hasDetail ? 'cursor-pointer hover:bg-[#0a0a0a]' : ''} ${hasError ? 'bg-red-500/5' : ''}`}
                      onClick={() => hasDetail && setExpandedId(isExpanded ? null : gen.id)}
                    >
                      <td className="px-2 py-4 text-gray-400">
                        {hasDetail ? (
                          isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
                        ) : null}
                      </td>
                      <td className="px-4 py-4 text-sm text-white">
                        <div>{gen.users?.email || gen.clerk_user_id || 'N/A'}</div>
                        {gen.input_data?.productName && (
                          <div className="text-[10px] text-gray-500">{gen.input_data.productName}</div>
                        )}
                      </td>
                      <td className="px-4 py-4 text-xs text-gray-300">{gen.type}</td>
                      <td className="px-4 py-4">
                        <span className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${statusColor(gen.status)}`}>
                          {gen.status}
                        </span>
                        {gen.error_message && (
                          <div className="mt-1 max-w-[200px] truncate text-[10px] text-red-400" title={gen.error_message}>
                            {gen.error_message}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <StepProgress stepLogs={stepLogs} status={gen.status} />
                      </td>
                      <td className="px-4 py-4 text-sm font-semibold text-brand-accent">
                        {gen.cost || 0}
                      </td>
                      <td className="px-4 py-4">
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
                      <td className="px-4 py-4 text-xs text-gray-400">
                        {new Date(gen.created_at).toLocaleString('es-ES')}
                      </td>
                    </tr>
                    {isExpanded && hasDetail && (
                      <tr className="bg-[#0a0a0a]">
                        <td colSpan={8} className="border-t border-gray-800">
                          <GenerationDetailPanel row={gen} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            ) : (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-gray-400">
                  {generations.length === 0
                    ? 'No se encontraron generaciones'
                    : 'Ningún resultado coincide con los filtros actuales'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-400">
            Página {pagination.page} de {pagination.totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-lg border border-gray-800 bg-[#141414] px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= pagination.totalPages}
              className="rounded-lg border border-gray-800 bg-[#141414] px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
