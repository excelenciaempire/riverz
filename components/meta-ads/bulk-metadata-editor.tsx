'use client';

import { useState, useMemo } from 'react';
import { ChevronDown, Check, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Generation } from '@/types';
import type { MetaAdMetadata } from '@/types/meta';
import { cn } from '@/lib/utils';

const VIDEO_TYPES = new Set(['ugc', 'face_swap', 'clips', 'mejorar_calidad_video']);

const CTA_OPTIONS = [
  'SHOP_NOW',
  'LEARN_MORE',
  'SIGN_UP',
  'GET_OFFER',
  'BOOK_TRAVEL',
  'DOWNLOAD',
  'CONTACT_US',
  'SUBSCRIBE',
  'WATCH_MORE',
];

interface Props {
  generations: Generation[];
  metadata: Record<string, MetaAdMetadata>;
  onChange: (next: Record<string, MetaAdMetadata>) => void;
  defaults?: { link_url?: string; cta?: string };
}

/**
 * Kitchn-style bulk metadata editor:
 *  - Top "Edit all" toolbar applies a value to every selected asset.
 *  - Each asset row shows its preview + collapsible per-asset overrides.
 *  - Empty per-asset value falls back to the bulk default.
 */
export function BulkMetadataEditor({ generations, metadata, onChange, defaults }: Props) {
  const [bulk, setBulk] = useState<MetaAdMetadata>({
    primary_text: '',
    headline: '',
    description: '',
    link_url: defaults?.link_url ?? '',
    cta: defaults?.cta ?? 'SHOP_NOW',
  });
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const counts = useMemo(() => {
    let images = 0;
    let videos = 0;
    for (const g of generations) {
      if (VIDEO_TYPES.has(g.type) || g.type.includes('video')) videos += 1;
      else images += 1;
    }
    return { images, videos };
  }, [generations]);

  const updateAsset = (id: string, patch: Partial<MetaAdMetadata>) => {
    const current = metadata[id] || {};
    onChange({ ...metadata, [id]: { ...current, ...patch } });
  };

  const applyBulkToAll = (field: keyof MetaAdMetadata) => {
    const value = bulk[field];
    if (!value) return;
    const next = { ...metadata };
    for (const g of generations) {
      next[g.id] = { ...(next[g.id] || {}), [field]: value };
    }
    onChange(next);
  };

  const applyAllBulk = () => {
    const next = { ...metadata };
    for (const g of generations) {
      const cur = next[g.id] || {};
      next[g.id] = {
        ...cur,
        primary_text: bulk.primary_text || cur.primary_text,
        headline: bulk.headline || cur.headline,
        description: bulk.description || cur.description,
        link_url: bulk.link_url || cur.link_url,
        cta: bulk.cta || cur.cta,
      };
    }
    onChange(next);
  };

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-brand-accent/30 bg-brand-accent/5 p-4">
        <div className="mb-2 flex items-center gap-2">
          <Wand2 className="h-4 w-4 text-brand-accent" />
          <p className="text-sm font-semibold text-white">
            Edición en bulk · {generations.length} asset{generations.length === 1 ? '' : 's'}
            <span className="ml-2 text-xs font-normal text-gray-400">
              ({counts.images} img · {counts.videos} video)
            </span>
          </p>
        </div>
        <p className="mb-3 text-xs text-gray-400">
          Lo que escribas aquí se aplicará a todos. Después puedes ajustar cada asset individualmente abajo.
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          <BulkInput
            label="Texto principal"
            value={bulk.primary_text || ''}
            onChange={(v) => setBulk({ ...bulk, primary_text: v })}
            onApply={() => applyBulkToAll('primary_text')}
            multiline
            placeholder="El copy del cuerpo del anuncio"
          />
          <BulkInput
            label="Headline (≤40 chars)"
            value={bulk.headline || ''}
            onChange={(v) => setBulk({ ...bulk, headline: v })}
            onApply={() => applyBulkToAll('headline')}
            placeholder="Titular corto"
          />
          <BulkInput
            label="Descripción"
            value={bulk.description || ''}
            onChange={(v) => setBulk({ ...bulk, description: v })}
            onApply={() => applyBulkToAll('description')}
            placeholder="Subtítulo opcional"
          />
          <BulkInput
            label="URL destino"
            value={bulk.link_url || ''}
            onChange={(v) => setBulk({ ...bulk, link_url: v })}
            onApply={() => applyBulkToAll('link_url')}
            placeholder="https://shop.example.com/producto"
          />
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-wide text-gray-500">CTA</label>
            <div className="flex gap-2">
              <Select value={bulk.cta || 'SHOP_NOW'} onValueChange={(v) => setBulk({ ...bulk, cta: v })}>
                <SelectTrigger className="border-gray-700 bg-[#0a0a0a] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-gray-800 bg-[#141414] text-white">
                  {CTA_OPTIONS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c.replace(/_/g, ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <button
                onClick={() => applyBulkToAll('cta')}
                className="rounded border border-brand-accent/40 bg-brand-accent/10 px-2 text-xs text-brand-accent hover:bg-brand-accent/20"
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <Button size="sm" onClick={applyAllBulk} variant="outline">
            <Check className="mr-1.5 h-3.5 w-3.5" />
            Aplicar todo a los {generations.length} assets
          </Button>
        </div>
      </div>

      {/* Per-asset rows */}
      <div className="space-y-2">
        {generations.map((g, i) => {
          const meta = metadata[g.id] || {};
          const isVideo = VIDEO_TYPES.has(g.type) || g.type.includes('video');
          const isOpen = expanded.has(g.id);
          const effectiveName = meta.name || `Anuncio ${String(i + 1).padStart(2, '0')}`;
          const hasOverride = !!(meta.primary_text || meta.headline || meta.description || meta.link_url);
          return (
            <div key={g.id} className="rounded-lg border border-gray-800 bg-black/40">
              <div className="flex items-center gap-3 p-3">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md bg-gray-900">
                  {g.result_url ? (
                    isVideo ? (
                      <video src={g.result_url} className="h-full w-full object-cover" muted />
                    ) : (
                      <img src={g.result_url} alt="" className="h-full w-full object-cover" />
                    )
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <input
                    value={meta.name || ''}
                    onChange={(e) => updateAsset(g.id, { name: e.target.value })}
                    placeholder={effectiveName}
                    className="w-full rounded bg-transparent text-sm font-medium text-white placeholder-gray-500 focus:outline-none"
                  />
                  <p className="text-[11px] text-gray-500">
                    {g.type.replace(/_/g, ' ')} · {isVideo ? 'video' : 'imagen'}
                    {hasOverride && <span className="ml-2 text-brand-accent">· overrides</span>}
                  </p>
                </div>
                <button
                  onClick={() => toggleExpanded(g.id)}
                  className="rounded p-1.5 text-gray-400 hover:bg-gray-800 hover:text-white"
                >
                  <ChevronDown className={cn('h-4 w-4 transition', isOpen && 'rotate-180')} />
                </button>
              </div>
              {isOpen && (
                <div className="grid gap-2.5 border-t border-gray-800 p-3 md:grid-cols-2">
                  <Field
                    label="Texto principal"
                    value={meta.primary_text || ''}
                    placeholder={bulk.primary_text || 'Usa el bulk'}
                    onChange={(v) => updateAsset(g.id, { primary_text: v })}
                    multiline
                  />
                  <Field
                    label="Headline"
                    value={meta.headline || ''}
                    placeholder={bulk.headline || 'Usa el bulk'}
                    onChange={(v) => updateAsset(g.id, { headline: v })}
                  />
                  <Field
                    label="Descripción"
                    value={meta.description || ''}
                    placeholder={bulk.description || 'Usa el bulk'}
                    onChange={(v) => updateAsset(g.id, { description: v })}
                  />
                  <Field
                    label="URL destino"
                    value={meta.link_url || ''}
                    placeholder={bulk.link_url || 'Usa el bulk'}
                    onChange={(v) => updateAsset(g.id, { link_url: v })}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BulkInput({
  label,
  value,
  onChange,
  onApply,
  placeholder,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onApply: () => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-[10px] uppercase tracking-wide text-gray-500">{label}</label>
      <div className="flex gap-2">
        {multiline ? (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            rows={2}
            className="min-h-[40px] flex-1 resize-y rounded border border-gray-700 bg-[#0a0a0a] px-2 py-1.5 text-sm text-white placeholder-gray-600 focus:border-brand-accent focus:outline-none"
          />
        ) : (
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="flex-1 rounded border border-gray-700 bg-[#0a0a0a] px-2 py-1.5 text-sm text-white placeholder-gray-600 focus:border-brand-accent focus:outline-none"
          />
        )}
        <button
          onClick={onApply}
          disabled={!value}
          className="shrink-0 rounded border border-brand-accent/40 bg-brand-accent/10 px-2 text-xs text-brand-accent hover:bg-brand-accent/20 disabled:opacity-40"
        >
          Aplicar
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-[10px] uppercase tracking-wide text-gray-500">{label}</label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={2}
          className="w-full resize-y rounded border border-gray-800 bg-black/40 px-2 py-1.5 text-sm text-white placeholder-gray-600 focus:border-brand-accent focus:outline-none"
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded border border-gray-800 bg-black/40 px-2 py-1.5 text-sm text-white placeholder-gray-600 focus:border-brand-accent focus:outline-none"
        />
      )}
    </div>
  );
}
