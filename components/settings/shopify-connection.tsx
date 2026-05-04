'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ShoppingBag, ExternalLink, Trash2, Plus, AlertTriangle } from 'lucide-react';

interface ShopifyConnectionRow {
  id: string;
  shop_domain: string;
  shop_name: string | null;
  scope: string | null;
  status: 'active' | 'uninstalled' | 'expired' | 'error';
  last_error: string | null;
  installed_at: string | null;
  uninstalled_at: string | null;
}

export function ShopifyConnectionPanel() {
  const qc = useQueryClient();
  const [shopInput, setShopInput] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['shopify-connections'],
    queryFn: async () => {
      const res = await fetch('/api/shopify/connections');
      if (!res.ok) throw new Error('Failed to load connections');
      return (await res.json()) as { connections: ShopifyConnectionRow[] };
    },
  });

  const disconnect = useMutation({
    mutationFn: async (shop: string) => {
      const res = await fetch('/api/shopify/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shop_domain: shop }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Error al desconectar');
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shopify-connections'] });
      toast.success('Tienda desconectada');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const startInstall = () => {
    const shop = shopInput.trim();
    if (!shop) {
      toast.error('Escribe el dominio de tu tienda');
      return;
    }
    // Server normalizes "vitalu" → "vitalu.myshopify.com"
    window.location.href = `/api/shopify/install?shop=${encodeURIComponent(shop)}`;
  };

  const active = (data?.connections || []).filter((c) => c.status === 'active');
  const inactive = (data?.connections || []).filter((c) => c.status !== 'active');

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-emerald-500/10 p-2.5">
          <ShoppingBag className="h-5 w-5 text-emerald-400" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-white">Shopify</h3>
          <p className="mt-1 text-sm text-gray-400">
            Conecta tu tienda Shopify y publica tus landings creadas en Riverz como Pages,
            con todas las imágenes alojadas automáticamente en Shopify Files.
          </p>
        </div>
      </div>

      {/* Connect form — hidden once a store is connected. Riverz now
          enforces one Shopify store per account: to connect another the
          user must disconnect the current one first. */}
      {active.length === 0 ? (
        <div className="rounded-lg border border-gray-800 bg-black/30 p-4">
          <Label htmlFor="shopify-shop" className="text-sm text-gray-300">
            Conectar tu tienda
          </Label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <Input
              id="shopify-shop"
              value={shopInput}
              onChange={(e) => setShopInput(e.target.value)}
              placeholder="tu-tienda.myshopify.com"
              onKeyDown={(e) => e.key === 'Enter' && startInstall()}
              className="flex-1"
            />
            <Button onClick={startInstall} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Conectar Shopify
            </Button>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Vas a ser redirigido a Shopify para autorizar el acceso. Solo pedimos permisos para
            subir imágenes (Files) y crear páginas (Pages) — no leemos clientes ni pedidos.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm text-emerald-200">
          Tu cuenta de Riverz está conectada a una tienda. Para conectar una distinta,
          desconectá primero la actual abajo.
        </div>
      )}

      {/* Active connections */}
      {isLoading ? (
        <div className="text-sm text-gray-400">Cargando conexiones...</div>
      ) : active.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-700 p-6 text-center text-sm text-gray-500">
          Aún no has conectado ninguna tienda Shopify.
        </div>
      ) : (
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-wider text-gray-500">Tiendas conectadas</div>
          {active.map((c) => (
            <ConnectionRow key={c.id} c={c} onDisconnect={() => disconnect.mutate(c.shop_domain)} />
          ))}
        </div>
      )}

      {inactive.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-wider text-gray-500">Histórico</div>
          {inactive.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-lg border border-gray-800 bg-black/20 p-3 opacity-60">
              <div>
                <div className="text-sm text-gray-300">{c.shop_domain}</div>
                <div className="text-xs text-gray-500">
                  {c.status === 'uninstalled' ? 'Desinstalada' : c.status} ·{' '}
                  {c.uninstalled_at ? new Date(c.uninstalled_at).toLocaleDateString() : '—'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ConnectionRow({ c, onDisconnect }: { c: ShopifyConnectionRow; onDisconnect: () => void }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-800 bg-black/30 p-3">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white">{c.shop_domain}</span>
          <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-emerald-300">
            Activa
          </span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
          <span>Conectada {c.installed_at ? new Date(c.installed_at).toLocaleDateString() : '—'}</span>
          {c.scope && <span className="font-mono text-[10px] text-gray-600">scopes: {c.scope}</span>}
          {c.last_error && (
            <span className="flex items-center gap-1 text-amber-400">
              <AlertTriangle className="h-3 w-3" /> {c.last_error}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <a
          href={`https://${c.shop_domain}/admin`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-gray-400 hover:text-white inline-flex items-center gap-1"
        >
          Admin <ExternalLink className="h-3 w-3" />
        </a>
        <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300" onClick={onDisconnect}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
