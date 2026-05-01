'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useUser } from '@clerk/nextjs';
import { isAdminEmail } from '@/lib/admin-emails';
import { Plus, Trash2, Copy, ArrowLeft, FileText } from 'lucide-react';

interface WorkflowSummary {
  id: string;
  name: string;
  description: string | null;
  definition: { steps?: unknown[] };
  created_at: string;
  updated_at: string;
}

export default function WorkflowsListPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (isLoaded) {
      if (!user) {
        router.push('/admin');
      } else {
        const email = user.emailAddresses[0]?.emailAddress || '';
        if (!isAdminEmail(email)) router.push('/admin/unauthorized');
      }
    }
  }, [user, isLoaded, router]);

  useEffect(() => {
    if (!user) return;
    fetch('/api/admin/workflows')
      .then((r) => r.json())
      .then((data) => {
        setWorkflows(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [user]);

  async function createWorkflow() {
    setCreating(true);
    const r = await fetch('/api/admin/workflows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Workflow sin nombre' }),
    });
    setCreating(false);
    if (!r.ok) return alert('Error creando workflow');
    const data = await r.json();
    router.push(`/admin/workflows/${data.id}`);
  }

  async function duplicateWorkflow(w: WorkflowSummary) {
    const r = await fetch('/api/admin/workflows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `${w.name} (copia)`,
        description: w.description,
        definition: w.definition,
      }),
    });
    if (!r.ok) return alert('Error duplicando');
    const data = await r.json();
    setWorkflows((cur) => [data, ...cur]);
  }

  async function deleteWorkflow(id: string) {
    if (!confirm('¿Eliminar este workflow?')) return;
    const r = await fetch(`/api/admin/workflows/${id}`, { method: 'DELETE' });
    if (!r.ok) return alert('Error eliminando');
    setWorkflows((cur) => cur.filter((w) => w.id !== id));
  }

  if (!isLoaded || !user) return null;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="border-b border-gray-900 bg-black px-8 py-6">
        <div className="mx-auto max-w-[1800px] flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/admin/dashboard"
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-white"
            >
              <ArrowLeft size={16} /> Dashboard
            </Link>
            <div className="h-6 w-px bg-gray-700" />
            <h1 className="text-2xl font-bold">Workflows</h1>
          </div>
          <button
            onClick={createWorkflow}
            disabled={creating}
            className="flex items-center gap-2 rounded-lg bg-brand-accent px-4 py-2 text-sm font-medium text-black hover:opacity-90 disabled:opacity-50"
          >
            <Plus size={16} /> Nuevo workflow
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-[1800px] px-8 py-8">
        <p className="mb-6 max-w-2xl text-sm text-gray-400">
          Constructor visual para diseñar workflows multipaso. Cada workflow es un documento
          estructurado que puedes copiar y pasarle a Claude para que lo entienda y ejecute.
        </p>

        {loading ? (
          <p className="text-gray-500">Cargando…</p>
        ) : workflows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-800 p-12 text-center">
            <FileText className="mx-auto mb-4 text-gray-600" size={48} />
            <p className="mb-4 text-gray-400">No hay workflows todavía.</p>
            <button
              onClick={createWorkflow}
              className="rounded-lg bg-brand-accent px-4 py-2 text-sm font-medium text-black hover:opacity-90"
            >
              Crear el primero
            </button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-800">
            <table className="w-full">
              <thead className="bg-[#141414] text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">Nombre</th>
                  <th className="px-4 py-3 text-left">Descripción</th>
                  <th className="px-4 py-3 text-left">Pasos</th>
                  <th className="px-4 py-3 text-left">Última edición</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-900">
                {workflows.map((w) => (
                  <tr key={w.id} className="hover:bg-[#141414]">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/workflows/${w.id}`}
                        className="font-medium text-white hover:text-brand-accent"
                      >
                        {w.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">
                      {w.description || <span className="text-gray-700">—</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">
                      {w.definition?.steps?.length ?? 0}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {new Date(w.updated_at).toLocaleString('es-ES')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => duplicateWorkflow(w)}
                          title="Duplicar"
                          className="rounded p-1.5 text-gray-400 hover:bg-gray-800 hover:text-white"
                        >
                          <Copy size={14} />
                        </button>
                        <button
                          onClick={() => deleteWorkflow(w.id)}
                          title="Eliminar"
                          className="rounded p-1.5 text-gray-400 hover:bg-red-900/40 hover:text-red-400"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
