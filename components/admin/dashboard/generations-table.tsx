'use client';

import { Fragment, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import { StepLogCard, type StepLogEntry } from './step-log-card';

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
