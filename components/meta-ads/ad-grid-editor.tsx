'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, Copy, Plus, Settings, Trash2, Wand2, X } from 'lucide-react';
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
  AdSetTarget,
  CampaignTarget,
  ListAdSetsResponse,
  ListCampaignsResponse,
  ListPagesResponse,
  MetaAdMetadata,
} from '@/types/meta';

const VIDEO_TYPES = new Set(['ugc', 'face_swap', 'clips', 'mejorar_calidad_video']);

const CTA_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'SHOP_NOW', label: 'Comprar ahora' },
  { value: 'LEARN_MORE', label: 'Más información' },
  { value: 'SIGN_UP', label: 'Registrarse' },
  { value: 'GET_OFFER', label: 'Obtener oferta' },
  { value: 'BOOK_TRAVEL', label: 'Reservar' },
  { value: 'DOWNLOAD', label: 'Descargar' },
  { value: 'CONTACT_US', label: 'Contactar' },
  { value: 'SUBSCRIBE', label: 'Suscribirse' },
  { value: 'WATCH_MORE', label: 'Ver más' },
  { value: 'APPLY_NOW', label: 'Aplicar ahora' },
  { value: 'ORDER_NOW', label: 'Ordenar ahora' },
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AdGridRow extends AdDraftRow {
  resultUrl?: string;
  generationType?: string;
}

interface AdGridEditorProps {
  rows: AdGridRow[];
  onChange: (next: AdGridRow[]) => void;
  adAccountId: string;
  onImportAssets: () => void;
  /** Cuando true, todas las celdas se renderizan en modo lectura. */
  readOnly?: boolean;
}

export function makeEmptyRow(generationId: string, extras?: Partial<AdGridRow>): AdGridRow {
  return {
    rowId: crypto.randomUUID(),
    generationId,
    metadata: { cta: 'SHOP_NOW' },
    campaign: { id: '' },
    adset: { id: '' },
    ...extras,
  };
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AdGridEditor({
  rows,
  onChange,
  adAccountId,
  onImportAssets,
  readOnly = false,
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

  const pagesQuery = useQuery<ListPagesResponse>({
    queryKey: ['meta-pages-list'],
    queryFn: async () => {
      const res = await fetch('/api/meta/pages');
      if (!res.ok) throw new Error('No se pudieron cargar las páginas');
      return res.json();
    },
    staleTime: 60_000,
  });

  const allCampaigns = campaignsQuery.data?.campaigns ?? [];
  const allAdsets = adsetsQuery.data?.adsets ?? [];
  const pages = pagesQuery.data?.pages ?? [];
  const defaultPageId = pagesQuery.data?.default_page_id ?? null;

  // Auto-rellenar fila vacía con primera campaña + primer ad set existente.
  useEffect(() => {
    if (readOnly) return;
    if (!campaignsQuery.isSuccess || !adsetsQuery.isSuccess) return;
    if (allCampaigns.length === 0) return;
    let mutated = false;
    const next = rows.map((r) => {
      if (r.campaign.id && r.adset.id) return r;
      const camp = r.campaign.id
        ? allCampaigns.find((c) => c.id === r.campaign.id)
        : allCampaigns[0];
      if (!camp) return r;
      const adset = allAdsets.filter((a) => a.campaign_id === camp.id)[0];
      if (!adset) {
        mutated = true;
        return { ...r, campaign: { id: camp.id, name: camp.name } };
      }
      mutated = true;
      return {
        ...r,
        campaign: { id: camp.id, name: camp.name },
        adset: { id: adset.id, name: adset.name },
      };
    });
    if (mutated) onChange(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    readOnly,
    campaignsQuery.isSuccess,
    adsetsQuery.isSuccess,
    allCampaigns.length,
    allAdsets.length,
    rows.length,
  ]);

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
      metadata: { ...original.metadata, name: `${original.metadata.name || 'Anuncio'} (copia)` },
    };
    const next = [...rows];
    next.splice(idx + 1, 0, copy);
    onChange(next);
  };
  const deleteRow = (rowId: string) => {
    onChange(rows.filter((r) => r.rowId !== rowId));
  };

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
          metadata: { ...r.metadata, name: `${r.metadata.name || 'Anuncio'} (copia)` },
        });
      }
      onChange([...rows, ...copies]);
    } else {
      onChange(rows.filter((r) => !selected.has(r.rowId)));
      setSelected(new Set());
    }
  };

  const errorsByRow = useMemo(() => {
    const map = new Map<string, string[]>();
    if (readOnly) return map;
    for (const r of rows) {
      const errs: string[] = [];
      if (!r.metadata.link_url) errs.push('Falta URL destino');
      if (!r.metadata.headline && !(r.metadata.headlines && r.metadata.headlines.length))
        errs.push('Falta título');
      if (!r.campaign.id) errs.push('Falta campaña');
      if (!r.adset.id) errs.push('Falta conjunto');
      if (errs.length) map.set(r.rowId, errs);
    }
    return map;
  }, [rows, readOnly]);

  const noCampaigns = !readOnly && campaignsQuery.isSuccess && allCampaigns.length === 0;
  const noAdSets = !readOnly && adsetsQuery.isSuccess && allAdsets.length === 0;

  return (
    <div className="space-y-3">
      {!readOnly && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-800 bg-[#0a0a0a] p-3">
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={onImportAssets}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Importar assets
            </Button>
            <span className="text-xs text-gray-500">
              <span className="text-white">{rows.length}</span> anuncios ·{' '}
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
            <Button
              size="sm"
              variant="outline"
              onClick={() => setMultiBulkOpen(true)}
              disabled={selected.size === 0}
            >
              <Wand2 className="mr-1.5 h-3.5 w-3.5" /> Edición masiva
            </Button>
            <BulkActionsMenu
              disabled={selected.size === 0}
              onDuplicate={() => bulkAction('duplicate')}
              onDelete={() => bulkAction('delete')}
            />
          </div>
        </div>
      )}

      {(noCampaigns || noAdSets) && rows.length > 0 && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-300">
          {noCampaigns
            ? 'No tienes campañas en esta cuenta — créalas primero en Ads Manager y vuelve.'
            : 'Las campañas no tienen conjuntos — crea uno primero en Ads Manager y vuelve.'}
        </div>
      )}

      <div className="rvz-grid-scroll overflow-x-auto rounded-lg border border-gray-800 bg-[#0a0a0a]">
        {rows.length === 0 ? (
          <div className="flex min-h-[280px] items-center justify-center p-12 text-center">
            <div>
              <p className="text-sm text-gray-400">
                Aún no hay anuncios. Haz clic en{' '}
                <button
                  onClick={onImportAssets}
                  className="text-brand-accent hover:underline"
                >
                  Importar assets
                </button>{' '}
                para empezar.
              </p>
            </div>
          </div>
        ) : (
          <table className="min-w-[2000px] w-full text-xs">
            <thead className="sticky top-0 z-10 bg-[#141414] text-[10px] uppercase tracking-wide text-gray-400">
              <tr>
                <Th className="w-10">
                  {!readOnly && (
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      className="h-3.5 w-3.5"
                    />
                  )}
                </Th>
                <Th className="w-16">Asset</Th>
                <Th className="w-44">Nombre del anuncio</Th>
                <Th className="w-56">Campaña</Th>
                <Th className="w-56">Conjunto</Th>
                <Th className="w-80">Texto principal</Th>
                <Th className="w-64">Títulos</Th>
                <Th className="w-64">Descripciones</Th>
                <Th className="w-72">URL destino</Th>
                <Th className="w-44">URL visible</Th>
                <Th className="w-72">Parámetros URL</Th>
                <Th className="w-44">CTA</Th>
                <Th className="w-32">Identidad</Th>
                {!readOnly && <Th className="w-20">Acciones</Th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
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
                  campaigns={allCampaigns}
                  adsets={allAdsets}
                  pages={pages}
                  defaultPageId={defaultPageId}
                  errors={errorsByRow.get(row.rowId) || []}
                  readOnly={readOnly}
                />
              ))}
            </tbody>
          </table>
        )}
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
        pages={pages}
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
  campaigns: ListCampaignsResponse['campaigns'];
  adsets: ListAdSetsResponse['adsets'];
  pages: ListPagesResponse['pages'];
  defaultPageId: string | null;
  errors: string[];
  readOnly: boolean;
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
  campaigns,
  adsets,
  pages,
  defaultPageId,
  errors,
  readOnly,
}: RowEditorProps) {
  const isVideo = row.generationType
    ? VIDEO_TYPES.has(row.generationType) || row.generationType.includes('video')
    : false;
  const meta = row.metadata;
  const hasError = errors.length > 0;

  // Para multi-variante: lista canónica desde array si existe, fallback al campo singular.
  const primaryTexts = useMemo(
    () =>
      meta.primary_texts && meta.primary_texts.length > 0
        ? meta.primary_texts
        : meta.primary_text
          ? [meta.primary_text]
          : [],
    [meta.primary_text, meta.primary_texts],
  );
  const headlines = useMemo(
    () =>
      meta.headlines && meta.headlines.length > 0
        ? meta.headlines
        : meta.headline
          ? [meta.headline]
          : [],
    [meta.headline, meta.headlines],
  );
  const descriptions = useMemo(
    () =>
      meta.descriptions && meta.descriptions.length > 0
        ? meta.descriptions
        : meta.description
          ? [meta.description]
          : [],
    [meta.description, meta.descriptions],
  );

  return (
    <tr
      className={cn(
        'border-t border-gray-800',
        isSelected ? 'bg-brand-accent/5' : 'hover:bg-[#0d0d0d]',
        hasError && 'bg-amber-500/[0.03]',
      )}
    >
      <Td>
        {!readOnly && (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            className="h-3.5 w-3.5"
          />
        )}
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
          readOnly={readOnly}
        />
      </Td>
      <Td>
        <CampaignCell
          value={row.campaign}
          campaigns={campaigns}
          readOnly={readOnly}
          onChange={(c) => {
            const currentAdset = row.adset;
            let adsetParent: string | undefined;
            if (currentAdset.id) {
              adsetParent = adsets.find((a) => a.id === currentAdset.id)?.campaign_id;
            }
            const shouldReset = !!currentAdset.id && adsetParent !== c.id;
            onUpdateRow({
              campaign: c,
              ...(shouldReset ? { adset: { id: '' } } : {}),
            });
          }}
        />
      </Td>
      <Td>
        <AdSetCell
          value={row.adset}
          campaign={row.campaign}
          allAdsets={adsets}
          readOnly={readOnly}
          onChange={(a) => onUpdateRow({ adset: a })}
        />
      </Td>
      <Td>
        <MultiTextCell
          values={primaryTexts}
          onChange={(vs) =>
            onUpdateMetadata({
              primary_texts: vs.length > 1 ? vs : undefined,
              primary_text: vs[0] || undefined,
            })
          }
          max={5}
          multiline
          placeholder="Texto principal del anuncio"
          variantLabel="texto"
          readOnly={readOnly}
        />
      </Td>
      <Td>
        <MultiTextCell
          values={headlines}
          onChange={(vs) =>
            onUpdateMetadata({
              headlines: vs.length > 1 ? vs : undefined,
              headline: vs[0] || undefined,
            })
          }
          max={5}
          maxLen={40}
          placeholder="Título (≤40)"
          variantLabel="título"
          readOnly={readOnly}
        />
      </Td>
      <Td>
        <MultiTextCell
          values={descriptions}
          onChange={(vs) =>
            onUpdateMetadata({
              descriptions: vs.length > 1 ? vs : undefined,
              description: vs[0] || undefined,
            })
          }
          max={5}
          placeholder="Descripción"
          variantLabel="descripción"
          readOnly={readOnly}
        />
      </Td>
      <Td>
        <CellInput
          value={meta.link_url || ''}
          onChange={(v) => onUpdateMetadata({ link_url: v })}
          placeholder="https://shop.example.com/producto"
          invalid={!readOnly && !meta.link_url}
          readOnly={readOnly}
        />
      </Td>
      <Td>
        <CellInput
          value={meta.display_url || ''}
          onChange={(v) => onUpdateMetadata({ display_url: v })}
          placeholder="shop.example.com"
          readOnly={readOnly}
        />
      </Td>
      <Td>
        <CellInput
          value={meta.url_params || ''}
          onChange={(v) => onUpdateMetadata({ url_params: v })}
          placeholder="utm_source=meta&utm_campaign={{campaign.name}}"
          mono
          readOnly={readOnly}
        />
      </Td>
      <Td>
        {readOnly ? (
          <div className="rounded border border-gray-800 bg-[#0a0a0a] px-2 py-1.5 text-xs text-gray-300">
            {CTA_OPTIONS.find((c) => c.value === (meta.cta || 'SHOP_NOW'))?.label || meta.cta}
          </div>
        ) : (
          <Select
            value={meta.cta || 'SHOP_NOW'}
            onValueChange={(v) => onUpdateMetadata({ cta: v })}
          >
            <SelectTrigger className="h-8 border-gray-800 bg-[#0a0a0a] text-xs text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-gray-800 bg-[#141414] text-white">
              {CTA_OPTIONS.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </Td>
      <Td>
        <IdentityCell
          metadata={meta}
          pages={pages}
          defaultPageId={defaultPageId}
          readOnly={readOnly}
          onChange={(p) => onUpdateMetadata(p)}
        />
      </Td>
      {!readOnly && (
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
      )}
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Generic helper cells
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
  readOnly,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  invalid?: boolean;
  mono?: boolean;
  readOnly?: boolean;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      readOnly={readOnly}
      placeholder={placeholder}
      className={cn(
        'w-full rounded border bg-[#0a0a0a] px-2 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none',
        invalid
          ? 'border-red-500/40 focus:border-red-500'
          : 'border-gray-800 focus:border-brand-accent',
        mono && 'font-mono text-[11px]',
        readOnly && 'cursor-default opacity-90',
      )}
    />
  );
}

/**
 * Celda multi-variante unificada para texto principal / títulos / descripciones.
 * Apila las variantes con índice numerado, soporta multilinea opcional, y el
 * botón "+ variante (n/max)" sólo aparece debajo (no doble).
 */
function MultiTextCell({
  values,
  onChange,
  max,
  maxLen,
  placeholder,
  multiline,
  variantLabel,
  readOnly,
}: {
  values: string[];
  onChange: (next: string[]) => void;
  max: number;
  maxLen?: number;
  placeholder?: string;
  multiline?: boolean;
  variantLabel: string;
  readOnly?: boolean;
}) {
  const safeValues = values.length === 0 ? [''] : values;

  const updateAt = (idx: number, v: string) => {
    const next = [...safeValues];
    next[idx] = maxLen ? v.slice(0, maxLen) : v;
    // No filtramos vacíos: respetamos lo que el usuario teclea.
    onChange(next);
  };
  const remove = (idx: number) => {
    if (safeValues.length === 1) {
      onChange([]);
      return;
    }
    onChange(safeValues.filter((_, i) => i !== idx));
  };
  const add = () => {
    if (safeValues.length >= max) return;
    onChange([...safeValues, '']);
  };

  return (
    <div className="space-y-1.5">
      {safeValues.map((v, i) => (
        <div key={i} className="flex items-start gap-1.5">
          <span className="mt-1.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded bg-gray-800 text-[9px] font-medium text-gray-400">
            {i + 1}
          </span>
          {multiline ? (
            <textarea
              value={v}
              onChange={(e) => updateAt(i, e.target.value)}
              readOnly={readOnly}
              placeholder={placeholder}
              rows={2}
              maxLength={maxLen}
              className={cn(
                'flex-1 resize-y rounded border border-gray-800 bg-[#0a0a0a] px-2 py-1.5 text-xs text-white placeholder-gray-600 focus:border-brand-accent focus:outline-none',
                readOnly && 'cursor-default opacity-90',
              )}
            />
          ) : (
            <input
              value={v}
              onChange={(e) => updateAt(i, e.target.value)}
              readOnly={readOnly}
              placeholder={placeholder}
              maxLength={maxLen}
              className={cn(
                'flex-1 rounded border border-gray-800 bg-[#0a0a0a] px-2 py-1.5 text-xs text-white placeholder-gray-600 focus:border-brand-accent focus:outline-none',
                readOnly && 'cursor-default opacity-90',
              )}
            />
          )}
          {!readOnly && safeValues.length > 1 && (
            <button
              onClick={() => remove(i)}
              className="mt-1.5 text-gray-500 hover:text-red-400"
              title="Quitar variante"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      ))}
      {!readOnly && safeValues.length < max && (
        <button
          onClick={add}
          className="ml-5 text-[10px] text-brand-accent hover:underline"
        >
          + variante de {variantLabel} ({safeValues.length}/{max})
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Campaign / AdSet cells (only existing)
// ---------------------------------------------------------------------------

function CampaignCell({
  value,
  campaigns,
  onChange,
  readOnly,
}: {
  value: CampaignTarget;
  campaigns: ListCampaignsResponse['campaigns'];
  onChange: (c: CampaignTarget) => void;
  readOnly?: boolean;
}) {
  if (readOnly) {
    return (
      <div className="rounded border border-gray-800 bg-[#0a0a0a] px-2 py-1.5 text-xs text-gray-300">
        {value.name || `#${value.id?.slice(-6) || '—'}`}
      </div>
    );
  }
  if (campaigns.length === 0) {
    return (
      <div className="rounded border border-amber-500/30 bg-amber-500/5 px-2 py-1.5 text-[11px] text-amber-300">
        Sin campañas — créalas en Ads Manager
      </div>
    );
  }
  return (
    <Select
      value={value.id || ''}
      onValueChange={(v) => {
        const c = campaigns.find((x) => x.id === v);
        if (c) onChange({ id: c.id, name: c.name });
      }}
    >
      <SelectTrigger className="h-8 border-gray-800 bg-[#0a0a0a] text-xs text-white">
        <SelectValue placeholder="Selecciona…" />
      </SelectTrigger>
      <SelectContent className="border-gray-800 bg-[#141414] text-white">
        {campaigns.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            <div className="flex items-center gap-2">
              <span className="truncate">{c.name}</span>
              {c.status && <span className="text-[10px] text-gray-500">{c.status}</span>}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function AdSetCell({
  value,
  campaign,
  allAdsets,
  onChange,
  readOnly,
}: {
  value: AdSetTarget;
  campaign: CampaignTarget;
  allAdsets: ListAdSetsResponse['adsets'];
  onChange: (a: AdSetTarget) => void;
  readOnly?: boolean;
}) {
  if (readOnly) {
    return (
      <div className="rounded border border-gray-800 bg-[#0a0a0a] px-2 py-1.5 text-xs text-gray-300">
        {value.name || `#${value.id?.slice(-6) || '—'}`}
      </div>
    );
  }
  const adsetsForCampaign = useMemo(
    () => (campaign.id ? allAdsets.filter((a) => a.campaign_id === campaign.id) : []),
    [allAdsets, campaign.id],
  );

  if (!campaign.id) {
    return (
      <div className="rounded border border-gray-800 bg-[#0a0a0a] px-2 py-1.5 text-[11px] text-gray-500">
        Selecciona una campaña
      </div>
    );
  }
  if (adsetsForCampaign.length === 0) {
    return (
      <div className="rounded border border-amber-500/30 bg-amber-500/5 px-2 py-1.5 text-[11px] text-amber-300">
        Esta campaña no tiene conjuntos
      </div>
    );
  }
  return (
    <Select
      value={value.id || ''}
      onValueChange={(v) => {
        const a = adsetsForCampaign.find((x) => x.id === v);
        if (a) onChange({ id: a.id, name: a.name });
      }}
    >
      <SelectTrigger className="h-8 border-gray-800 bg-[#0a0a0a] text-xs text-white">
        <SelectValue placeholder="Selecciona…" />
      </SelectTrigger>
      <SelectContent className="border-gray-800 bg-[#141414] text-white">
        {adsetsForCampaign.map((a) => (
          <SelectItem key={a.id} value={a.id}>
            <div className="flex items-center gap-2">
              <span className="truncate">{a.name}</span>
              {a.status && <span className="text-[10px] text-gray-500">{a.status}</span>}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ---------------------------------------------------------------------------
// Identity cell
// ---------------------------------------------------------------------------

function IdentityCell({
  metadata,
  pages,
  defaultPageId,
  onChange,
  readOnly,
}: {
  metadata: MetaAdMetadata;
  pages: ListPagesResponse['pages'];
  defaultPageId: string | null;
  onChange: (p: Partial<MetaAdMetadata>) => void;
  readOnly?: boolean;
}) {
  const overridePageId = metadata.page_id_override;
  const effectivePageId = overridePageId || defaultPageId;
  const effectivePage = pages.find((p) => p.id === effectivePageId);
  const isOverride = !!overridePageId;

  if (readOnly) {
    return (
      <div className="rounded border border-gray-800 bg-[#0a0a0a] px-2 py-1.5 text-xs text-gray-300">
        {effectivePage ? effectivePage.name : 'Default'}
      </div>
    );
  }

  const handleSelect = (pageId: string) => {
    if (pageId === '__default__') {
      onChange({ page_id_override: undefined, instagram_actor_id_override: undefined });
      return;
    }
    const page = pages.find((p) => p.id === pageId);
    if (!page) return;
    onChange({
      page_id_override: page.id,
      instagram_actor_id_override: page.instagram?.id,
    });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'flex w-full items-center justify-between rounded border bg-[#0a0a0a] px-2 py-1.5 text-xs',
            isOverride
              ? 'border-brand-accent/40 text-brand-accent'
              : 'border-gray-800 text-gray-300',
          )}
          title={effectivePage ? effectivePage.name : 'Sin página'}
        >
          <span className="truncate">{effectivePage ? effectivePage.name : 'Default'}</span>
          <Settings className="h-3 w-3 shrink-0 text-gray-500" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 border-gray-800 bg-[#141414] text-white">
        <p className="mb-2 text-[10px] uppercase text-gray-500">Identidad del anuncio</p>
        <div className="max-h-64 overflow-y-auto rounded border border-gray-800">
          <button
            onClick={() => handleSelect('__default__')}
            className={cn(
              'flex w-full items-center justify-between border-b border-gray-800 px-2 py-2 text-xs hover:bg-[#0a0a0a]',
              !isOverride && 'bg-brand-accent/10',
            )}
          >
            <span>Default ({pages.find((p) => p.id === defaultPageId)?.name || '—'})</span>
            <span className="text-[10px] text-gray-500">cuenta</span>
          </button>
          {pages.length === 0 ? (
            <p className="p-3 text-center text-xs text-gray-500">Cargando páginas…</p>
          ) : (
            pages.map((p) => (
              <button
                key={p.id}
                onClick={() => handleSelect(p.id)}
                className={cn(
                  'flex w-full items-center justify-between border-b border-gray-800 px-2 py-2 text-xs last:border-b-0 hover:bg-[#0a0a0a]',
                  overridePageId === p.id && 'bg-brand-accent/10',
                )}
              >
                <span className="flex items-center gap-2 truncate">
                  {p.picture_url && (
                    <img src={p.picture_url} alt="" className="h-5 w-5 rounded-full" />
                  )}
                  <span className="truncate">{p.name}</span>
                </span>
                {p.instagram ? (
                  <span className="text-[10px] text-brand-accent">@{p.instagram.username}</span>
                ) : (
                  <span className="text-[10px] text-gray-600">solo FB</span>
                )}
              </button>
            ))
          )}
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
          <Wand2 className="mr-1.5 h-3.5 w-3.5" /> Aplicar a seleccionados
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 border-gray-800 bg-[#141414] text-white">
        <p className="mb-2 text-[10px] uppercase text-gray-500">
          Aplicar campo a las filas seleccionadas
        </p>
        <div className="space-y-3">
          <BulkMultiTextField
            label="Texto principal"
            multiline
            variantLabel="texto"
            onApply={(vs) =>
              onApply({
                primary_texts: vs.length > 1 ? vs : undefined,
                primary_text: vs[0] || undefined,
              })
            }
          />
          <BulkMultiTextField
            label="Títulos"
            maxLen={40}
            variantLabel="título"
            onApply={(vs) =>
              onApply({
                headlines: vs.length > 1 ? vs : undefined,
                headline: vs[0] || undefined,
              })
            }
          />
          <BulkMultiTextField
            label="Descripciones"
            variantLabel="descripción"
            onApply={(vs) =>
              onApply({
                descriptions: vs.length > 1 ? vs : undefined,
                description: vs[0] || undefined,
              })
            }
          />
          <BulkField label="URL destino" onApply={(v) => onApply({ link_url: v })} />
          <BulkField label="URL visible" onApply={(v) => onApply({ display_url: v })} />
          <BulkField label="Parámetros URL" onApply={(v) => onApply({ url_params: v })} />
          <BulkSelect
            label="CTA"
            options={CTA_OPTIONS}
            onApply={(v) => onApply({ cta: v })}
          />
          <BulkCampaignTarget
            campaigns={campaigns}
            onApply={(c) => onApplyTarget({ campaign: c })}
          />
          <BulkAdSetTarget adsets={adsets} onApply={(a) => onApplyTarget({ adset: a })} />
        </div>
      </PopoverContent>
    </Popover>
  );
}

function BulkMultiTextField({
  label,
  onApply,
  maxLen,
  multiline,
  variantLabel,
}: {
  label: string;
  onApply: (vs: string[]) => void;
  maxLen?: number;
  multiline?: boolean;
  variantLabel: string;
}) {
  const [vals, setVals] = useState<string[]>(['']);

  const update = (i: number, v: string) => {
    const next = [...vals];
    next[i] = maxLen ? v.slice(0, maxLen) : v;
    setVals(next);
  };
  const add = () => {
    if (vals.length >= 5) return;
    setVals([...vals, '']);
  };
  const remove = (i: number) => {
    if (vals.length === 1) {
      setVals(['']);
      return;
    }
    setVals(vals.filter((_, idx) => idx !== i));
  };
  const handleApply = () => {
    const cleaned = vals.map((v) => v.trim()).filter(Boolean);
    if (cleaned.length === 0) return;
    onApply(cleaned);
    setVals(['']);
  };
  const hasContent = vals.some((v) => v.trim());

  return (
    <div className="rounded border border-gray-800 bg-black/30 p-2">
      <div className="mb-1 flex items-center justify-between">
        <label className="text-[10px] uppercase text-gray-500">{label}</label>
        <button
          onClick={handleApply}
          disabled={!hasContent}
          className="rounded border border-brand-accent/40 bg-brand-accent/10 px-2 py-0.5 text-[10px] text-brand-accent hover:bg-brand-accent/20 disabled:opacity-40"
        >
          Aplicar
        </button>
      </div>
      <div className="space-y-1.5">
        {vals.map((v, i) => (
          <div key={i} className="flex items-start gap-1.5">
            <span className="mt-1.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded bg-gray-800 text-[9px] text-gray-400">
              {i + 1}
            </span>
            {multiline ? (
              <textarea
                value={v}
                onChange={(e) => update(i, e.target.value)}
                rows={2}
                className="flex-1 rounded border border-gray-800 bg-[#0a0a0a] px-2 py-1 text-xs text-white"
              />
            ) : (
              <input
                value={v}
                onChange={(e) => update(i, e.target.value)}
                maxLength={maxLen}
                className="flex-1 rounded border border-gray-800 bg-[#0a0a0a] px-2 py-1 text-xs text-white"
              />
            )}
            {vals.length > 1 && (
              <button
                onClick={() => remove(i)}
                className="mt-1.5 text-gray-500 hover:text-red-400"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}
      </div>
      {vals.length < 5 && (
        <button
          onClick={add}
          className="ml-5 mt-1 text-[10px] text-brand-accent hover:underline"
        >
          + variante de {variantLabel} ({vals.length}/5)
        </button>
      )}
    </div>
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
  options: Array<{ value: string; label: string }>;
  onApply: (v: string) => void;
}) {
  const [val, setVal] = useState(options[0].value);
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
              <SelectItem key={o.value} value={o.value}>
                {o.label}
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
      <label className="block text-[10px] text-gray-500">Mover a campaña</label>
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
            if (c) onApply({ id: c.id, name: c.name });
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
      <label className="block text-[10px] text-gray-500">Mover a conjunto</label>
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
            if (a) onApply({ id: a.id, name: a.name });
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
  pages: ListPagesResponse['pages'];
}

function MultiBulkEditModal({
  isOpen,
  onClose,
  selectedCount,
  onApply,
  onApplyTarget,
  campaigns,
  adsets,
  pages,
}: MultiBulkProps) {
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  const [primaryTexts, setPrimaryTexts] = useState<string[]>(['']);
  const [headlines, setHeadlines] = useState<string[]>(['']);
  const [descriptions, setDescriptions] = useState<string[]>(['']);
  const [linkUrl, setLinkUrl] = useState('');
  const [displayUrl, setDisplayUrl] = useState('');
  const [urlParams, setUrlParams] = useState('');
  const [cta, setCta] = useState<string>('SHOP_NOW');
  const [campaignId, setCampaignId] = useState<string>('');
  const [adsetId, setAdsetId] = useState<string>('');
  const [pageId, setPageId] = useState<string>('');

  const apply = () => {
    const patch: Partial<MetaAdMetadata> = {};
    if (enabled.primary_texts) {
      const cleaned = primaryTexts.map((s) => s.trim()).filter(Boolean);
      patch.primary_texts = cleaned.length > 1 ? cleaned : undefined;
      patch.primary_text = cleaned[0] || undefined;
    }
    if (enabled.headlines) {
      const cleaned = headlines.map((s) => s.trim()).filter(Boolean);
      patch.headlines = cleaned.length > 1 ? cleaned : undefined;
      patch.headline = cleaned[0] || undefined;
    }
    if (enabled.descriptions) {
      const cleaned = descriptions.map((s) => s.trim()).filter(Boolean);
      patch.descriptions = cleaned.length > 1 ? cleaned : undefined;
      patch.description = cleaned[0] || undefined;
    }
    if (enabled.link_url) patch.link_url = linkUrl;
    if (enabled.display_url) patch.display_url = displayUrl;
    if (enabled.url_params) patch.url_params = urlParams;
    if (enabled.cta) patch.cta = cta;
    if (enabled.identity && pageId) {
      const page = pages.find((p) => p.id === pageId);
      patch.page_id_override = page?.id;
      patch.instagram_actor_id_override = page?.instagram?.id;
    }
    if (Object.keys(patch).length > 0) onApply(patch);

    if (enabled.campaign && campaignId) {
      const c = campaigns.find((x) => x.id === campaignId);
      if (c) onApplyTarget({ campaign: { id: c.id, name: c.name } });
    }
    if (enabled.adset && adsetId) {
      const a = adsets.find((x) => x.id === adsetId);
      if (a) onApplyTarget({ adset: { id: a.id, name: a.name } });
    }
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="space-y-1">
        <h3 className="text-lg font-semibold text-white">Edición masiva</h3>
        <p className="text-xs text-gray-400">
          Marca los campos a aplicar y rellénalos. Se aplicarán a {selectedCount} fila
          {selectedCount === 1 ? '' : 's'} seleccionada{selectedCount === 1 ? '' : 's'}.
        </p>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <MBField
          enabled={!!enabled.primary_texts}
          onToggle={(v) => setEnabled({ ...enabled, primary_texts: v })}
          label="Texto principal (hasta 5 variantes)"
        >
          <ModalMultiText
            values={primaryTexts}
            onChange={setPrimaryTexts}
            multiline
            variantLabel="texto"
          />
        </MBField>
        <MBField
          enabled={!!enabled.headlines}
          onToggle={(v) => setEnabled({ ...enabled, headlines: v })}
          label="Títulos (hasta 5 variantes)"
        >
          <ModalMultiText
            values={headlines}
            onChange={setHeadlines}
            maxLen={40}
            variantLabel="título"
          />
        </MBField>
        <MBField
          enabled={!!enabled.descriptions}
          onToggle={(v) => setEnabled({ ...enabled, descriptions: v })}
          label="Descripciones (hasta 5 variantes)"
        >
          <ModalMultiText
            values={descriptions}
            onChange={setDescriptions}
            variantLabel="descripción"
          />
        </MBField>
        <MBField
          enabled={!!enabled.link_url}
          onToggle={(v) => setEnabled({ ...enabled, link_url: v })}
          label="URL destino"
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
          label="URL visible"
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
          label="Parámetros URL"
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
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </MBField>
        {pages.length > 0 && (
          <MBField
            enabled={!!enabled.identity}
            onToggle={(v) => setEnabled({ ...enabled, identity: v })}
            label="Identidad (Página + IG)"
          >
            <Select value={pageId} onValueChange={setPageId}>
              <SelectTrigger className="border-gray-800 bg-[#0a0a0a] text-sm text-white">
                <SelectValue placeholder="Selecciona…" />
              </SelectTrigger>
              <SelectContent className="border-gray-800 bg-[#141414] text-white">
                {pages.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                    {p.instagram ? ` · @${p.instagram.username}` : ' · solo FB'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </MBField>
        )}
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
            label="Mover a conjunto"
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

function ModalMultiText({
  values,
  onChange,
  maxLen,
  multiline,
  variantLabel,
}: {
  values: string[];
  onChange: (vs: string[]) => void;
  maxLen?: number;
  multiline?: boolean;
  variantLabel: string;
}) {
  const update = (i: number, v: string) => {
    const next = [...values];
    next[i] = maxLen ? v.slice(0, maxLen) : v;
    onChange(next);
  };
  const remove = (i: number) =>
    onChange(values.length === 1 ? [''] : values.filter((_, idx) => idx !== i));
  const add = () => {
    if (values.length >= 5) return;
    onChange([...values, '']);
  };
  return (
    <div className="space-y-1.5">
      {values.map((v, i) => (
        <div key={i} className="flex items-start gap-1.5">
          <span className="mt-1.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded bg-gray-800 text-[9px] text-gray-400">
            {i + 1}
          </span>
          {multiline ? (
            <textarea
              value={v}
              onChange={(e) => update(i, e.target.value)}
              rows={2}
              maxLength={maxLen}
              className="flex-1 rounded border border-gray-800 bg-[#0a0a0a] px-2 py-1.5 text-sm text-white"
            />
          ) : (
            <input
              value={v}
              onChange={(e) => update(i, e.target.value)}
              maxLength={maxLen}
              className="flex-1 rounded border border-gray-800 bg-[#0a0a0a] px-2 py-1.5 text-sm text-white"
            />
          )}
          {values.length > 1 && (
            <button
              onClick={() => remove(i)}
              className="mt-1.5 text-gray-500 hover:text-red-400"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      ))}
      {values.length < 5 && (
        <button
          onClick={add}
          className="ml-5 mt-1 text-[10px] text-brand-accent hover:underline"
        >
          + variante de {variantLabel} ({values.length}/5)
        </button>
      )}
    </div>
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
    <div
      className={cn(
        'rounded border border-gray-800 bg-black/30 p-2',
        enabled && 'border-brand-accent/40',
      )}
    >
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
