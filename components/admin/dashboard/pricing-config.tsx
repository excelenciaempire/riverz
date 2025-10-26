'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Save } from 'lucide-react';

const GENERATION_TYPES = [
  { key: 'ugc_cost', label: 'UGC Video', default: 100 },
  { key: 'face_swap_cost', label: 'Face Swap', default: 80 },
  { key: 'clips_cost', label: 'Clips', default: 90 },
  { key: 'editar_foto_crear_cost', label: 'Editar Foto - Crear', default: 30 },
  { key: 'editar_foto_editar_cost', label: 'Editar Foto - Editar', default: 40 },
  { key: 'editar_foto_combinar_cost', label: 'Editar Foto - Combinar', default: 50 },
  { key: 'editar_foto_clonar_cost', label: 'Editar Foto - Clonar', default: 60 },
  { key: 'mejorar_calidad_video_cost', label: 'Mejorar Calidad Video', default: 120 },
  { key: 'mejorar_calidad_imagen_cost', label: 'Mejorar Calidad Imagen', default: 70 },
  { key: 'script_generation_cost', label: 'Generación de Script', default: 20 },
];

export function PricingConfig() {
  const [costs, setCosts] = useState<{ [key: string]: string }>({});
  const supabase = createClient();
  const queryClient = useQueryClient();

  const { data: savedCosts } = useQuery({
    queryKey: ['pricing-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_config')
        .select('*')
        .like('key', '%_cost');
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (savedCosts) {
      const costMap: { [key: string]: string } = {};
      savedCosts.forEach((config: any) => {
        costMap[config.key] = config.value;
      });
      setCosts(costMap);
    }
  }, [savedCosts]);

  const saveCost = useMutation({
    mutationFn: async ({ key, value, description }: { key: string; value: string; description: string }) => {
      const { error } = await supabase.from('admin_config').upsert([
        { key, value, description, updated_at: new Date().toISOString() },
      ]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricing-config'] });
      toast.success('Precio actualizado');
    },
  });

  const handleSave = (key: string, label: string) => {
    const value = costs[key] || '0';
    saveCost.mutate({ key, value, description: `Costo en créditos para ${label}` });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Configuración de Precios</h2>
        <p className="mt-2 text-gray-400">Costo en créditos de cada modo de uso</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {GENERATION_TYPES.map((type) => (
          <div key={type.key} className="rounded-2xl border border-gray-800 bg-[#141414] p-6">
            <Label className="mb-2 block text-base font-semibold">{type.label}</Label>
            <p className="mb-4 text-sm text-gray-400">
              Créditos que se cobrarán por generación
            </p>
            <div className="flex gap-3">
              <Input
                type="number"
                value={costs[type.key] || type.default}
                onChange={(e) => setCosts({ ...costs, [type.key]: e.target.value })}
                placeholder={type.default.toString()}
                min="0"
                className="flex-1"
              />
              <Button
                onClick={() => handleSave(type.key, type.label)}
                className="bg-brand-accent hover:bg-brand-accent/90"
              >
                <Save className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

