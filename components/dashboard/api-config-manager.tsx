'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Save } from 'lucide-react';

const API_CONFIGS = [
  { key: 'ugc_post_url', label: 'UGC - POST URL', description: 'URL para enviar datos de UGC a N8N' },
  { key: 'ugc_get_url', label: 'UGC - GET URL', description: 'URL para obtener resultados de UGC' },
  { key: 'face_swap_post_url', label: 'Face Swap - POST URL', description: 'URL para enviar datos de Face Swap' },
  { key: 'face_swap_get_url', label: 'Face Swap - GET URL', description: 'URL para obtener resultados de Face Swap' },
  { key: 'clips_post_url', label: 'Clips - POST URL', description: 'URL para enviar datos de Clips' },
  { key: 'clips_get_url', label: 'Clips - GET URL', description: 'URL para obtener resultados de Clips' },
  { key: 'editar_foto_crear_post_url', label: 'Editar Foto Crear - POST URL', description: 'URL para crear imágenes' },
  { key: 'editar_foto_crear_get_url', label: 'Editar Foto Crear - GET URL', description: 'URL para obtener imágenes creadas' },
  { key: 'editar_foto_editar_post_url', label: 'Editar Foto Editar - POST URL', description: 'URL para editar imágenes' },
  { key: 'editar_foto_editar_get_url', label: 'Editar Foto Editar - GET URL', description: 'URL para obtener imágenes editadas' },
  { key: 'editar_foto_combinar_post_url', label: 'Editar Foto Combinar - POST URL', description: 'URL para combinar imágenes' },
  { key: 'editar_foto_combinar_get_url', label: 'Editar Foto Combinar - GET URL', description: 'URL para obtener imágenes combinadas' },
  { key: 'editar_foto_clonar_post_url', label: 'Editar Foto Clonar - POST URL', description: 'URL para clonar imágenes' },
  { key: 'editar_foto_clonar_get_url', label: 'Editar Foto Clonar - GET URL', description: 'URL para obtener imágenes clonadas' },
  { key: 'mejorar_calidad_video_post_url', label: 'Mejorar Calidad Video - POST URL', description: 'URL para mejorar calidad de videos' },
  { key: 'mejorar_calidad_video_get_url', label: 'Mejorar Calidad Video - GET URL', description: 'URL para obtener videos mejorados' },
  { key: 'mejorar_calidad_imagen_post_url', label: 'Mejorar Calidad Imagen - POST URL', description: 'URL para mejorar calidad de imágenes' },
  { key: 'mejorar_calidad_imagen_get_url', label: 'Mejorar Calidad Imagen - GET URL', description: 'URL para obtener imágenes mejoradas' },
  { key: 'script_generation_post_url', label: 'Generación Script - POST URL', description: 'URL para generar scripts con IA' },
  { key: 'script_generation_get_url', label: 'Generación Script - GET URL', description: 'URL para obtener scripts generados' },
  { key: 'report_generation_post_url', label: 'Generación Reporte - POST URL', description: 'URL para generar reportes de productos' },
  { key: 'report_generation_get_url', label: 'Generación Reporte - GET URL', description: 'URL para obtener reportes generados' },
];

export function APIConfigManager() {
  const [configs, setConfigs] = useState<{ [key: string]: string }>({});
  const supabase = createClient();
  const queryClient = useQueryClient();

  const { data: savedConfigs } = useQuery({
    queryKey: ['admin-config'],
    queryFn: async () => {
      const { data, error } = await supabase.from('admin_config').select('*');
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (savedConfigs) {
      const configMap: { [key: string]: string } = {};
      savedConfigs.forEach((config: any) => {
        configMap[config.key] = config.value;
      });
      setConfigs(configMap);
    }
  }, [savedConfigs]);

  const saveConfig = useMutation({
    mutationFn: async ({ key, value, description }: { key: string; value: string; description: string }) => {
      const { error } = await supabase.from('admin_config').upsert([
        { key, value, description, updated_at: new Date().toISOString() },
      ]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-config'] });
      toast.success('Configuración guardada');
    },
  });

  const handleSave = (key: string, description: string) => {
    const value = configs[key] || '';
    saveConfig.mutate({ key, value, description });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Configuración de APIs N8N</h2>
        <p className="mt-2 text-gray-400">
          Configura las URLs de los endpoints de N8N para cada modo de uso
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {API_CONFIGS.map((config) => (
          <div key={config.key} className="rounded-2xl border border-gray-800 bg-[#141414] p-6">
            <Label className="mb-2 block text-base font-semibold">{config.label}</Label>
            <p className="mb-4 text-sm text-gray-400">{config.description}</p>
            <div className="flex gap-3">
              <Input
                value={configs[config.key] || ''}
                onChange={(e) => setConfigs({ ...configs, [config.key]: e.target.value })}
                placeholder="https://..."
                className="flex-1"
              />
              <Button
                onClick={() => handleSave(config.key, config.description)}
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

