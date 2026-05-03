'use client';

/**
 * API Keys (Beta) — UI sobre /api/api-keys.
 *
 * Comportamientos clave:
 *   - Al crear una key, mostramos el plaintext UNA SOLA VEZ con botón
 *     "Copiar" — luego sólo se ve el prefix.
 *   - Revocación es DELETE (soft); la fila desaparece de la lista activa.
 */

import { useEffect, useState } from 'react';
import { Key, Plus, Copy, Check, Loader2, Trash2 } from 'lucide-react';
import { SideNav } from '../_side-nav';

interface ApiKeyRow {
  id: string;
  name: string;
  key_prefix: string;
  last_used_at: string | null;
  created_at: string;
  revoked_at: string | null;
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [newToken, setNewToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function load() {
    setLoading(true);
    const r = await fetch('/api/api-keys');
    const j = await r.json();
    setKeys((j.keys ?? []).filter((k: ApiKeyRow) => !k.revoked_at));
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      const r = await fetch('/api/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'create failed');
      setNewToken(j.token);
      setName('');
      load();
    } catch (e: any) {
      alert(e?.message ?? 'error');
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(id: string) {
    if (!confirm('Revocar esta key? Las integraciones que la usen dejarán de funcionar.')) return;
    await fetch(`/api/api-keys/${id}`, { method: 'DELETE' });
    load();
  }

  async function copyToken() {
    if (!newToken) return;
    await navigator.clipboard.writeText(newToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex min-h-screen bg-[#0a0a0a] text-white">
      <SideNav active="api-keys" />
      <main className="ml-56 flex-1 p-8">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="flex items-center gap-2 text-3xl font-bold">
                API Keys
                <span className="rounded-full bg-purple-500/15 px-2 py-0.5 text-xs font-semibold text-purple-300">
                  Beta
                </span>
              </h1>
              <p className="mt-1 text-sm text-gray-400">
                Genera tokens para llenar y duplicar páginas programáticamente desde tus automatizaciones.
              </p>
            </div>
          </div>

          {/* Create form */}
          <form onSubmit={handleCreate} className="mt-8 flex items-center gap-2 rounded-lg border border-gray-800 bg-[#0d0d0d] p-3">
            <Key className="h-4 w-4 text-[#07A498]" />
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre de la key (e.g. n8n-prod, zapier)"
              className="flex-1 bg-transparent text-sm placeholder:text-gray-600 focus:outline-none"
            />
            <button
              type="submit"
              disabled={creating || !name.trim()}
              className="flex items-center gap-1.5 rounded-md bg-[#07A498] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#06958a] disabled:opacity-50"
            >
              {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Crear API key
            </button>
          </form>

          {/* New token reveal */}
          {newToken && (
            <div className="mt-4 rounded-lg border border-yellow-500/40 bg-yellow-500/5 p-4">
              <div className="text-xs font-semibold text-yellow-300">Tu nueva API key — cópiala AHORA, no la verás de nuevo:</div>
              <div className="mt-2 flex items-center gap-2 rounded-md bg-black/50 px-3 py-2 font-mono text-xs">
                <span className="flex-1 break-all">{newToken}</span>
                <button onClick={copyToken} className="shrink-0 text-gray-400 hover:text-white">
                  {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
              <button
                onClick={() => setNewToken(null)}
                className="mt-3 text-[11px] text-gray-400 underline hover:text-white"
              >
                Ya la guardé
              </button>
            </div>
          )}

          {/* Lista */}
          {loading ? (
            <div className="mt-6 text-sm text-gray-500">Cargando…</div>
          ) : keys.length === 0 ? (
            <div className="mt-12 rounded-lg border border-dashed border-gray-800 p-12 text-center">
              <Key className="mx-auto h-12 w-12 text-gray-600" />
              <h3 className="mt-4 text-lg font-semibold">Sin API keys aún</h3>
              <p className="mt-1 text-sm text-gray-400">Crea una para empezar a integrar Riverz con tus automatizaciones.</p>
            </div>
          ) : (
            <ul className="mt-6 space-y-2">
              {keys.map((k) => (
                <li key={k.id} className="flex items-center justify-between rounded-lg border border-gray-800 bg-[#0d0d0d] p-3 text-xs">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{k.name}</span>
                      <span className="font-mono text-[10px] text-gray-500">{k.key_prefix}••••••••</span>
                    </div>
                    <div className="mt-0.5 text-[10px] text-gray-500">
                      Creada {new Date(k.created_at).toLocaleDateString()}
                      {k.last_used_at ? ` · Último uso ${new Date(k.last_used_at).toLocaleString()}` : ' · Nunca usada'}
                    </div>
                  </div>
                  <button onClick={() => handleRevoke(k.id)} className="text-gray-500 hover:text-red-400" title="Revocar">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Quick reference */}
          <div className="mt-12 rounded-lg border border-gray-800 bg-[#0d0d0d] p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">Quick Reference</h2>
              <a
                href="https://app.ecomwize.io/api-keys"
                target="_blank"
                rel="noreferrer"
                className="rounded-md border border-gray-800 px-2 py-1 text-[10px] text-gray-400 hover:bg-gray-900"
              >
                {'</>'} Documentación
              </a>
            </div>
            <div className="mt-4 space-y-2 font-mono text-xs">
              <Endpoint method="GET" path="/api/v1/pages" desc="Listar páginas" />
              <Endpoint method="GET" path="/api/v1/pages/{id}" desc="Obtener una página completa" />
              <Endpoint method="POST" path="/api/v1/pages/{id}/fill" desc="Re-generar copys con IA" />
              <Endpoint method="POST" path="/api/v1/pages/{id}/duplicate-and-fill" desc="Clonar y re-generar" />
            </div>
            <div className="mt-4 text-[11px] text-gray-500">
              Autenticá con header <code className="rounded bg-black/50 px-1.5 py-0.5">Authorization: Bearer rvz_live_...</code>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function Endpoint({ method, path, desc }: { method: 'GET' | 'POST'; path: string; desc: string }) {
  const colors = method === 'GET' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-blue-500/15 text-blue-300';
  return (
    <div className="flex items-center gap-3 rounded-md bg-black/30 px-3 py-2">
      <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${colors}`}>{method}</span>
      <code className="flex-1 text-[11px]">{path}</code>
      <span className="text-[10px] text-gray-500">{desc}</span>
    </div>
  );
}
