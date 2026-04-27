'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

const ANALYSIS_OPTIONS = [
  { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 (recomendado)', note: 'Calidad máxima, visión nativa, endpoint /claude/v1/messages' },
  { value: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5', note: 'Compatibilidad legado, OpenAI-compat' },
  { value: 'gemini-3-pro', label: 'Gemini 3 Pro (fallback)', note: 'Multimodal robusto si Claude no responde' },
  { value: 'gemini-flash-2-0', label: 'Gemini Flash 2.0', note: 'Rápido y barato, calidad menor' },
];

const GENERATION_OPTIONS = [
  { value: 'nano-banana-pro', label: 'Nano Banana Pro (recomendado)', note: '~$0.134 por imagen, 2K, calidad comercial' },
];

export function KieConfigManager() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const [analysisDraft, setAnalysisDraft] = useState<string | null>(null);
  const [generationDraft, setGenerationDraft] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');

  const { data: config, isLoading } = useQuery({
    queryKey: ['admin-config-kie'],
    queryFn: async () => {
      const { data } = await supabase
        .from('admin_config')
        .select('*')
        .in('key', ['kie_analysis_model', 'kie_generation_model']);

      const map: Record<string, string> = {};
      data?.forEach((item) => { map[item.key] = item.value; });

      return {
        analysisModel: map['kie_analysis_model'] || 'claude-sonnet-4-6',
        generationModel: map['kie_generation_model'] || 'nano-banana-pro',
      };
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (next: { analysisModel: string; generationModel: string }) => {
      const updates = [
        { key: 'kie_analysis_model', value: next.analysisModel },
        { key: 'kie_generation_model', value: next.generationModel },
      ];
      for (const u of updates) {
        const { error } = await supabase.from('admin_config').upsert(u, { onConflict: 'key' });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('Configuración guardada');
      setAnalysisDraft(null);
      setGenerationDraft(null);
      queryClient.invalidateQueries({ queryKey: ['admin-config-kie'] });
    },
    onError: () => toast.error('Error al guardar configuración'),
  });

  const runTest = async (model: string, type: 'analysis' | 'vision' | 'generation') => {
    setTestStatus('testing');
    setTestMessage(`Probando ${type} con ${model}...`);
    try {
      const res = await fetch('/api/admin/test-kie-model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, type }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTestStatus('success');
        setTestMessage(
          type === 'generation'
            ? `OK · taskId=${data.taskId?.slice(0, 8)}…`
            : `OK · respuesta: "${(data.sample || '').slice(0, 80)}"`
        );
      } else {
        setTestStatus('error');
        setTestMessage(data.error || 'Error desconocido');
      }
    } catch {
      setTestStatus('error');
      setTestMessage('Error de conexión');
    }
  };

  if (isLoading) return <div className="text-gray-400">Cargando configuración...</div>;

  const currentAnalysis = analysisDraft ?? config?.analysisModel ?? 'claude-sonnet-4-6';
  const currentGeneration = generationDraft ?? config?.generationModel ?? 'nano-banana-pro';
  const dirty =
    (analysisDraft !== null && analysisDraft !== config?.analysisModel) ||
    (generationDraft !== null && generationDraft !== config?.generationModel);

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-xl font-bold text-white">Configuración KIE.ai</h2>
        <p className="mt-1 text-sm text-gray-400">
          Modelos usados por el pipeline de Static Ads. Los cambios se aplican en la siguiente generación.
        </p>
      </div>

      {/* Pipeline diagram */}
      <div className="rounded-xl border border-gray-800 bg-[#0f0f0f] p-5">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">Pipeline activo</h3>
        <ol className="space-y-2 text-sm text-gray-300">
          <li><span className="text-[#07A498]">1.</span> Análisis del template (visión) → <code className="text-white">{currentAnalysis}</code></li>
          <li><span className="text-[#07A498]">2.</span> Adaptación al producto (visión) → <code className="text-white">{currentAnalysis}</code></li>
          <li><span className="text-[#07A498]">3.</span> Generar 5 prompts creativos → <code className="text-white">{currentAnalysis}</code></li>
          <li><span className="text-[#07A498]">4.</span> Generar 5 imágenes (paralelo) → <code className="text-white">{currentGeneration}</code></li>
          <li><span className="text-[#07A498]">5.</span> Polling de 5 resultados (1 GET por imagen) → <code className="text-white">kie.ai jobs</code></li>
        </ol>
        <p className="mt-3 text-xs text-gray-500">
          Por cada plantilla seleccionada por el usuario se cobran <span className="text-white">14 × 5 = 70 créditos</span> y se generan 5 imágenes con ángulos creativos distintos.
        </p>
      </div>

      {/* Analysis model */}
      <div className="rounded-xl border border-gray-800 bg-[#141414] p-5">
        <Label className="text-white text-base">Modelo de Análisis (visión + razonamiento)</Label>
        <p className="mt-1 text-xs text-gray-500">
          Se usa en los pasos 1, 2 y 3. Si Claude falla, el sistema cae automáticamente al fallback configurado más abajo.
        </p>

        <div className="mt-3 grid gap-2">
          {ANALYSIS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setAnalysisDraft(opt.value)}
              className={`text-left rounded-lg border px-3 py-2 transition ${
                currentAnalysis === opt.value
                  ? 'border-[#07A498] bg-[#07A498]/10'
                  : 'border-gray-800 bg-[#0a0a0a] hover:border-gray-700'
              }`}
            >
              <div className="text-sm font-medium text-white">{opt.label}</div>
              <div className="text-xs text-gray-500">{opt.note}</div>
              <div className="mt-1 font-mono text-xs text-gray-600">{opt.value}</div>
            </button>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Input
            value={currentAnalysis}
            onChange={(e) => setAnalysisDraft(e.target.value)}
            placeholder="ID del modelo (override manual)"
            className="bg-[#0a0a0a] border-gray-700 flex-1 min-w-[200px]"
          />
          <Button variant="outline" onClick={() => runTest(currentAnalysis, 'analysis')}>
            Probar texto
          </Button>
          <Button variant="outline" onClick={() => runTest(currentAnalysis, 'vision')}>
            Probar visión
          </Button>
        </div>
      </div>

      {/* Generation model */}
      <div className="rounded-xl border border-gray-800 bg-[#141414] p-5">
        <Label className="text-white text-base">Modelo de Generación de Imágenes</Label>
        <p className="mt-1 text-xs text-gray-500">Se usa en el paso 4 (generación final con kie.ai).</p>

        <div className="mt-3 grid gap-2">
          {GENERATION_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setGenerationDraft(opt.value)}
              className={`text-left rounded-lg border px-3 py-2 transition ${
                currentGeneration === opt.value
                  ? 'border-[#07A498] bg-[#07A498]/10'
                  : 'border-gray-800 bg-[#0a0a0a] hover:border-gray-700'
              }`}
            >
              <div className="text-sm font-medium text-white">{opt.label}</div>
              <div className="text-xs text-gray-500">{opt.note}</div>
              <div className="mt-1 font-mono text-xs text-gray-600">{opt.value}</div>
            </button>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Input
            value={currentGeneration}
            onChange={(e) => setGenerationDraft(e.target.value)}
            placeholder="ID del modelo de generación"
            className="bg-[#0a0a0a] border-gray-700 flex-1 min-w-[200px]"
          />
          <Button variant="outline" onClick={() => runTest(currentGeneration, 'generation')}>
            Probar generación
          </Button>
        </div>
      </div>

      {/* Save */}
      <div className="flex items-center gap-3">
        <Button
          onClick={() => saveMutation.mutate({ analysisModel: currentAnalysis, generationModel: currentGeneration })}
          disabled={!dirty || saveMutation.isPending}
          className="bg-[#07A498] text-white hover:bg-[#068f84]"
        >
          {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Guardar configuración
        </Button>
        {dirty && <span className="text-xs text-yellow-400">Cambios sin guardar</span>}
      </div>

      {/* Test result */}
      {testStatus !== 'idle' && (
        <div
          className={`rounded-lg border p-3 text-sm ${
            testStatus === 'success'
              ? 'border-green-500/30 bg-green-500/10 text-green-300'
              : testStatus === 'error'
                ? 'border-red-500/30 bg-red-500/10 text-red-300'
                : 'border-blue-500/30 bg-blue-500/10 text-blue-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {testStatus === 'testing' && <Loader2 className="h-4 w-4 animate-spin" />}
            <span>{testMessage}</span>
          </div>
        </div>
      )}
    </div>
  );
}
