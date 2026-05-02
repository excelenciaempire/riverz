'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Save, Plus, Trash2, Star } from 'lucide-react';

type PricingRow = {
  id: string;
  mode: string;
  credits_cost: number;
  description: string | null;
  is_active: boolean;
  updated_at: string;
};

type KiePricingRow = {
  id: string;
  task_mode: string;
  provider: string;
  model_name: string;
  model_label: string;
  usd_cost: number | string;
  is_default: boolean;
  is_active: boolean;
  notes: string | null;
  updated_at: string;
};

type CurrencyConfig = {
  mode: 'credits' | 'usd';
  creditUsdRate: number;
};

const MODE_LABELS: Record<string, string> = {
  ugc: 'UGC Video',
  ugc_chat: 'UGC Chat',
  face_swap: 'Face Swap',
  clips: 'Clips',
  editar_foto_crear: 'Editar Foto · Crear',
  editar_foto_editar: 'Editar Foto · Editar',
  editar_foto_combinar: 'Editar Foto · Combinar',
  editar_foto_clonar: 'Editar Foto · Clonar',
  editar_foto_draw_edit: 'Editar Foto · Draw & Edit',
  mejorar_calidad_video: 'Mejorar Calidad Video',
  mejorar_calidad_imagen: 'Mejorar Calidad Imagen',
  static_ad_generation: 'Static Ad · Generación',
  static_ad_edit: 'Static Ad · Edición',
  static_ads_ideacion: 'Static Ad · Ideación',
};

function formatUsd(value: number) {
  if (!Number.isFinite(value)) return '—';
  if (value >= 1) return `$${value.toFixed(2)}`;
  if (value >= 0.01) return `$${value.toFixed(3)}`;
  return `$${value.toFixed(4)}`;
}

export function PricingConfig() {
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [rateDraft, setRateDraft] = useState<string | null>(null);
  const [kieDrafts, setKieDrafts] = useState<Record<string, string>>({});
  const [newRow, setNewRow] = useState<Record<string, { model_name: string; model_label: string; usd_cost: string }>>({});

  const { data: currency, isLoading: currencyLoading } = useQuery<CurrencyConfig>({
    queryKey: ['currency-config'],
    queryFn: async () => {
      const res = await fetch('/api/admin/currency-config');
      if (!res.ok) throw new Error('Failed to fetch currency config');
      return res.json();
    },
  });

  const { data: pricing, isLoading: pricingLoading } = useQuery<PricingRow[]>({
    queryKey: ['pricing-config'],
    queryFn: async () => {
      const res = await fetch('/api/admin/pricing');
      if (!res.ok) throw new Error('Failed to fetch pricing');
      const json = await res.json();
      return json.pricing || [];
    },
  });

  const { data: kiePricing, isLoading: kieLoading } = useQuery<KiePricingRow[]>({
    queryKey: ['kie-model-pricing'],
    queryFn: async () => {
      const res = await fetch('/api/admin/kie-pricing');
      if (!res.ok) throw new Error('Failed to fetch kie pricing');
      const json = await res.json();
      return (json.pricing || []).map((r: KiePricingRow) => ({ ...r, usd_cost: Number(r.usd_cost) }));
    },
  });

  const mode = currency?.mode || 'credits';
  const rate = currency?.creditUsdRate || 0.01;

  useEffect(() => {
    if (pricing) {
      const next: Record<string, string> = {};
      for (const row of pricing) {
        next[row.mode] =
          mode === 'usd' ? (row.credits_cost * rate).toFixed(2) : String(row.credits_cost);
      }
      setDrafts(next);
    }
  }, [pricing, mode, rate]);

  useEffect(() => {
    if (kiePricing) {
      const next: Record<string, string> = {};
      for (const row of kiePricing) next[row.id] = String(Number(row.usd_cost));
      setKieDrafts(next);
    }
  }, [kiePricing]);

  const setMode = useMutation({
    mutationFn: async (next: 'credits' | 'usd') => {
      const res = await fetch('/api/admin/currency-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: next }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Error');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currency-config'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveRate = useMutation({
    mutationFn: async (next: number) => {
      const res = await fetch('/api/admin/currency-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creditUsdRate: next }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Error');
    },
    onSuccess: () => {
      toast.success('Equivalencia actualizada');
      setRateDraft(null);
      queryClient.invalidateQueries({ queryKey: ['currency-config'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveCost = useMutation({
    mutationFn: async ({ mode, credits_cost }: { mode: string; credits_cost: number }) => {
      const res = await fetch('/api/admin/pricing', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, credits_cost }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to update pricing');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricing-config'] });
      toast.success('Precio actualizado');
    },
    onError: (e: Error) => toast.error(e.message || 'Error guardando precio'),
  });

  const updateKieRow = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await fetch('/api/admin/kie-pricing', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Error');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kie-model-pricing'] });
      toast.success('Costo Kie actualizado');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createKieRow = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await fetch('/api/admin/kie-pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Error');
      return res.json();
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['kie-model-pricing'] });
      const taskMode = (vars as { task_mode: string }).task_mode;
      setNewRow((s) => ({ ...s, [taskMode]: { model_name: '', model_label: '', usd_cost: '' } }));
      toast.success('Modelo agregado');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteKieRow = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/kie-pricing?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Error');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kie-model-pricing'] });
      toast.success('Modelo eliminado');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSaveCost = (m: string) => {
    const raw = drafts[m] ?? '';
    if (mode === 'usd') {
      const usd = parseFloat(raw);
      if (!Number.isFinite(usd) || usd < 0) {
        toast.error('Ingresa un USD válido (>= 0)');
        return;
      }
      saveCost.mutate({ mode: m, credits_cost: Math.round(usd / rate) });
      return;
    }
    const value = parseInt(raw);
    if (Number.isNaN(value) || value < 0) {
      toast.error('Ingresa un número válido (>= 0)');
      return;
    }
    saveCost.mutate({ mode: m, credits_cost: value });
  };

  const kieByTask = useMemo(() => {
    const map: Record<string, KiePricingRow[]> = {};
    for (const row of kiePricing || []) {
      (map[row.task_mode] ||= []).push(row);
    }
    return map;
  }, [kiePricing]);

  const isLoading = currencyLoading || pricingLoading || kieLoading;
  if (isLoading) {
    return (
      <div>
        <h2 className="text-2xl font-bold text-white">Configuración de Precios</h2>
        <p className="mt-4 text-gray-400">Cargando configuración…</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-white">Configuración de Precios</h2>
        <p className="mt-2 text-gray-400">
          Toda la economía de Riverz expresada en{' '}
          <span className="text-white">créditos</span> o{' '}
          <span className="text-white">dinero real (USD)</span>. Son equivalentes — el toggle sólo cambia
          cómo se visualizan los números.
        </p>
      </div>

      {/* Toggle moneda + rate */}
      <div className="rounded-2xl border border-gray-800 bg-[#141414] p-6">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <Label className="text-base font-semibold">Modo de visualización</Label>
            <p className="mt-1 text-xs text-gray-500">
              Cambia entre créditos y USD en toda la pestaña. Los datos guardados son los mismos.
            </p>
          </div>
          <div className="inline-flex rounded-lg border border-gray-800 bg-[#0a0a0a] p-1">
            {(['credits', 'usd'] as const).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setMode.mutate(opt)}
                disabled={setMode.isPending}
                className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
                  mode === opt
                    ? 'bg-brand-accent text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {opt === 'credits' ? 'Créditos' : 'USD'}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <Label>Equivalencia (1 crédito = X USD)</Label>
            <p className="mt-1 text-xs text-gray-500">
              Default 0.01 ⇒ 100 créditos = $1.00. Se aplica para convertir entre vistas.
            </p>
            <Input
              type="number"
              step="0.0001"
              min="0"
              value={rateDraft ?? String(rate)}
              onChange={(e) => setRateDraft(e.target.value)}
              className="mt-2 max-w-xs"
            />
          </div>
          <Button
            onClick={() => {
              const next = parseFloat(rateDraft ?? '');
              if (!Number.isFinite(next) || next <= 0) {
                toast.error('Ingresa un número > 0');
                return;
              }
              saveRate.mutate(next);
            }}
            disabled={rateDraft === null || rateDraft === String(rate) || saveRate.isPending}
            className="bg-brand-accent hover:bg-brand-accent/90"
          >
            <Save className="mr-2 h-4 w-4" /> Guardar equivalencia
          </Button>
        </div>
      </div>

      {/* Precio cobrado al usuario por cada modo */}
      <div>
        <h3 className="text-lg font-semibold text-white">Precio al usuario por generación</h3>
        <p className="mt-1 text-sm text-gray-400">
          Lo que el sistema descuenta del balance del usuario. Se guarda en{' '}
          <code className="text-brand-accent">pricing_config</code>.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {(pricing || []).map((row) => {
          const label = MODE_LABELS[row.mode] || row.mode;
          const draftValue =
            drafts[row.mode] ??
            (mode === 'usd' ? (row.credits_cost * rate).toFixed(2) : String(row.credits_cost));
          const parsed = parseFloat(draftValue) || 0;
          const dirty =
            mode === 'usd'
              ? Math.round(parsed / rate) !== row.credits_cost
              : Math.round(parsed) !== row.credits_cost;
          const kieCost = (kieByTask[row.mode] || []).find((m) => m.is_default)?.usd_cost;
          const kieCostNum = kieCost !== undefined ? Number(kieCost) : null;
          const margin =
            kieCostNum !== null && row.credits_cost > 0
              ? row.credits_cost * rate - kieCostNum
              : null;

          return (
            <div key={row.id} className="rounded-2xl border border-gray-800 bg-[#141414] p-6">
              <div className="flex items-start justify-between">
                <div>
                  <Label className="text-base font-semibold">{label}</Label>
                  <p className="mt-1 text-xs text-gray-500">mode: {row.mode}</p>
                </div>
                {!row.is_active && (
                  <span className="rounded-full bg-gray-700 px-2 py-0.5 text-[10px] text-gray-300">
                    inactivo
                  </span>
                )}
              </div>
              <p className="mb-4 mt-2 text-sm text-gray-400">
                {row.description || 'Sin descripción'}
              </p>

              <div className="flex gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    {mode === 'usd' && (
                      <span className="text-gray-400">$</span>
                    )}
                    <Input
                      type="number"
                      value={draftValue}
                      step={mode === 'usd' ? '0.01' : '1'}
                      onChange={(e) =>
                        setDrafts({ ...drafts, [row.mode]: e.target.value })
                      }
                      min="0"
                      className="flex-1"
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-gray-500">
                    {mode === 'usd'
                      ? `Equivale a ${Math.round(
                          (parseFloat(draftValue) || 0) / rate
                        ).toLocaleString()} créditos`
                      : `Equivale a ${formatUsd((parseFloat(draftValue) || 0) * rate)} USD`}
                  </p>
                </div>
                <Button
                  onClick={() => handleSaveCost(row.mode)}
                  disabled={!dirty || saveCost.isPending}
                  className="bg-brand-accent hover:bg-brand-accent/90"
                >
                  <Save className="h-4 w-4" />
                </Button>
              </div>

              {kieCostNum !== null && (
                <div className="mt-4 rounded-lg border border-gray-800 bg-[#0a0a0a] p-3 text-xs text-gray-400">
                  <div className="flex items-center justify-between">
                    <span>Costo Kie por defecto:</span>
                    <span className="font-mono text-white">{formatUsd(kieCostNum)}</span>
                  </div>
                  {margin !== null && (
                    <div className="mt-1 flex items-center justify-between">
                      <span>Margen estimado:</span>
                      <span
                        className={`font-mono ${
                          margin >= 0 ? 'text-green-400' : 'text-red-400'
                        }`}
                      >
                        {formatUsd(margin)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              <p className="mt-3 text-[10px] text-gray-500">
                Última actualización: {new Date(row.updated_at).toLocaleString('es-ES')}
              </p>
            </div>
          );
        })}
      </div>

      {/* Costos Kie por modelo */}
      <div className="pt-4">
        <h3 className="text-lg font-semibold text-white">Costos Kie por modelo</h3>
        <p className="mt-1 text-sm text-gray-400">
          USD que Riverz le paga a Kie por cada combinación tarea + modelo. Marca uno como default
          para que sea el costo de referencia en la tarjeta de arriba.
        </p>
      </div>

      <div className="space-y-4">
        {(pricing || []).map((task) => {
          const rows = kieByTask[task.mode] || [];
          const draft = newRow[task.mode] || { model_name: '', model_label: '', usd_cost: '' };
          return (
            <div
              key={task.mode}
              className="rounded-2xl border border-gray-800 bg-[#141414] p-5"
            >
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-sm font-semibold text-white">
                  {MODE_LABELS[task.mode] || task.mode}
                </h4>
                <span className="text-[11px] text-gray-500">
                  Cobro al usuario:{' '}
                  {mode === 'usd'
                    ? formatUsd(task.credits_cost * rate)
                    : `${task.credits_cost.toLocaleString()} cr`}
                </span>
              </div>

              {rows.length === 0 && (
                <p className="text-xs text-gray-500">Sin modelos registrados todavía.</p>
              )}

              <div className="space-y-2">
                {rows.map((row) => {
                  const draftCost = kieDrafts[row.id] ?? String(Number(row.usd_cost));
                  const dirty = draftCost !== String(Number(row.usd_cost));
                  return (
                    <div
                      key={row.id}
                      className="grid grid-cols-1 gap-2 rounded-lg border border-gray-800 bg-[#0a0a0a] p-3 md:grid-cols-[1.5fr_2fr_1fr_auto_auto] md:items-center"
                    >
                      <code className="text-xs text-gray-400">{row.model_name}</code>
                      <span className="text-sm text-white">{row.model_label}</span>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-gray-500">$</span>
                        <Input
                          type="number"
                          step="0.0001"
                          min="0"
                          value={draftCost}
                          onChange={(e) =>
                            setKieDrafts({ ...kieDrafts, [row.id]: e.target.value })
                          }
                          className="h-8 text-sm"
                        />
                      </div>
                      <Button
                        size="sm"
                        variant={row.is_default ? 'default' : 'outline'}
                        onClick={() =>
                          updateKieRow.mutate({ id: row.id, is_default: !row.is_default })
                        }
                        title={row.is_default ? 'Default' : 'Marcar como default'}
                      >
                        <Star
                          className="h-3 w-3"
                          fill={row.is_default ? 'currentColor' : 'none'}
                        />
                      </Button>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() =>
                            updateKieRow.mutate({
                              id: row.id,
                              usd_cost: parseFloat(draftCost),
                            })
                          }
                          disabled={!dirty || updateKieRow.isPending}
                        >
                          <Save className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (confirm(`Eliminar ${row.model_label}?`)) {
                              deleteKieRow.mutate(row.id);
                            }
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Add new model */}
              <div className="mt-3 grid grid-cols-1 gap-2 rounded-lg border border-dashed border-gray-800 p-3 md:grid-cols-[1.5fr_2fr_1fr_auto] md:items-center">
                <Input
                  placeholder="model_name (ej. sora-2)"
                  value={draft.model_name}
                  onChange={(e) =>
                    setNewRow({
                      ...newRow,
                      [task.mode]: { ...draft, model_name: e.target.value },
                    })
                  }
                  className="h-8 text-sm"
                />
                <Input
                  placeholder="Etiqueta (ej. Sora 2)"
                  value={draft.model_label}
                  onChange={(e) =>
                    setNewRow({
                      ...newRow,
                      [task.mode]: { ...draft, model_label: e.target.value },
                    })
                  }
                  className="h-8 text-sm"
                />
                <Input
                  type="number"
                  step="0.0001"
                  min="0"
                  placeholder="USD"
                  value={draft.usd_cost}
                  onChange={(e) =>
                    setNewRow({
                      ...newRow,
                      [task.mode]: { ...draft, usd_cost: e.target.value },
                    })
                  }
                  className="h-8 text-sm"
                />
                <Button
                  size="sm"
                  onClick={() => {
                    if (!draft.model_name || !draft.model_label || !draft.usd_cost) {
                      toast.error('Completa los 3 campos');
                      return;
                    }
                    createKieRow.mutate({
                      task_mode: task.mode,
                      model_name: draft.model_name,
                      model_label: draft.model_label,
                      usd_cost: parseFloat(draft.usd_cost),
                      is_default: rows.length === 0,
                    });
                  }}
                  disabled={createKieRow.isPending}
                >
                  <Plus className="mr-1 h-3 w-3" /> Agregar
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
