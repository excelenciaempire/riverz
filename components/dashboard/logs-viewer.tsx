'use client';

import { useState } from 'react';
import { useQuery } from '@tantml:invoke>
<parameter name="createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/input';
import { Search, AlertCircle, CheckCircle2, Clock } from 'lucide-react';

export function LogsViewer() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const supabase = createClient();

  const { data: logs, isLoading } = useQuery({
    queryKey: ['admin-logs', searchTerm, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('api_logs')
        .select('*, users(email)')
        .order('created_at', { ascending: false })
        .limit(200);

      if (searchTerm) {
        query = query.or(`endpoint.ilike.%${searchTerm}%,users.email.ilike.%${searchTerm}%`);
      }

      if (statusFilter === 'error') {
        query = query.gte('status_code', 400);
      } else if (statusFilter === 'success') {
        query = query.lt('status_code', 400);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  const getStatusIcon = (statusCode: number) => {
    if (statusCode >= 200 && statusCode < 300) {
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    } else if (statusCode >= 400) {
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    }
    return <Clock className="h-4 w-4 text-yellow-500" />;
  };

  const getStatusColor = (statusCode: number) => {
    if (statusCode >= 200 && statusCode < 300) return 'text-green-500 bg-green-500/10';
    if (statusCode >= 400) return 'text-red-500 bg-red-500/10';
    return 'text-yellow-500 bg-yellow-500/10';
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Logs del Sistema</h2>
        <p className="mt-2 text-gray-400">
          Monitoreo en tiempo real de todas las llamadas a APIs
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            type="text"
            placeholder="Buscar por endpoint o email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-gray-800 bg-[#1a1a1a] px-4 py-2 text-white"
        >
          <option value="all">Todos los estados</option>
          <option value="success">Exitosos</option>
          <option value="error">Errores</option>
        </select>
      </div>

      {/* Logs Table */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="rounded-2xl border border-gray-800 bg-[#141414] p-12 text-center text-gray-400">
            Cargando logs...
          </div>
        ) : logs && logs.length > 0 ? (
          logs.map((log: any) => (
            <div
              key={log.id}
              className="rounded-xl border border-gray-800 bg-[#141414] p-5 transition hover:bg-[#1a1a1a]"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4 flex-1">
                  <div className="mt-1">{getStatusIcon(log.status_code)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <span
                        className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${getStatusColor(
                          log.status_code
                        )}`}
                      >
                        {log.status_code}
                      </span>
                      <span className="font-mono text-sm font-medium text-white">
                        {log.method}
                      </span>
                      <span className="font-mono text-sm text-gray-400 truncate">
                        {log.endpoint}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-4 text-sm">
                      <span className="text-gray-400">
                        Usuario: <span className="text-white">{log.users?.email || 'Sistema'}</span>
                      </span>
                      <span className="text-gray-500">
                        {new Date(log.created_at).toLocaleString('es-ES')}
                      </span>
                    </div>
                    {log.error_message && (
                      <div className="mt-3 rounded-lg bg-red-500/10 p-3">
                        <p className="text-sm text-red-400">{log.error_message}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-gray-800 bg-[#141414] p-12 text-center text-gray-400">
            No se encontraron logs
          </div>
        )}
      </div>

      {/* Summary */}
      {logs && logs.length > 0 && (
        <div className="rounded-2xl border border-gray-800 bg-[#141414] p-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-sm text-gray-400">Total Logs Mostrados</p>
              <p className="mt-1 text-2xl font-bold text-white">{logs.length}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Exitosos</p>
              <p className="mt-1 text-2xl font-bold text-green-500">
                {logs.filter((l: any) => l.status_code < 400).length}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Errores</p>
              <p className="mt-1 text-2xl font-bold text-red-500">
                {logs.filter((l: any) => l.status_code >= 400).length}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

