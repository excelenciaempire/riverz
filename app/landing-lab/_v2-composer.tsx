'use client';

/**
 * Composer V2 — pequeño bloque que vive en el Home (/landing-lab) para
 * crear páginas con el nuevo editor React. No reemplaza al composer
 * legacy de templates HTML; convive como segunda opción visible.
 *
 * Flow:
 *   1. Usuario elige tipo de página (4) y opcionalmente un producto.
 *   2. POST /api/landing-pages con preset_sections según el tipo.
 *   3. Redirige al editor v2 /landing-lab/edit/{id}.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Sparkles, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LandingPageKind } from '@/types/landing-pages';

const PRESETS: Record<LandingPageKind, string[]> = {
  landing_page: ['navigation-01', 'hero-01', 'benefits-01', 'testimonials-01', 'faqs-01'],
  product_page: ['navigation-01', 'hero-02', 'benefits-02', 'testimonials-01', 'faqs-01'],
  listicle: ['hero-03', 'benefits-02', 'stats-01', 'testimonials-01'],
  advertorial: ['hero-03', 'benefits-02', 'testimonials-01', 'faqs-01', 'banners-01'],
};

const KIND_LABELS: Record<LandingPageKind, { label: string; desc: string }> = {
  landing_page: { label: 'Landing Page', desc: 'Test de oferta o ángulo nuevo.' },
  product_page: { label: 'Product Page', desc: 'Página de producto custom.' },
  listicle: { label: 'Listicle', desc: '"5 razones por las que…".' },
  advertorial: { label: 'Advertorial', desc: 'Educa cold traffic antes de comprar.' },
};

interface Product {
  id: string;
  name: string;
}

export function V2Composer({ products }: { products: Product[] }) {
  const router = useRouter();
  const [kind, setKind] = useState<LandingPageKind>('landing_page');
  const [productId, setProductId] = useState<string | ''>(products[0]?.id ?? '');
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);

  async function handleCreate() {
    setCreating(true);
    try {
      const res = await fetch('/api/landing-pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim() || `${KIND_LABELS[kind].label} sin título`,
          kind,
          product_id: productId || null,
          preset_sections: PRESETS[kind],
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'create failed');
      router.push(`/landing-lab/edit/${j.page.id}`);
    } catch (e: any) {
      alert(e?.message ?? 'error');
      setCreating(false);
    }
  }

  return (
    <div className="rounded-2xl border border-[#07A498]/40 bg-gradient-to-br from-[#07A498]/10 via-transparent to-purple-500/10 p-5">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-[#07A498]" />
        <span className="text-xs font-semibold uppercase tracking-wider text-[#07A498]">Editor V2 · React nativo</span>
      </div>
      <h2 className="mt-2 text-2xl font-bold">Empieza con el nuevo builder</h2>
      <p className="mt-1 text-sm text-gray-400">Secciones modulares + IA en cada nivel. Publica directo a Shopify.</p>

      <div className="mt-5 grid gap-2 sm:grid-cols-4">
        {(Object.keys(KIND_LABELS) as LandingPageKind[]).map((k) => (
          <button
            key={k}
            onClick={() => setKind(k)}
            className={cn(
              'rounded-lg border p-3 text-left text-xs transition-all',
              kind === k
                ? 'border-[#07A498] bg-[#07A498]/10'
                : 'border-gray-800 hover:border-gray-700',
            )}
          >
            <div className="font-semibold">{KIND_LABELS[k].label}</div>
            <div className="mt-0.5 text-[10px] text-gray-500">{KIND_LABELS[k].desc}</div>
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre de la página (opcional)"
          className="flex-1 rounded-md border border-gray-800 bg-black px-3 py-2 text-sm placeholder:text-gray-600 focus:border-[#07A498] focus:outline-none"
        />
        {products.length > 0 && (
          <select
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            className="rounded-md border border-gray-800 bg-black px-3 py-2 text-sm focus:border-[#07A498] focus:outline-none"
          >
            <option value="">Sin producto</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
        <button
          onClick={handleCreate}
          disabled={creating}
          className="flex items-center gap-1.5 rounded-md bg-[#07A498] px-4 py-2 text-sm font-semibold text-white hover:bg-[#06958a] disabled:opacity-50"
        >
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
          Crear página
        </button>
      </div>
    </div>
  );
}
