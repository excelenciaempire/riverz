'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { StepLogCard, type StepLogEntry } from './step-log-card';

type FlatLog = {
  entry: StepLogEntry;
  generationId: string;
  userEmail: string;
  productName?: string;
  templateName?: string;
};

export function LogsViewer() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [stepFilter, setStepFilter] = useState('all');
  const supabase = createClient();

  // Pull recent generations and flatten their stepLogs into a time-ordered
  // stream of kie.ai calls. This is the only place that records what
  // actually went on the wire, so it lives here instead of api_logs (which
  // never had any writers).
  const { data: rows, isLoading } = useQuery({
    queryKey: ['admin-step-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('generations')
        .select('id, type, input_data, created_at, users(email)')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;
      return data || [];
    },
    refetchInterval: 5000,
  });

  const flatLogs: FlatLog[] = useMemo(() => {
    if (!rows) return [];
    const out: FlatLog[] = [];
    for (const r of rows as any[]) {
      const stepLogs: StepLogEntry[] = Array.isArray(r.input_data?.stepLogs) ? r.input_data.stepLogs : [];
      for (const e of stepLogs) {
        out.push({
          entry: e,
          generationId: r.id,
          userEmail: r.users?.email || 'Sistema',
          productName: r.input_data?.productName,
          templateName: r.input_data?.templateName,
        });
      }
    }
    out.sort((a, b) => new Date(b.entry.startedAt).getTime() - new Date(a.entry.startedAt).getTime());
    return out;
  }, [rows]);

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return flatLogs.filter((l) => {
      if (statusFilter !== 'all' && l.entry.status !== statusFilter) return false;
      if (stepFilter !== 'all' && String(l.entry.step) !== stepFilter) return false;
      if (!term) return true;
      const haystack = [
        l.userEmail,
        l.generationId,
        l.productName,
        l.templateName,
        l.entry.model,
        l.entry.errorMessage,
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(term);
    });
  }, [flatLogs, searchTerm, statusFilter, stepFilter]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Logs del Sistema</h2>
        <p className="mt-2 text-gray-400">
          Stream en tiempo real de las llamadas a kie.ai (prompt + imágenes
          enviadas en cada paso). Refresco cada 5 s.
        </p>
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[260px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            type="text"
            placeholder="Buscar por email, producto, plantilla, modelo, ID o error..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <select
          value={stepFilter}
          onChange={(e) => setStepFilter(e.target.value)}
          className="rounded-lg border border-gray-800 bg-[#1a1a1a] px-4 py-2 text-white"
        >
          <option value="all">Todos los pasos</option>
          <option value="1">Paso 1 — Análisis plantilla</option>
          <option value="2">Paso 2 — Adaptación producto</option>
          <option value="4">Paso 4 — Nano Banana</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-gray-800 bg-[#1a1a1a] px-4 py-2 text-white"
        >
          <option value="all">Todos los estados</option>
          <option value="ok">Exitosos</option>
          <option value="error">Errores</option>
        </select>
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-gray-800 bg-[#141414] p-12 text-center text-gray-400">
          Cargando logs...
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-gray-800 bg-[#141414] p-12 text-center text-gray-400">
          {flatLogs.length === 0
            ? 'Aún no hay llamadas registradas. Inicia una generación de Static Ads y los logs aparecerán aquí.'
            : 'Ningún log coincide con los filtros actuales.'}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((l, i) => (
            <StepLogCard
              key={`${l.generationId}-${i}`}
              entry={l.entry}
              header={
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  <span>
                    Usuario: <span className="text-white">{l.userEmail}</span>
                  </span>
                  <span>
                    Generación: <span className="font-mono text-white">{l.generationId.slice(0, 8)}</span>
                  </span>
                  {l.productName && (
                    <span>
                      Producto: <span className="text-white">{l.productName}</span>
                    </span>
                  )}
                  {l.templateName && (
                    <span>
                      Plantilla: <span className="text-white">{l.templateName}</span>
                    </span>
                  )}
                </div>
              }
            />
          ))}
        </div>
      )}

      {flatLogs.length > 0 && (
        <div className="rounded-2xl border border-gray-800 bg-[#141414] p-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-sm text-gray-400">Llamadas registradas</p>
              <p className="mt-1 text-2xl font-bold text-white">{flatLogs.length}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Exitosas</p>
              <p className="mt-1 text-2xl font-bold text-green-500">
                {flatLogs.filter((l) => l.entry.status === 'ok').length}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Errores</p>
              <p className="mt-1 text-2xl font-bold text-red-500">
                {flatLogs.filter((l) => l.entry.status === 'error').length}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
