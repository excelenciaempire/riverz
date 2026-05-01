'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Save } from 'lucide-react';

type PricingRow = {
  id: string;
  mode: string;
  credits_cost: number;
  description: string | null;
  is_active: boolean;
  updated_at: string;
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

export function PricingConfig() {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const queryClient = useQueryClient();

  const { data: pricing, isLoading } = useQuery<PricingRow[]>({
    queryKey: ['pricing-config'],
    queryFn: async () => {
      const res = await fetch('/api/admin/pricing');
      if (!res.ok) throw new Error('Failed to fetch pricing');
      const json = await res.json();
      return json.pricing || [];
    },
  });

  useEffect(() => {
    if (pricing) {
      const next: Record<string, string> = {};
      for (const row of pricing) {
        next[row.mode] = String(row.credits_cost);
      }
      setDrafts(next);
    }
  }, [pricing]);

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
    onError: (e: any) => toast.error(e.message || 'Error guardando precio'),
  });

  const handleSave = (mode: string) => {
    const value = parseInt(drafts[mode] ?? '');
    if (Number.isNaN(value) || value < 0) {
      toast.error('Ingresa un número válido (>= 0)');
      return;
    }
    saveCost.mutate({ mode, credits_cost: value });
  };

  if (isLoading) {
    return (
      <div>
        <h2 className="text-2xl font-bold text-white">Configuración de Precios</h2>
        <p className="mt-4 text-gray-400">Cargando precios desde pricing_config…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Configuración de Precios</h2>
        <p className="mt-2 text-gray-400">
          Costo en créditos por modo de generación. Los valores se guardan en{' '}
          <code className="text-brand-accent">pricing_config</code> — la misma tabla que el runtime
          consulta antes de cada generación.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {(pricing || []).map((row) => {
          const label = MODE_LABELS[row.mode] || row.mode;
          const draft = drafts[row.mode] ?? String(row.credits_cost);
          const dirty = draft !== String(row.credits_cost);
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
                <Input
                  type="number"
                  value={draft}
                  onChange={(e) => setDrafts({ ...drafts, [row.mode]: e.target.value })}
                  min="0"
                  className="flex-1"
                />
                <Button
                  onClick={() => handleSave(row.mode)}
                  disabled={!dirty || saveCost.isPending}
                  className="bg-brand-accent hover:bg-brand-accent/90"
                >
                  <Save className="h-4 w-4" />
                </Button>
              </div>
              <p className="mt-2 text-[10px] text-gray-500">
                Última actualización: {new Date(row.updated_at).toLocaleString('es-ES')}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
