'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Save, ExternalLink } from 'lucide-react';

export function KieConfigManager() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');

  // Fetch Config
  const { data: config, isLoading } = useQuery({
    queryKey: ['admin-config-kie'],
    queryFn: async () => {
      const { data } = await supabase
        .from('admin_config')
        .select('*')
        .in('key', ['kie_analysis_model', 'kie_generation_model']);
      
      const configMap: Record<string, string> = {};
      data?.forEach(item => {
        configMap[item.key] = item.value;
      });
      
      return {
        analysisModel: configMap['kie_analysis_model'] || '',
        generationModel: configMap['kie_generation_model'] || 'nano-banana-pro',
      };
    },
  });

  // Update Config Mutation
  const updateConfigMutation = useMutation({
    mutationFn: async (newConfig: { analysisModel: string; generationModel: string }) => {
      const updates = [
        { key: 'kie_analysis_model', value: newConfig.analysisModel },
        { key: 'kie_generation_model', value: newConfig.generationModel },
      ];

      for (const update of updates) {
        const { error } = await supabase
          .from('admin_config')
          .upsert(update, { onConflict: 'key' });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('Configuración guardada');
      queryClient.invalidateQueries({ queryKey: ['admin-config-kie'] });
    },
    onError: () => {
      toast.error('Error al guardar configuración');
    },
  });

  const handleTest = async (model: string, type: 'analysis' | 'generation') => {
    setTestStatus('testing');
    setTestMessage('Probando conexión...');
    
    try {
      const response = await fetch('/api/admin/test-kie-model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, type }),
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        setTestStatus('success');
        setTestMessage('Modelo verificado correctamente');
      } else {
        setTestStatus('error');
        setTestMessage(data.error || 'Error desconocido');
      }
    } catch (error) {
      setTestStatus('error');
      setTestMessage('Error de conexión');
    }
  };

  if (isLoading) return <div>Cargando configuración...</div>;

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h2 className="text-xl font-bold text-white mb-2">Configuración KIE AI</h2>
        <p className="text-gray-400 text-sm">Configura los modelos de IA para análisis y generación.</p>
      </div>

      <div className="space-y-6">
        {/* Analysis Model */}
        <div className="rounded-xl border border-gray-800 bg-[#141414] p-6">
          <div className="mb-4">
            <Label className="text-white text-lg">Modelo de Análisis (Visión/LLM)</Label>
            <p className="text-sm text-gray-500 mt-1">
              Usado para analizar productos y plantillas para generar prompts.
              Busca en docs de KIE modelos tipo GPT-4 Vision, Claude 3, etc.
            </p>
          </div>
          
          <div className="flex gap-4">
            <Input
              value={config?.analysisModel}
              onChange={(e) => updateConfigMutation.mutate({ 
                analysisModel: e.target.value, 
                generationModel: config?.generationModel || '' 
              })}
              placeholder="Ej: gpt-4o, gemini-pro-vision, qwen-vl"
              className="bg-[#0a0a0a] border-gray-700"
            />
            <Button 
              variant="outline"
              onClick={() => handleTest(config?.analysisModel || '', 'analysis')}
            >
              Probar
            </Button>
          </div>
        </div>

        {/* Generation Model */}
        <div className="rounded-xl border border-gray-800 bg-[#141414] p-6">
          <div className="mb-4">
            <Label className="text-white text-lg">Modelo de Generación de Imágenes</Label>
            <p className="text-sm text-gray-500 mt-1">
              Usado para generar la imagen final (Nano Banana Pro u otros).
            </p>
          </div>
          
          <div className="flex gap-4">
            <Input
              value={config?.generationModel}
              onChange={(e) => updateConfigMutation.mutate({ 
                analysisModel: config?.analysisModel || '', 
                generationModel: e.target.value 
              })}
              placeholder="Ej: nano-banana-pro"
              className="bg-[#0a0a0a] border-gray-700"
            />
            <Button 
              variant="outline"
              onClick={() => handleTest(config?.generationModel || '', 'generation')}
            >
              Probar
            </Button>
          </div>
        </div>

        {/* Test Result */}
        {testStatus !== 'idle' && (
          <div className={`p-4 rounded-lg border ${
            testStatus === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-400' :
            testStatus === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
            'bg-blue-500/10 border-blue-500/20 text-blue-400'
          }`}>
            <div className="flex items-center gap-2">
              {testStatus === 'testing' && <Loader2 className="h-4 w-4 animate-spin" />}
              <span className="font-medium">{testMessage}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
