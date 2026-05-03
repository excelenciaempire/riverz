'use client';

/**
 * Stores — listado de tiendas Shopify conectadas. Reusa íntegramente el
 * backend existente en /api/shopify/*. Esta página sólo es presentación.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Store as StoreIcon, ExternalLink, Unplug, Loader2 } from 'lucide-react';
import { SideNav } from '../_side-nav';

interface Connection {
  id: string;
  shop_domain: string;
  shop_name: string | null;
  scope: string | null;
  status: string;
  installed_at: string | null;
  uninstalled_at: string | null;
}

export default function StoresPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState(false);
  const [shop, setShop] = useState('');

  useEffect(() => {
    fetch('/api/shopify/connections')
      .then((r) => r.json())
      .then((j) => setConnections(j.connections ?? []))
      .finally(() => setLoading(false));
  }, []);

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    if (!shop.trim()) return;
    setInstalling(true);
    const domain = shop.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
    window.location.href = `/api/shopify/install?shop=${encodeURIComponent(domain)}`;
  }

  async function handleDisconnect(shopDomain: string) {
    if (!confirm(`¿Desconectar ${shopDomain}? Las páginas publicadas seguirán en Shopify pero no podrás republicar.`)) return;
    const res = await fetch('/api/shopify/disconnect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shop_domain: shopDomain }),
    });
    if (res.ok) {
      setConnections((c) => c.filter((x) => x.shop_domain !== shopDomain));
    } else {
      alert('No se pudo desconectar.');
    }
  }

  return (
    <div className="flex min-h-screen bg-[#0a0a0a] text-white">
      <SideNav active="tienda" />
      <main className="ml-56 flex-1 p-8">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold">Tiendas</h1>
              <p className="mt-1 text-sm text-gray-400">Gestiona tus tiendas Shopify conectadas.</p>
            </div>
          </div>

          <form onSubmit={handleConnect} className="mt-8 flex items-center gap-2 rounded-lg border border-gray-800 bg-[#0d0d0d] p-3">
            <Plus className="h-4 w-4 text-[#07A498]" />
            <input
              value={shop}
              onChange={(e) => setShop(e.target.value)}
              placeholder="tu-tienda.myshopify.com"
              className="flex-1 bg-transparent text-sm placeholder:text-gray-600 focus:outline-none"
            />
            <button
              type="submit"
              disabled={installing || !shop.trim()}
              className="flex items-center gap-1.5 rounded-md bg-[#07A498] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#06958a] disabled:opacity-50"
            >
              {installing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Conectar tienda
            </button>
          </form>

          {loading ? (
            <div className="mt-6 text-sm text-gray-500">Cargando…</div>
          ) : connections.length === 0 ? (
            <div className="mt-12 rounded-lg border border-dashed border-gray-800 p-12 text-center">
              <StoreIcon className="mx-auto h-12 w-12 text-gray-600" />
              <h3 className="mt-4 text-lg font-semibold">Sin tiendas conectadas</h3>
              <p className="mt-1 text-sm text-gray-400">
                Conecta tu Shopify para publicar las landings que crees con el editor.
              </p>
            </div>
          ) : (
            <ul className="mt-6 space-y-3">
              {connections.map((c) => (
                <li key={c.id} className="flex items-center justify-between rounded-lg border border-gray-800 bg-[#0d0d0d] p-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <StoreIcon className="h-4 w-4 text-[#07A498]" />
                      <span className="font-medium">{c.shop_name || c.shop_domain}</span>
                      <span
                        className={`rounded-full px-2 py-[1px] text-[10px] font-semibold uppercase ${
                          c.status === 'active' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-yellow-500/15 text-yellow-300'
                        }`}
                      >
                        {c.status === 'active' ? 'Conectada' : c.status}
                      </span>
                    </div>
                    <a
                      href={`https://${c.shop_domain}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300"
                    >
                      {c.shop_domain}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    {c.installed_at && (
                      <div className="mt-1 text-[10px] text-gray-600">
                        Conectada {new Date(c.installed_at).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleDisconnect(c.shop_domain)}
                    className="flex items-center gap-1.5 rounded-md border border-gray-800 px-3 py-1.5 text-xs text-gray-400 hover:border-red-500/50 hover:text-red-400"
                  >
                    <Unplug className="h-3.5 w-3.5" />
                    Desconectar
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-12 rounded-lg border border-blue-500/30 bg-blue-500/5 p-4 text-xs text-blue-200">
            <strong>Cómo funciona:</strong> publicas tus landings desde el editor. Si cambias el theme de tu Shopify, vuelve a publicar las páginas para que se vean correctamente.
          </div>
        </div>
      </main>
    </div>
  );
}
