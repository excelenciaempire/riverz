'use client';

import { useMemo, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronDown,
  Copy,
  Plus,
  Settings,
  Sparkles,
  Trash2,
  Wand2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { cn } from '@/lib/utils';
import type {
  AdDraftRow,
  AdRowIdentity,
  AdSetTarget,
  CampaignObjective,
  CampaignTarget,
  ListAdSetsResponse,
  ListCampaignsResponse,
  MetaAdMetadata,
  MetaAiFeatures,
  NewAdSetSpec,
  NewCampaignSpec,
} from '@/types/meta';

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
  'APPLY_NOW',
  'ORDER_NOW',
] as const;

const OBJECTIVES: Array<{ value: CampaignObjective; label: string }> = [
  { value: 'OUTCOME_SALES', label: 'Ventas' },
  { value: 'OUTCOME_TRAFFIC', label: 'Tráfico' },
  { value: 'OUTCOME_ENGAGEMENT', label: 'Interacción' },
  { value: 'OUTCOME_LEADS', label: 'Leads' },
  { value: 'OUTCOME_AWARENESS', label: 'Awareness' },
];

const COUNTRY_OPTIONS = [
  { code: 'US', label: 'Estados Unidos' },
  { code: 'MX', label: 'México' },
  { code: 'CO', label: 'Colombia' },
  { code: 'AR', label: 'Argentina' },
  { code: 'ES', label: 'España' },
  { code: 'CL', label: 'Chile' },
  { code: 'PE', label: 'Perú' },
  { code: 'BR', label: 'Brasil' },
];

const AI_FEATURE_LABELS: Array<{ key: keyof MetaAiFeatures; label: string; hint: string }> = [
  { key: 'advantage_creative_overall', label: 'Advantage+ Creative', hint: 'Master toggle de IA creativa' },
  { key: 'standard_enhancements', label: 'Standard Enhancements', hint: 'Brillo / contraste auto' },
  { key: 'image_touchups', label: 'Image touch-ups', hint: 'Retoque automático de imagen' },
  { key: 'image_animation', label: 'Image animation', hint: 'Anima imágenes estáticas' },
  { key: 'text_improvements', label: 'Text optimizations', hint: 'Re-escribe primary text' },
  { key: 'description_visibility', label: 'Description visibility', hint: 'Mostrar descripciones' },
  { key: 'music', label: 'Music', hint: 'Agrega música a videos sin audio' },
  { key: 'video_auto_crop', label: 'Video auto-crop', hint: 'Recorte automático para placements' },
  { key: 'site_extensions', label: 'Site extensions', hint: 'Sitelinks debajo del anuncio' },
  { key: 'cta_optimization', label: 'CTA optimization', hint: 'Rota el CTA dinámicamente' },
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AdGridRow extends AdDraftRow {
  // UI-only
  resultUrl?: string;
  generationType?: string;
}

interface AdGridEditorProps {
  rows: AdGridRow[];
  onChange: (next: AdGridRow[]) => void;
  adAccountId: string;
  defaultIdentity: AdRowIdentity;
  onImportAssets: () => void;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AdGridEditor({
  rows,
  onChange,
  adAccountId,
  defaultIdentity,
  onImportAssets,
}: AdGridEditorProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [multiBulkOpen, setMultiBulkOpen] = useState(false);

  const campaignsQuery = useQuery<ListCampaignsResponse>({
    queryKey: ['meta-campaigns-list', adAccountId],
    queryFn: async () => {
      const res = await fetch(`/api/meta/campaigns/list?adAccountId=${adAccountId}`);
      if (!res.ok) throw new Error('No se pudieron cargar las campañas');
      return res.json();
    },
    enabled: !!adAccountId,
    staleTime: 60_000,
  });

  const adsetsQuery = useQuery<ListAdSetsResponse>({
    queryKey: ['meta-adsets-list', adAccountId],
    queryFn: async () => {
      const res = await fetch(`/api/meta/adsets/list?adAccountId=${adAccountId}`);
      if (!res.ok) throw new Error('No se pudieron cargar los ad sets');
      return res.json();
    },
    enabled: !!adAccountId,
    staleTime: 60_000,
  });

  const allCampaigns = campaignsQuery.data?.campaigns ?? [];
  const allAdsets = adsetsQuery.data?.adsets ?? [];

  // Limpia selecciones que ya no están en filas
  useEffect(() => {
    setSelected((prev) => {
      const valid = new Set(rows.map((r) => r.rowId));
      const next = new Set<string>();
      for (const id of prev) if (valid.has(id)) next.add(id);
      return next;
    });
  }, [rows]);

  const allSelected = rows.length > 0 && selected.size === rows.length;
  const toggleSelectAll = () =>
    setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.rowId)));
  const toggleRow = (rowId: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });

  const updateRow = (rowId: string, patch: Partial<AdGridRow>) => {
    onChange(rows.map((r) => (r.rowId === rowId ? { ...r, ...patch } : r)));
  };
  const updateMetadata = (rowId: string, patch: Partial<MetaAdMetadata>) => {
    const row = rows.find((r) => r.rowId === rowId);
    if (!row) return;
    updateRow(rowId, { metadata: { ...row.metadata, ...patch } });
  };
  const duplicateRow = (rowId: string) => {
    const idx = rows.findIndex((r) => r.rowId === rowId);
    if (idx < 0) return;
    const original = rows[idx];
    const copy: AdGridRow = {
      ...original,
      rowId: crypto.randomUUID(),
      metadata: { ...original.metadata, name: `${original.metadata.name || 'Anuncio'} (copy)` },
    };
    const next = [...rows];
    next.splice(idx + 1, 0, copy);
    onChange(next);
  };
  const deleteRow = (rowId: string) => {
    onChange(rows.filter((r) => r.rowId !== rowId));
  };

  // Bulk edit helpers
  const applyToSelected = (patch: Partial<MetaAdMetadata>) => {
    if (selected.size === 0) return;
    onChange(
      rows.map((r) =>
        selected.has(r.rowId) ? { ...r, metadata: { ...r.metadata, ...patch } } : r,
      ),
    );
  };
  const applyTargetToSelected = (
    target: { campaign?: CampaignTarget; adset?: AdSetTarget },
  ) => {
    if (selected.size === 0) return;
    onChange(
      rows.map((r) =>
        selected.has(r.rowId)
          ? {
              ...r,
              campaign: target.campaign ?? r.campaign,
              adset: target.adset ?? r.adset,
            }
          : r,
      ),
    );
  };
  const bulkAction = (action: 'duplicate' | 'delete') => {
    if (selected.size === 0) return;
    if (action === 'duplicate') {
      const copies: AdGridRow[] = [];
      for (const r of rows) {
        if (!selected.has(r.rowId)) continue;
        copies.push({
          ...r,
          rowId: crypto.randomUUID(),
          metadata: { ...r.metadata, name: `${r.metadata.name || 'Anuncio'} (copy)` },
        });
      }
      onChange([...rows, ...copies]);
    } else {
      onChange(rows.filter((r) => !selected.has(r.rowId)));
      setSelected(new Set());
    }
  };

  // Validación pre-launch
  const errorsByRow = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const r of rows) {
      const errs: string[] = [];
      if (!r.metadata.link_url) errs.push('Falta destination URL');
      if (!r.metadata.headline && !(r.metadata.headlines && r.metadata.headlines.length))
        errs.push('Falta headline');
      if (r.campaign.kind === 'new' && !r.campaign.spec.name.trim())
        errs.push('Nueva campaña sin nombre');
      if (r.adset.kind === 'new') {
        if (!r.adset.spec.name.trim()) errs.push('Nuevo ad set sin nombre');
        if (!r.adset.spec.daily_budget_cents || r.adset.spec.daily_budget_cents < 100)
          errs.push('Budget inválido');
      }
      if (errs.length) map.set(r.rowId, errs);
    }
    return map;
  }, [rows]);

  return (
    <div className="space-y-3">
      {/* Top toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-800 bg-[#0a0a0a] p-3">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={onImportAssets}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Importar assets
          </Button>
          <span className="text-xs text-gray-500">
            <span className="text-white">{rows.length}</span> ads ·{' '}
            <span className="text-white">{selected.size}</span> seleccionados
          </span>
        </div>

        <div className="flex items-center gap-2">
          <BulkEditMenu
            disabled={selected.size === 0}
            onApply={applyToSelected}
            onApplyTarget={applyTargetToSelected}
            campaigns={allCampaigns}
            adsets={allAdsets}
          />
          <Button size="sm" variant="outline" onClick={() => setMultiBulkOpen(true)} disabled={selected.size === 0}>
            <Wand2 className="mr-1.5 h-3.5 w-3.5" /> Multi Bulk Edit
          </Button>
          <BulkActionsMenu
            disabled={selected.size === 0}
            onDuplicate={() => bulkAction('duplicate')}
            onDelete={() => bulkAction('delete')}
          />
        </div>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto rounded-lg border border-gray-800 bg-[#0a0a0a]">
        <table className="min-w-[2200px] w-full text-xs">
          <thead className="sticky top-0 z-10 bg-[#141414] text-[10px] uppercase tracking-wide text-gray-400">
            <tr>
              <Th className="w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  className="h-3.5 w-3.5"
                />
              </Th>
              <Th className="w-16">Asset</Th>
              <Th className="w-44">Ad name</Th>
              <Th className="w-56">Campaña</Th>
              <Th className="w-56">Ad set</Th>
              <Th className="w-72">Primary text</Th>
              <Th className="w-56">Headlines</Th>
              <Th className="w-56">Descriptions</Th>
              <Th className="w-72">Destination URL</Th>
              <Th className="w-44">Display URL</Th>
              <Th className="w-72">URL params</Th>
              <Th className="w-40">CTA</Th>
              <Th className="w-32">Identidad</Th>
              <Th className="w-32">IA features</Th>
              <Th className="w-20">Acciones</Th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={15} className="p-12 text-center text-gray-500">
                  Aún no hay anuncios. Haz clic en{' '}
                  <button onClick={onImportAssets} className="text-brand-accent hover:underline">
                    Importar assets
                  </button>{' '}
                  para empezar.
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <RowEditor
                  key={row.rowId}
                  row={row}
                  index={i}
                  isSelected={selected.has(row.rowId)}
                  onToggleSelect={() => toggleRow(row.rowId)}
                  onUpdateMetadata={(patch) => updateMetadata(row.rowId, patch)}
                  onUpdateRow={(patch) => updateRow(row.rowId, patch)}
                  onDuplicate={() => duplicateRow(row.rowId)}
                  onDelete={() => deleteRow(row.rowId)}
                  defaultIdentity={defaultIdentity}
                  campaigns={allCampaigns}
                  adsets={allAdsets}
                  errors={errorsByRow.get(row.rowId) || []}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {errorsByRow.size > 0 && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-300">
          {errorsByRow.size} fila{errorsByRow.size === 1 ? '' : 's'} con errores. Corrígelos antes de lanzar.
        </div>
      )}

      <MultiBulkEditModal
        isOpen={multiBulkOpen}
        onClose={() => setMultiBulkOpen(false)}
        selectedCount={selected.size}
        onApply={applyToSelected}
        onApplyTarget={applyTargetToSelected}
        campaigns={allCampaigns}
        adsets={allAdsets}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Row
// ---------------------------------------------------------------------------

interface RowEditorProps {
  row: AdGridRow;
  index: number;
  isSelected: boolean;
  onToggleSelect: () => void;
  onUpdateMetadata: (patch: Partial<MetaAdMetadata>) => void;
  onUpdateRow: (patch: Partial<AdGridRow>) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  defaultIdentity: AdRowIdentity;
  campaigns: ListCampaignsResponse['campaigns'];
  adsets: ListAdSetsResponse['adsets'];
  errors: string[];
}

function RowEditor({
  row,
  index,
  isSelected,
  onToggleSelect,
  onUpdateMetadata,
  onUpdateRow,
  onDuplicate,
  onDelete,
  defaultIdentity,
  campaigns,
  adsets,
  errors,
}: RowEditorProps) {
  const isVideo = row.generationType
    ? VIDEO_TYPES.has(row.generationType) || row.generationType.includes('video')
    : false;
  const meta = row.metadata;
  const hasError = errors.length > 0;

  return (
    <tr
      className={cn(
        'border-t border-gray-800',
        isSelected ? 'bg-brand-accent/5' : 'hover:bg-[#0d0d0d]',
        hasError && 'bg-amber-500/[0.03]',
      )}
    >
      <Td>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggleSelect}
          className="h-3.5 w-3.5"
        />
      </Td>
      <Td>
        <div className="h-12 w-12 overflow-hidden rounded bg-gray-900">
          {row.resultUrl ? (
            isVideo ? (
              <video src={row.resultUrl} className="h-full w-full object-cover" muted />
            ) : (
              <img src={row.resultUrl} className="h-full w-full object-cover" alt="" />
            )
          ) : null}
        </div>
      </Td>
      <Td>
        <CellInput
          value={meta.name || ''}
          onChange={(v) => onUpdateMetadata({ name: v })}
          placeholder={`Anuncio ${String(index + 1).padStart(2, '0')}`}
        />
      </Td>
      <Td>
        <CampaignCell
          value={row.campaign}
          onChange={(c) => {
            // Reset ad set if campaign changes (ya no aplica)
            const currentAdset = row.adset;
            let adsetParent: string | undefined;
            if (currentAdset.kind === 'existing') {
              adsetParent = adsets.find((a) => a.id === currentAdset.id)?.campaign_id;
            }
            const newCampaignId = c.kind === 'existing' ? c.id : undefined;
            const shouldReset =
              currentAdset.kind === 'existing' && adsetParent && adsetParent !== newCampaignId;
            onUpdateRow({
              campaign: c,
              ...(shouldReset
                ? {
                    adset: {
                      kind: 'new',
                      spec: defaultNewAdSetSpec(),
                    } as AdSetTarget,
                  }
                : {}),
            });
          }}
          campaigns={campaigns}
        />
      </Td>
      <Td>
        <AdSetCell
          value={row.adset}
          campaign={row.campaign}
          allAdsets={adsets}
          onChange={(a) => onUpdateRow({ adset: a })}
        />
      </Td>
      <Td>
        <CellTextarea
          value={meta.primary_text || ''}
          onChange={(v) => onUpdateMetadata({ primary_text: v })}
          placeholder="Copy del cuerpo del anuncio"
        />
        {meta.primary_texts && meta.primary_texts.length > 0 && (
          <p className="mt-1 text-[10px] text-brand-accent">
            +{meta.primary_texts.length} variantes
          </p>
        )}
      </Td>
      <Td>
        <MultiValueCell
          values={meta.headlines && meta.headlines.length > 0 ? meta.headlines : meta.headline ? [meta.headline] : []}
          onChange={(vs) =>
            onUpdateMetadata({
              headlines: vs.length > 1 ? vs : undefined,
              headline: vs[0] || undefined,
            })
          }
          max={5}
          maxLen={40}
          placeholder="Headline (≤40)"
        />
      </Td>
      <Td>
        <MultiValueCell
          values={meta.descriptions && meta.descriptions.length > 0 ? meta.descriptions : meta.description ? [meta.description] : []}
          onChange={(vs) =>
            onUpdateMetadata({
              descriptions: vs.length > 1 ? vs : undefined,
              description: vs[0] || undefined,
            })
          }
          max={5}
          placeholder="Descripción"
        />
      </Td>
      <Td>
        <CellInput
          value={meta.link_url || ''}
          onChange={(v) => onUpdateMetadata({ link_url: v })}
          placeholder="https://shop.example.com/producto"
          invalid={!meta.link_url}
        />
      </Td>
      <Td>
        <CellInput
          value={meta.display_url || ''}
          onChange={(v) => onUpdateMetadata({ display_url: v })}
          placeholder="shop.example.com"
        />
      </Td>
      <Td>
        <CellInput
          value={meta.url_params || ''}
          onChange={(v) => onUpdateMetadata({ url_params: v })}
          placeholder="utm_source=meta&utm_campaign={{campaign.name}}"
          mono
        />
      </Td>
      <Td>
        <Select value={meta.cta || 'SHOP_NOW'} onValueChange={(v) => onUpdateMetadata({ cta: v })}>
          <SelectTrigger className="h-8 border-gray-800 bg-[#0a0a0a] text-xs text-white">
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
      </Td>
      <Td>
        <IdentityPopover
          metadata={meta}
          defaultIdentity={defaultIdentity}
          onChange={(p) => onUpdateMetadata(p)}
        />
      </Td>
      <Td>
        <AiFeaturesPopover
          features={meta.ai_features}
          onChange={(f) => onUpdateMetadata({ ai_features: f })}
        />
      </Td>
      <Td>
        <div className="flex items-center gap-1">
          <button
            onClick={onDuplicate}
            className="rounded p-1 text-gray-400 hover:bg-gray-800 hover:text-white"
            title="Duplicar"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="rounded p-1 text-gray-400 hover:bg-red-500/20 hover:text-red-400"
            title="Eliminar"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
        {hasError && (
          <p className="mt-1 text-[10px] text-amber-400" title={errors.join('\n')}>
            {errors.length} error{errors.length === 1 ? '' : 'es'}
          </p>
        )}
      </Td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Helper cells
// ---------------------------------------------------------------------------

function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <th className={cn('px-2 py-2 text-left font-medium', className)}>{children}</th>;
}
function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={cn('align-top px-2 py-2', className)}>{children}</td>;
}

function CellInput({
  value,
  onChange,
  placeholder,
  invalid,
  mono,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  invalid?: boolean;
  mono?: boolean;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(
        'w-full rounded border bg-[#0a0a0a] px-2 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none',
        invalid ? 'border-red-500/40 focus:border-red-500' : 'border-gray-800 focus:border-brand-accent',
        mono && 'font-mono text-[11px]',
      )}
    />
  );
}

function CellTextarea({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={2}
      className="w-full resize-y rounded border border-gray-800 bg-[#0a0a0a] px-2 py-1.5 text-xs text-white placeholder-gray-600 focus:border-brand-accent focus:outline-none"
    />
  );
}

function MultiValueCell({
  values,
  onChange,
  max,
  maxLen,
  placeholder,
}: {
  values: string[];
  onChange: (next: string[]) => void;
  max: number;
  maxLen?: number;
  placeholder?: string;
}) {
  const safeValues = values.length === 0 ? [''] : values;
  const updateAt = (idx: number, v: string) => {
    const next = [...safeValues];
    next[idx] = maxLen ? v.slice(0, maxLen) : v;
    onChange(next.filter((s, i) => i === 0 || s !== ''));
  };
  const remove = (idx: number) => onChange(safeValues.filter((_, i) => i !== idx));
  const add = () => {
    if (safeValues.length >= max) return;
    onChange([...safeValues, '']);
  };
  return (
    <div className="space-y-1">
      {safeValues.map((v, i) => (
        <div key={i} className="flex items-center gap-1">
          <input
            value={v}
            onChange={(e) => updateAt(i, e.target.value)}
            placeholder={placeholder}
            className="flex-1 rounded border border-gray-800 bg-[#0a0a0a] px-2 py-1.5 text-xs text-white placeholder-gray-600 focus:border-brand-accent focus:outline-none"
            maxLength={maxLen}
          />
          {safeValues.length > 1 && (
            <button onClick={() => remove(i)} className="text-gray-500 hover:text-red-400">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      ))}
      {safeValues.length < max && (
        <button
          onClick={add}
          className="text-[10px] text-brand-accent hover:underline"
        >
          + variante
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Campaign / AdSet cells
// ---------------------------------------------------------------------------

function defaultNewCampaignSpec(): NewCampaignSpec {
  return { name: '', objective: 'OUTCOME_SALES' };
}
function defaultNewAdSetSpec(): NewAdSetSpec {
  return {
    name: '',
    daily_budget_cents: 2000,
    countries: ['US'],
    age_min: 18,
    age_max: 65,
  };
}

function CampaignCell({
  value,
  onChange,
  campaigns,
}: {
  value: CampaignTarget;
  onChange: (c: CampaignTarget) => void;
  campaigns: ListCampaignsResponse['campaigns'];
}) {
  const [open, setOpen] = useState(false);
  const label =
    value.kind === 'existing'
      ? campaigns.find((c) => c.id === value.id)?.name || value.name || `#${value.id.slice(-6)}`
      : value.spec.name || 'Nueva campaña…';
  const isNew = value.kind === 'new';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'flex w-full items-center justify-between rounded border bg-[#0a0a0a] px-2 py-1.5 text-left text-xs',
            isNew ? 'border-brand-accent/40 text-brand-accent' : 'border-gray-800 text-white',
            'hover:border-brand-accent/60',
          )}
        >
          <span className="truncate">
            {isNew && <Sparkles className="mr-1 inline h-3 w-3" />}
            {label}
          </span>
          <ChevronDown className="h-3 w-3 shrink-0 text-gray-500" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 border-gray-800 bg-[#141414] p-2 text-white">
        <div className="space-y-2">
          <div className="text-[10px] uppercase text-gray-500">Existentes</div>
          <div className="max-h-48 overflow-y-auto rounded border border-gray-800">
            {campaigns.length === 0 ? (
              <p className="p-3 text-center text-xs text-gray-500">No hay campañas en la cuenta.</p>
            ) : (
              campaigns.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    onChange({ kind: 'existing', id: c.id, name: c.name });
                    setOpen(false);
                  }}
                  className={cn(
                    'flex w-full items-center justify-between border-b border-gray-800 px-2 py-1.5 text-xs last:border-b-0 hover:bg-[#0a0a0a]',
                    value.kind === 'existing' && value.id === c.id && 'bg-brand-accent/10',
                  )}
                >
                  <span className="truncate">{c.name}</span>
                  <span className="ml-2 shrink-0 text-[10px] text-gray-500">{c.status}</span>
                </button>
              ))
            )}
          </div>
          <div className="border-t border-gray-800 pt-2">
            <NewCampaignForm
              initial={value.kind === 'new' ? value.spec : defaultNewCampaignSpec()}
              onApply={(spec) => {
                onChange({ kind: 'new', spec });
                setOpen(false);
              }}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function NewCampaignForm({
  initial,
  onApply,
}: {
  initial: NewCampaignSpec;
  onApply: (spec: NewCampaignSpec) => void;
}) {
  const [spec, setSpec] = useState<NewCampaignSpec>(initial);
  return (
    <div className="space-y-2">
      <div className="text-[10px] uppercase text-gray-500">Nueva campaña</div>
      <input
        value={spec.name}
        onChange={(e) => setSpec({ ...spec, name: e.target.value })}
        placeholder="Nombre"
        className="w-full rounded border border-gray-800 bg-[#0a0a0a] px-2 py-1.5 text-xs text-white"
      />
      <Select
        value={spec.objective}
        onValueChange={(v) => setSpec({ ...spec, objective: v as CampaignObjective })}
      >
        <SelectTrigger className="h-8 border-gray-800 bg-[#0a0a0a] text-xs text-white">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="border-gray-800 bg-[#141414] text-white">
          {OBJECTIVES.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button size="sm" className="w-full" onClick={() => onApply(spec)} disabled={!spec.name.trim()}>
        Usar nueva campaña
      </Button>
    </div>
  );
}

function AdSetCell({
  value,
  campaign,
  allAdsets,
  onChange,
}: {
  value: AdSetTarget;
  campaign: CampaignTarget;
  allAdsets: ListAdSetsResponse['adsets'];
  onChange: (a: AdSetTarget) => void;
}) {
  const [open, setOpen] = useState(false);
  const adsetsForCampaign = useMemo(() => {
    if (campaign.kind !== 'existing') return [];
    return allAdsets.filter((a) => a.campaign_id === campaign.id);
  }, [allAdsets, campaign]);

  const label =
    value.kind === 'existing'
      ? allAdsets.find((a) => a.id === value.id)?.name || value.name || `#${value.id.slice(-6)}`
      : value.spec.name || 'Nuevo ad set…';
  const isNew = value.kind === 'new';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'flex w-full items-center justify-between rounded border bg-[#0a0a0a] px-2 py-1.5 text-left text-xs',
            isNew ? 'border-brand-accent/40 text-brand-accent' : 'border-gray-800 text-white',
            'hover:border-brand-accent/60',
          )}
        >
          <span className="truncate">
            {isNew && <Sparkles className="mr-1 inline h-3 w-3" />}
            {label}
          </span>
          <ChevronDown className="h-3 w-3 shrink-0 text-gray-500" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-96 border-gray-800 bg-[#141414] p-2 text-white">
        <div className="space-y-2">
          <div className="text-[10px] uppercase text-gray-500">
            Existentes
            {campaign.kind === 'new' && (
              <span className="ml-2 text-amber-400">
                · La campaña es nueva, sólo puedes crear un ad set nuevo.
              </span>
            )}
          </div>
          {campaign.kind === 'existing' && (
            <div className="max-h-40 overflow-y-auto rounded border border-gray-800">
              {adsetsForCampaign.length === 0 ? (
                <p className="p-3 text-center text-xs text-gray-500">
                  Esta campaña no tiene ad sets, crea uno nuevo abajo.
                </p>
              ) : (
                adsetsForCampaign.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => {
                      onChange({ kind: 'existing', id: a.id, name: a.name });
                      setOpen(false);
                    }}
                    className={cn(
                      'flex w-full items-center justify-between border-b border-gray-800 px-2 py-1.5 text-xs last:border-b-0 hover:bg-[#0a0a0a]',
                      value.kind === 'existing' && value.id === a.id && 'bg-brand-accent/10',
                    )}
                  >
                    <span className="truncate">{a.name}</span>
                    <span className="ml-2 shrink-0 text-[10px] text-gray-500">{a.status}</span>
                  </button>
                ))
              )}
            </div>
          )}
          <div className="border-t border-gray-800 pt-2">
            <NewAdSetForm
              initial={value.kind === 'new' ? value.spec : defaultNewAdSetSpec()}
              onApply={(spec) => {
                onChange({ kind: 'new', spec });
                setOpen(false);
              }}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function NewAdSetForm({
  initial,
  onApply,
}: {
  initial: NewAdSetSpec;
  onApply: (spec: NewAdSetSpec) => void;
}) {
  const [spec, setSpec] = useState<NewAdSetSpec>(initial);
  return (
    <div className="space-y-2">
      <div className="text-[10px] uppercase text-gray-500">Nuevo ad set</div>
      <input
        value={spec.name}
        onChange={(e) => setSpec({ ...spec, name: e.target.value })}
        placeholder="Nombre"
        className="w-full rounded border border-gray-800 bg-[#0a0a0a] px-2 py-1.5 text-xs text-white"
      />
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] text-gray-500">Budget/día (USD)</label>
          <input
            type="number"
            min={1}
            step={1}
            value={(spec.daily_budget_cents / 100).toFixed(0)}
            onChange={(e) =>
              setSpec({ ...spec, daily_budget_cents: Math.round(Number(e.target.value) * 100) })
            }
            className="w-full rounded border border-gray-800 bg-[#0a0a0a] px-2 py-1.5 text-xs text-white"
          />
        </div>
        <div>
          <label className="block text-[10px] text-gray-500">País</label>
          <Select
            value={spec.countries[0] || 'US'}
            onValueChange={(v) => setSpec({ ...spec, countries: [v] })}
          >
            <SelectTrigger className="h-8 border-gray-800 bg-[#0a0a0a] text-xs text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-gray-800 bg-[#141414] text-white">
              {COUNTRY_OPTIONS.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="block text-[10px] text-gray-500">Edad min</label>
          <input
            type="number"
            min={13}
            max={65}
            value={spec.age_min}
            onChange={(e) => setSpec({ ...spec, age_min: Number(e.target.value) })}
            className="w-full rounded border border-gray-800 bg-[#0a0a0a] px-2 py-1.5 text-xs text-white"
          />
        </div>
        <div>
          <label className="block text-[10px] text-gray-500">Edad max</label>
          <input
            type="number"
            min={13}
            max={65}
            value={spec.age_max}
            onChange={(e) => setSpec({ ...spec, age_max: Number(e.target.value) })}
            className="w-full rounded border border-gray-800 bg-[#0a0a0a] px-2 py-1.5 text-xs text-white"
          />
        </div>
      </div>
      <Button size="sm" className="w-full" onClick={() => onApply(spec)} disabled={!spec.name.trim()}>
        Usar nuevo ad set
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Identity + AI features popovers
// ---------------------------------------------------------------------------

function IdentityPopover({
  metadata,
  defaultIdentity,
  onChange,
}: {
  metadata: MetaAdMetadata;
  defaultIdentity: AdRowIdentity;
  onChange: (p: Partial<MetaAdMetadata>) => void;
}) {
  const overridden = !!(metadata.page_id_override || metadata.instagram_actor_id_override);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'flex w-full items-center justify-between rounded border bg-[#0a0a0a] px-2 py-1.5 text-xs',
            overridden ? 'border-brand-accent/40 text-brand-accent' : 'border-gray-800 text-gray-300',
          )}
        >
          {overridden ? 'Custom' : 'Default'}
          <Settings className="h-3 w-3 text-gray-500" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 border-gray-800 bg-[#141414] text-white">
        <div className="space-y-2 text-xs">
          <p className="text-[10px] uppercase text-gray-500">Identidad por anuncio</p>
          <p className="text-[11px] text-gray-400">
            Por defecto se usa la página + IG conectados a la cuenta. Override para usar otra.
          </p>
          <div>
            <label className="block text-[10px] text-gray-500">Page ID</label>
            <input
              value={metadata.page_id_override || ''}
              onChange={(e) => onChange({ page_id_override: e.target.value || undefined })}
              placeholder={defaultIdentity.page_id || '—'}
              className="w-full rounded border border-gray-800 bg-[#0a0a0a] px-2 py-1.5 text-xs text-white"
            />
          </div>
          <div>
            <label className="block text-[10px] text-gray-500">Instagram Actor ID</label>
            <input
              value={metadata.instagram_actor_id_override || ''}
              onChange={(e) =>
                onChange({ instagram_actor_id_override: e.target.value || undefined })
              }
              placeholder={defaultIdentity.instagram_actor_id || '— (sólo Facebook)'}
              className="w-full rounded border border-gray-800 bg-[#0a0a0a] px-2 py-1.5 text-xs text-white"
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function AiFeaturesPopover({
  features,
  onChange,
}: {
  features?: MetaAiFeatures;
  onChange: (f: MetaAiFeatures) => void;
}) {
  const enabled = AI_FEATURE_LABELS.filter(({ key }) => features?.[key]).length;
  const total = AI_FEATURE_LABELS.length;
  const setAll = (val: boolean) => {
    const next: MetaAiFeatures = {};
    for (const { key } of AI_FEATURE_LABELS) next[key] = val;
    onChange(next);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'flex w-full items-center justify-between rounded border bg-[#0a0a0a] px-2 py-1.5 text-xs',
            enabled > 0 ? 'border-brand-accent/40 text-brand-accent' : 'border-gray-800 text-gray-300',
          )}
        >
          <span>
            <Sparkles className="mr-1 inline h-3 w-3" /> {enabled}/{total}
          </span>
          <ChevronDown className="h-3 w-3 text-gray-500" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 border-gray-800 bg-[#141414] text-white">
        <div className="mb-2 flex items-center justify-between text-xs">
          <p className="text-[10px] uppercase text-gray-500">Advantage+ Creative</p>
          <div className="flex gap-1">
            <button
              onClick={() => setAll(true)}
              className="rounded border border-brand-accent/40 px-1.5 py-0.5 text-[10px] text-brand-accent hover:bg-brand-accent/10"
            >
              Activar todo
            </button>
            <button
              onClick={() => setAll(false)}
              className="rounded border border-gray-700 px-1.5 py-0.5 text-[10px] text-gray-400 hover:bg-gray-800"
            >
              Apagar todo
            </button>
          </div>
        </div>
        <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
          {AI_FEATURE_LABELS.map(({ key, label, hint }) => {
            const isOn = !!features?.[key];
            return (
              <label
                key={key}
                className="flex cursor-pointer items-start gap-2 rounded p-1 hover:bg-[#0a0a0a]"
              >
                <input
                  type="checkbox"
                  checked={isOn}
                  onChange={(e) =>
                    onChange({ ...(features || {}), [key]: e.target.checked })
                  }
                  className="mt-0.5 h-3.5 w-3.5"
                />
                <div className="text-xs">
                  <div className="text-white">{label}</div>
                  <div className="text-[10px] text-gray-500">{hint}</div>
                </div>
              </label>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// Bulk edit menus
// ---------------------------------------------------------------------------

function BulkEditMenu({
  disabled,
  onApply,
  onApplyTarget,
  campaigns,
  adsets,
}: {
  disabled: boolean;
  onApply: (patch: Partial<MetaAdMetadata>) => void;
  onApplyTarget: (t: { campaign?: CampaignTarget; adset?: AdSetTarget }) => void;
  campaigns: ListCampaignsResponse['campaigns'];
  adsets: ListAdSetsResponse['adsets'];
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" disabled={disabled}>
          <Wand2 className="mr-1.5 h-3.5 w-3.5" /> Bulk Edit
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 border-gray-800 bg-[#141414] text-white">
        <p className="mb-2 text-[10px] uppercase text-gray-500">Aplicar campo a seleccionados</p>
        <div className="space-y-2">
          <BulkField label="Primary text" onApply={(v) => onApply({ primary_text: v })} multiline />
          <BulkField label="Headline" onApply={(v) => onApply({ headline: v, headlines: undefined })} />
          <BulkField label="Description" onApply={(v) => onApply({ description: v, descriptions: undefined })} />
          <BulkField label="Destination URL" onApply={(v) => onApply({ link_url: v })} />
          <BulkField label="Display URL" onApply={(v) => onApply({ display_url: v })} />
          <BulkField label="URL params" onApply={(v) => onApply({ url_params: v })} />
          <BulkSelect
            label="CTA"
            options={CTA_OPTIONS as readonly string[]}
            onApply={(v) => onApply({ cta: v })}
          />
          <BulkCampaignTarget
            campaigns={campaigns}
            onApply={(c) => onApplyTarget({ campaign: c })}
          />
          <BulkAdSetTarget
            adsets={adsets}
            onApply={(a) => onApplyTarget({ adset: a })}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

function BulkField({
  label,
  onApply,
  multiline,
}: {
  label: string;
  onApply: (v: string) => void;
  multiline?: boolean;
}) {
  const [val, setVal] = useState('');
  return (
    <div>
      <label className="block text-[10px] text-gray-500">{label}</label>
      <div className="flex gap-1">
        {multiline ? (
          <textarea
            value={val}
            onChange={(e) => setVal(e.target.value)}
            rows={2}
            className="flex-1 rounded border border-gray-800 bg-[#0a0a0a] px-2 py-1 text-xs text-white"
          />
        ) : (
          <input
            value={val}
            onChange={(e) => setVal(e.target.value)}
            className="flex-1 rounded border border-gray-800 bg-[#0a0a0a] px-2 py-1 text-xs text-white"
          />
        )}
        <button
          onClick={() => {
            onApply(val);
            setVal('');
          }}
          disabled={!val}
          className="rounded border border-brand-accent/40 bg-brand-accent/10 px-2 text-[10px] text-brand-accent hover:bg-brand-accent/20 disabled:opacity-40"
        >
          Aplicar
        </button>
      </div>
    </div>
  );
}

function BulkSelect({
  label,
  options,
  onApply,
}: {
  label: string;
  options: readonly string[];
  onApply: (v: string) => void;
}) {
  const [val, setVal] = useState(options[0]);
  return (
    <div>
      <label className="block text-[10px] text-gray-500">{label}</label>
      <div className="flex gap-1">
        <Select value={val} onValueChange={setVal}>
          <SelectTrigger className="h-8 flex-1 border-gray-800 bg-[#0a0a0a] text-xs text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="border-gray-800 bg-[#141414] text-white">
            {options.map((o) => (
              <SelectItem key={o} value={o}>
                {o.replace(/_/g, ' ')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <button
          onClick={() => onApply(val)}
          className="rounded border border-brand-accent/40 bg-brand-accent/10 px-2 text-[10px] text-brand-accent hover:bg-brand-accent/20"
        >
          Aplicar
        </button>
      </div>
    </div>
  );
}

function BulkCampaignTarget({
  campaigns,
  onApply,
}: {
  campaigns: ListCampaignsResponse['campaigns'];
  onApply: (c: CampaignTarget) => void;
}) {
  const [val, setVal] = useState<string>(campaigns[0]?.id ?? '');
  if (campaigns.length === 0) return null;
  return (
    <div>
      <label className="block text-[10px] text-gray-500">Mover a campaña existente</label>
      <div className="flex gap-1">
        <Select value={val} onValueChange={setVal}>
          <SelectTrigger className="h-8 flex-1 border-gray-800 bg-[#0a0a0a] text-xs text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="border-gray-800 bg-[#141414] text-white">
            {campaigns.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <button
          onClick={() => {
            const c = campaigns.find((x) => x.id === val);
            if (c) onApply({ kind: 'existing', id: c.id, name: c.name });
          }}
          className="rounded border border-brand-accent/40 bg-brand-accent/10 px-2 text-[10px] text-brand-accent hover:bg-brand-accent/20"
        >
          Aplicar
        </button>
      </div>
    </div>
  );
}

function BulkAdSetTarget({
  adsets,
  onApply,
}: {
  adsets: ListAdSetsResponse['adsets'];
  onApply: (a: AdSetTarget) => void;
}) {
  const [val, setVal] = useState<string>(adsets[0]?.id ?? '');
  if (adsets.length === 0) return null;
  return (
    <div>
      <label className="block text-[10px] text-gray-500">Mover a ad set existente</label>
      <div className="flex gap-1">
        <Select value={val} onValueChange={setVal}>
          <SelectTrigger className="h-8 flex-1 border-gray-800 bg-[#0a0a0a] text-xs text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="border-gray-800 bg-[#141414] text-white">
            {adsets.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <button
          onClick={() => {
            const a = adsets.find((x) => x.id === val);
            if (a) onApply({ kind: 'existing', id: a.id, name: a.name });
          }}
          className="rounded border border-brand-accent/40 bg-brand-accent/10 px-2 text-[10px] text-brand-accent hover:bg-brand-accent/20"
        >
          Aplicar
        </button>
      </div>
    </div>
  );
}

function BulkActionsMenu({
  disabled,
  onDuplicate,
  onDelete,
}: {
  disabled: boolean;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" disabled={disabled}>
          Acciones
          <ChevronDown className="ml-1 h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 border-gray-800 bg-[#141414] p-1 text-white">
        <button
          onClick={onDuplicate}
          className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-[#0a0a0a]"
        >
          <Copy className="h-3.5 w-3.5" /> Duplicar seleccionados
        </button>
        <button
          onClick={onDelete}
          className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs text-red-400 hover:bg-red-500/10"
        >
          <Trash2 className="h-3.5 w-3.5" /> Eliminar seleccionados
        </button>
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// Multi Bulk Edit Modal
// ---------------------------------------------------------------------------

interface MultiBulkProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCount: number;
  onApply: (patch: Partial<MetaAdMetadata>) => void;
  onApplyTarget: (t: { campaign?: CampaignTarget; adset?: AdSetTarget }) => void;
  campaigns: ListCampaignsResponse['campaigns'];
  adsets: ListAdSetsResponse['adsets'];
}

function MultiBulkEditModal({
  isOpen,
  onClose,
  selectedCount,
  onApply,
  onApplyTarget,
  campaigns,
  adsets,
}: MultiBulkProps) {
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  const [primaryText, setPrimaryText] = useState('');
  const [headline, setHeadline] = useState('');
  const [description, setDescription] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [displayUrl, setDisplayUrl] = useState('');
  const [urlParams, setUrlParams] = useState('');
  const [cta, setCta] = useState<string>('SHOP_NOW');
  const [aiFeatures, setAiFeatures] = useState<MetaAiFeatures>({});
  const [campaignId, setCampaignId] = useState<string>('');
  const [adsetId, setAdsetId] = useState<string>('');

  const apply = () => {
    const patch: Partial<MetaAdMetadata> = {};
    if (enabled.primary_text) patch.primary_text = primaryText;
    if (enabled.headline) patch.headline = headline;
    if (enabled.description) patch.description = description;
    if (enabled.link_url) patch.link_url = linkUrl;
    if (enabled.display_url) patch.display_url = displayUrl;
    if (enabled.url_params) patch.url_params = urlParams;
    if (enabled.cta) patch.cta = cta;
    if (enabled.ai_features) patch.ai_features = aiFeatures;
    if (Object.keys(patch).length > 0) onApply(patch);

    if (enabled.campaign && campaignId) {
      const c = campaigns.find((x) => x.id === campaignId);
      if (c) onApplyTarget({ campaign: { kind: 'existing', id: c.id, name: c.name } });
    }
    if (enabled.adset && adsetId) {
      const a = adsets.find((x) => x.id === adsetId);
      if (a) onApplyTarget({ adset: { kind: 'existing', id: a.id, name: a.name } });
    }
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Multi Bulk Edit">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold text-white">Multi Bulk Edit</h3>
        <p className="text-xs text-gray-400">
          Marca los campos a aplicar y rellénalos. Se aplicarán a {selectedCount} fila
          {selectedCount === 1 ? '' : 's'} seleccionada{selectedCount === 1 ? '' : 's'}.
        </p>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <MBField
          enabled={!!enabled.primary_text}
          onToggle={(v) => setEnabled({ ...enabled, primary_text: v })}
          label="Primary text"
        >
          <textarea
            value={primaryText}
            onChange={(e) => setPrimaryText(e.target.value)}
            rows={2}
            className="w-full rounded border border-gray-800 bg-[#0a0a0a] px-2 py-1.5 text-sm text-white"
          />
        </MBField>
        <MBField
          enabled={!!enabled.headline}
          onToggle={(v) => setEnabled({ ...enabled, headline: v })}
          label="Headline"
        >
          <input
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            maxLength={40}
            className="w-full rounded border border-gray-800 bg-[#0a0a0a] px-2 py-1.5 text-sm text-white"
          />
        </MBField>
        <MBField
          enabled={!!enabled.description}
          onToggle={(v) => setEnabled({ ...enabled, description: v })}
          label="Description"
        >
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded border border-gray-800 bg-[#0a0a0a] px-2 py-1.5 text-sm text-white"
          />
        </MBField>
        <MBField
          enabled={!!enabled.link_url}
          onToggle={(v) => setEnabled({ ...enabled, link_url: v })}
          label="Destination URL"
        >
          <input
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            className="w-full rounded border border-gray-800 bg-[#0a0a0a] px-2 py-1.5 text-sm text-white"
          />
        </MBField>
        <MBField
          enabled={!!enabled.display_url}
          onToggle={(v) => setEnabled({ ...enabled, display_url: v })}
          label="Display URL"
        >
          <input
            value={displayUrl}
            onChange={(e) => setDisplayUrl(e.target.value)}
            className="w-full rounded border border-gray-800 bg-[#0a0a0a] px-2 py-1.5 text-sm text-white"
          />
        </MBField>
        <MBField
          enabled={!!enabled.url_params}
          onToggle={(v) => setEnabled({ ...enabled, url_params: v })}
          label="URL params"
        >
          <input
            value={urlParams}
            onChange={(e) => setUrlParams(e.target.value)}
            className="w-full rounded border border-gray-800 bg-[#0a0a0a] px-2 py-1.5 text-sm text-white font-mono text-xs"
          />
        </MBField>
        <MBField
          enabled={!!enabled.cta}
          onToggle={(v) => setEnabled({ ...enabled, cta: v })}
          label="CTA"
        >
          <Select value={cta} onValueChange={setCta}>
            <SelectTrigger className="border-gray-800 bg-[#0a0a0a] text-sm text-white">
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
        </MBField>
        {campaigns.length > 0 && (
          <MBField
            enabled={!!enabled.campaign}
            onToggle={(v) => setEnabled({ ...enabled, campaign: v })}
            label="Mover a campaña"
          >
            <Select value={campaignId} onValueChange={setCampaignId}>
              <SelectTrigger className="border-gray-800 bg-[#0a0a0a] text-sm text-white">
                <SelectValue placeholder="Selecciona…" />
              </SelectTrigger>
              <SelectContent className="border-gray-800 bg-[#141414] text-white">
                {campaigns.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </MBField>
        )}
        {adsets.length > 0 && (
          <MBField
            enabled={!!enabled.adset}
            onToggle={(v) => setEnabled({ ...enabled, adset: v })}
            label="Mover a ad set"
          >
            <Select value={adsetId} onValueChange={setAdsetId}>
              <SelectTrigger className="border-gray-800 bg-[#0a0a0a] text-sm text-white">
                <SelectValue placeholder="Selecciona…" />
              </SelectTrigger>
              <SelectContent className="border-gray-800 bg-[#141414] text-white">
                {adsets.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </MBField>
        )}
        <MBField
          enabled={!!enabled.ai_features}
          onToggle={(v) => setEnabled({ ...enabled, ai_features: v })}
          label="IA features (Advantage+ Creative)"
        >
          <div className="grid grid-cols-2 gap-1 rounded border border-gray-800 bg-[#0a0a0a] p-2">
            {AI_FEATURE_LABELS.map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 text-xs text-white">
                <input
                  type="checkbox"
                  checked={!!aiFeatures[key]}
                  onChange={(e) => setAiFeatures({ ...aiFeatures, [key]: e.target.checked })}
                  className="h-3 w-3"
                />
                {label}
              </label>
            ))}
          </div>
        </MBField>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button onClick={apply}>Aplicar a {selectedCount}</Button>
      </div>
    </Modal>
  );
}

function MBField({
  enabled,
  onToggle,
  label,
  children,
}: {
  enabled: boolean;
  onToggle: (v: boolean) => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('rounded border border-gray-800 bg-black/30 p-2', enabled && 'border-brand-accent/40')}>
      <label className="mb-1 flex items-center gap-2 text-xs text-white">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onToggle(e.target.checked)}
          className="h-3.5 w-3.5"
        />
        {label}
      </label>
      <div className={cn(!enabled && 'opacity-50 pointer-events-none')}>{children}</div>
    </div>
  );
}
