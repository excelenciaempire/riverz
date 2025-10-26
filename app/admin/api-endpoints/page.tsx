'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { CheckCircle, XCircle, RefreshCw } from 'lucide-react';

const endpoints = [
  { key: 'N8N_UGC_WEBHOOK_URL', name: 'UGC Generation', description: 'Generate UGC videos with AI avatars' },
  { key: 'N8N_FACE_SWAP_WEBHOOK_URL', name: 'Face Swap', description: 'Swap faces in videos' },
  { key: 'N8N_CLIPS_WEBHOOK_URL', name: 'Clips', description: 'Generate short video clips' },
  { key: 'N8N_EDITAR_FOTO_CREAR_WEBHOOK_URL', name: 'Editar Foto - Crear', description: 'Create images from text' },
  { key: 'N8N_EDITAR_FOTO_EDITAR_WEBHOOK_URL', name: 'Editar Foto - Editar', description: 'Edit existing images' },
  { key: 'N8N_EDITAR_FOTO_COMBINAR_WEBHOOK_URL', name: 'Editar Foto - Combinar', description: 'Combine multiple images' },
  { key: 'N8N_EDITAR_FOTO_CLONAR_WEBHOOK_URL', name: 'Editar Foto - Clonar', description: 'Clone product images' },
  { key: 'N8N_STATIC_ADS_IDEACION_WEBHOOK_URL', name: 'Static Ads Ideation', description: 'Generate ad concepts' },
  { key: 'N8N_MEJORAR_CALIDAD_VIDEO_WEBHOOK_URL', name: 'Mejorar Calidad - Video', description: 'Enhance video quality' },
  { key: 'N8N_MEJORAR_CALIDAD_IMAGEN_WEBHOOK_URL', name: 'Mejorar Calidad - Imagen', description: 'Enhance image quality' },
  { key: 'N8N_MARCAS_REPORT_WEBHOOK_URL', name: 'Marcas Report', description: 'Generate product market research PDF' },
];

export default function APIEndpointsPage() {
  const [configs, setConfigs] = useState<Record<string, string>>({});
  const [testResults, setTestResults] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    try {
      const { data } = await supabase.from('admin_config').select('*');

      const configMap: Record<string, string> = {};
      data?.forEach((config) => {
        configMap[config.key] = config.value;
      });

      setConfigs(configMap);
    } catch (error) {
      console.error('Error loading configs:', error);
    }
  };

  const saveConfig = async (key: string, value: string) => {
    try {
      await supabase.from('admin_config').upsert({
        key,
        value,
        description: endpoints.find((e) => e.key === key)?.description,
      });

      setConfigs({ ...configs, [key]: value });
    } catch (error) {
      console.error('Error saving config:', error);
    }
  };

  const testEndpoint = async (key: string) => {
    const url = configs[key];
    if (!url) return;

    try {
      const response = await fetch(url, { method: 'HEAD' });
      setTestResults({ ...testResults, [key]: response.ok });
    } catch (error) {
      setTestResults({ ...testResults, [key]: false });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">API Endpoints</h1>
        <p className="mt-2 text-gray-400">
          Configuración de webhooks N8N para cada función
        </p>
      </div>

      <div className="space-y-4">
        {endpoints.map((endpoint) => (
          <div
            key={endpoint.key}
            className="rounded-lg border border-gray-700 bg-brand-dark-secondary p-6"
          >
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-white">{endpoint.name}</h3>
              <p className="text-sm text-gray-400">{endpoint.description}</p>
            </div>

            <div className="flex items-center gap-4">
              <input
                type="text"
                placeholder="https://your-n8n-instance.com/webhook/..."
                value={configs[endpoint.key] || ''}
                onChange={(e) => saveConfig(endpoint.key, e.target.value)}
                className="flex-1 rounded-lg border border-gray-700 bg-brand-dark-primary px-4 py-2 text-white"
              />

              <button
                onClick={() => testEndpoint(endpoint.key)}
                className="flex items-center gap-2 rounded-lg bg-brand-accent px-4 py-2 text-white hover:bg-brand-accent/90"
              >
                <RefreshCw className="h-4 w-4" />
                Probar
              </button>

              {testResults[endpoint.key] !== undefined && (
                <div className="flex items-center gap-2">
                  {testResults[endpoint.key] ? (
                    <CheckCircle className="h-5 w-5 text-green-400" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-400" />
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-yellow-600 bg-yellow-600/10 p-4">
        <p className="text-sm text-yellow-400">
          💡 <strong>Nota:</strong> Los cambios se guardan automáticamente. Asegúrate de
          que las URLs de N8N estén correctamente configuradas y accesibles.
        </p>
      </div>
    </div>
  );
}

