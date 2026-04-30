'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Modal } from '@/components/ui/modal';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Loader2, Eye, EyeOff, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AIPrompt {
  id: string;
  key: string;
  name: string;
  category: string;
  prompt_text: string;
  description: string;
  variables: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Categories grouped by APP FUNCTION. Each value matches what's stored in
// the `category` column on `ai_prompts`. Order here = display order in the UI.
const CATEGORIES = [
  { value: 'static_ads', label: '🎨 Static Ads', description: 'Pipeline de generación de imágenes publicitarias (Gemini + Nano Banana Pro)' },
  { value: 'product_research', label: '🔬 Research de Producto', description: 'Análisis profundo del producto y buyer persona — alimenta a todo el pipeline' },
  { value: 'stealer', label: '🎬 Stealer (Video clones)', description: 'Pipeline para clonar videos UGC con Veo 3.1' },
  { value: 'ugc', label: '🎤 UGC Chat', description: 'Generación de videos talking-head con Veo 3.1' },
  { value: 'landing_lab', label: '📄 Landing Lab', description: 'Copy y prompts visuales para landings' },
  { value: 'other', label: '📁 Otros / Legacy', description: 'Prompts antiguos o de uso general' }
];

// Within static_ads, render in pipeline execution order (analysis → adaptation → edit → legacy).
const STATIC_ADS_ORDER: Record<string, number> = {
  template_analysis_json: 1,
  template_adaptation: 2,
  static_ads_edit_instructions: 3,
  static_ads_5_variations_prompts: 90, // legacy
  static_ads_prompt_generation: 91,    // legacy
  template_analysis: 92,                // legacy
};

export function PromptsManager() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<AIPrompt | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState({
    key: '',
    name: '',
    category: 'static_ads',
    prompt_text: '',
    description: '',
    variables: '',
    is_active: true
  });

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const queryClient = useQueryClient();

  const { data: prompts, isLoading } = useQuery({
    queryKey: ['admin-prompts'],
    queryFn: async () => {
      const response = await fetch('/api/admin/prompts');
      if (!response.ok) throw new Error('Failed to fetch prompts');
      return response.json() as Promise<AIPrompt[]>;
    },
  });

  const createPrompt = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await fetch('/api/admin/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          variables: data.variables ? data.variables.split(',').map(v => v.trim()).filter(Boolean) : []
        })
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${response.status} al crear prompt`);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-prompts'] });
      setIsModalOpen(false);
      resetForm();
      toast.success('Prompt creado exitosamente');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Error al crear prompt');
    }
  });

  const updatePrompt = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const response = await fetch('/api/admin/prompts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          ...data,
          variables: data.variables ? data.variables.split(',').map(v => v.trim()).filter(Boolean) : []
        })
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${response.status} al actualizar prompt`);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-prompts'] });
      setIsModalOpen(false);
      resetForm();
      toast.success('Prompt actualizado exitosamente');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Error al actualizar prompt');
    }
  });

  const deletePrompt = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/admin/prompts?id=${id}`, {
        method: 'DELETE'
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${response.status} al eliminar prompt`);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-prompts'] });
      toast.success('Prompt eliminado');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Error al eliminar prompt');
    }
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const response = await fetch('/api/admin/prompts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_active })
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${response.status} al cambiar estado`);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-prompts'] });
      toast.success('Estado actualizado');
    }
  });


  const resetForm = () => {
    setFormData({
      key: '',
      name: '',
      category: 'static_ads',
      prompt_text: '',
      description: '',
      variables: '',
      is_active: true
    });
    setEditingPrompt(null);
  };

  const handleEdit = (prompt: AIPrompt) => {
    setEditingPrompt(prompt);
    setFormData({
      key: prompt.key,
      name: prompt.name,
      category: prompt.category,
      prompt_text: prompt.prompt_text,
      description: prompt.description || '',
      variables: Array.isArray(prompt.variables) ? prompt.variables.join(', ') : '',
      is_active: prompt.is_active
    });
    setIsModalOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.key || !formData.name || !formData.prompt_text) {
      toast.error('Por favor completa todos los campos obligatorios');
      return;
    }

    if (editingPrompt) {
      updatePrompt.mutate({ id: editingPrompt.id, data: formData });
    } else {
      createPrompt.mutate(formData);
    }
  };

  const handleDelete = (prompt: AIPrompt) => {
    if (!confirm(`¿Estás seguro de eliminar "${prompt.name}"?\nEsto puede afectar procesos que dependen de este prompt.`)) return;
    deletePrompt.mutate(prompt.id);
  };

  const getCategory = (category: string) => CATEGORIES.find(c => c.value === category);
  const getCategoryLabel = (category: string) => getCategory(category)?.label || `📁 ${category}`;
  const getCategoryDescription = (category: string) => getCategory(category)?.description || '';

  // Group + sort. Categories appear in the order defined in CATEGORIES (so
  // Static Ads always shows first), and within each category prompts are
  // ordered by pipeline step when known, otherwise alphabetically by name.
  const groupedPrompts: Record<string, AIPrompt[]> = {};
  for (const cat of CATEGORIES) groupedPrompts[cat.value] = [];
  if (prompts) {
    for (const p of prompts) {
      const bucket = groupedPrompts[p.category] ? p.category : 'other';
      if (!groupedPrompts[bucket]) groupedPrompts[bucket] = [];
      groupedPrompts[bucket].push(p);
    }
    for (const list of Object.values(groupedPrompts)) {
      list.sort((a, b) => {
        const aOrder = STATIC_ADS_ORDER[a.key] ?? 50;
        const bOrder = STATIC_ADS_ORDER[b.key] ?? 50;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return a.name.localeCompare(b.name);
      });
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Prompts de IA</h2>
          <p className="mt-1 text-sm text-gray-400">
            Configura los prompts del sistema para cada etapa de generación
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setIsModalOpen(true)}
            className="bg-brand-accent hover:bg-brand-accent/90"
          >
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Prompt
          </Button>
        </div>
      </div>

      {/* Info Panel - Pipeline Explanation (current Static Ads flow) */}
      <div className="rounded-xl border border-gray-800 bg-gradient-to-r from-[#141414] to-[#1a1a1a] p-5">
        <h3 className="text-sm font-medium text-gray-300 mb-3">📋 Pipeline de Static Ads (Gemini 3 Pro + Nano Banana Pro)</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          <div className="p-3 rounded-lg bg-[#0a0a0a] border border-gray-800">
            <p className="font-medium text-white text-[11px]">1. Research (opcional)</p>
            <p className="text-gray-500">Gemini 3 Pro</p>
            <code className="text-brand-accent/80 text-[9px]">product_deep_research</code>
          </div>
          <div className="p-3 rounded-lg bg-[#0a0a0a] border border-gray-800">
            <p className="font-medium text-white text-[11px]">2. Análisis JSON</p>
            <p className="text-gray-500">Gemini 3 Pro · vision</p>
            <code className="text-brand-accent/80 text-[9px]">template_analysis_json</code>
          </div>
          <div className="p-3 rounded-lg bg-[#0a0a0a] border border-gray-800">
            <p className="font-medium text-white text-[11px]">3. Adaptación al producto</p>
            <p className="text-gray-500">Gemini 3 Pro · vision</p>
            <code className="text-brand-accent/80 text-[9px]">template_adaptation</code>
          </div>
          <div className="p-3 rounded-lg bg-[#0a0a0a] border border-[#07A498]/30">
            <p className="font-medium text-white text-[11px]">4. Imagen</p>
            <p className="text-[#07A498]">Nano Banana Pro</p>
            <code className="text-gray-500 text-[9px]">JSON adaptado + fotos producto</code>
          </div>
        </div>
        <p className="mt-3 text-[11px] text-gray-500">
          El paso de "generar prompt" se eliminó: el JSON adaptado del paso 3 se envía
          directamente como prompt a Nano Banana, junto con las fotos del producto del usuario.
        </p>
      </div>

      {/* Grouped by Category — categories appear in the order defined in CATEGORIES,
          empty categories are hidden, prompts within Static Ads are pipeline-ordered. */}
      <div className="space-y-8">
        {Object.entries(groupedPrompts)
          .filter(([, list]) => list.length > 0)
          .map(([category, categoryPrompts]) => (
            <div key={category} className="space-y-3">
              <div>
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-brand-accent" />
                  {getCategoryLabel(category)}
                  <span className="text-xs text-gray-500 font-normal">({categoryPrompts.length})</span>
                </h3>
                {getCategoryDescription(category) && (
                  <p className="ml-7 text-xs text-gray-500">{getCategoryDescription(category)}</p>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {categoryPrompts.map((prompt) => {
                  const isExpanded = expandedIds.has(prompt.id);
                  const orderHint = STATIC_ADS_ORDER[prompt.key];
                  const isLegacy = orderHint !== undefined && orderHint >= 90;
                  return (
                    <div
                      key={prompt.id}
                      className={cn(
                        'rounded-xl border bg-[#141414] p-5 transition-all',
                        prompt.is_active ? 'border-gray-800' : 'border-gray-800/50 opacity-60',
                        isLegacy && 'border-yellow-900/40',
                      )}
                    >
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            {orderHint !== undefined && orderHint < 90 && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-brand-accent/20 text-brand-accent">
                                PASO {orderHint}
                              </span>
                            )}
                            <h4 className="font-semibold text-white">{prompt.name}</h4>
                            {!prompt.is_active && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">
                                Inactivo
                              </span>
                            )}
                            {isLegacy && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-900/30 text-yellow-400">
                                Legacy
                              </span>
                            )}
                          </div>
                          <code className="text-xs text-brand-accent/80 font-mono break-all">
                            {prompt.key}
                          </code>
                        </div>

                        <button
                          onClick={() => toggleActive.mutate({ id: prompt.id, is_active: !prompt.is_active })}
                          className={cn(
                            'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors',
                            prompt.is_active
                              ? 'bg-brand-accent/20 text-brand-accent hover:bg-brand-accent/30'
                              : 'bg-gray-800 text-gray-500 hover:bg-gray-700',
                          )}
                          title={prompt.is_active ? 'Desactivar' : 'Activar'}
                        >
                          {prompt.is_active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                        </button>
                      </div>

                      {prompt.description && (
                        <p className="text-sm text-gray-400 mb-3">
                          {prompt.description}
                        </p>
                      )}

                      <div className="rounded-lg bg-[#0a0a0a] border border-gray-800 p-3 mb-3">
                        <pre
                          className={cn(
                            'text-xs text-gray-300 font-mono whitespace-pre-wrap break-words',
                            !isExpanded && 'line-clamp-3',
                          )}
                        >
                          {prompt.prompt_text}
                        </pre>
                        {prompt.prompt_text.length > 200 && (
                          <button
                            onClick={() => toggleExpanded(prompt.id)}
                            className="mt-2 flex items-center gap-1 text-[11px] text-brand-accent hover:text-brand-accent/80"
                          >
                            {isExpanded ? (
                              <>
                                <ChevronUp className="h-3 w-3" /> Colapsar
                              </>
                            ) : (
                              <>
                                <ChevronDown className="h-3 w-3" /> Ver completo
                              </>
                            )}
                          </button>
                        )}
                      </div>

                      {prompt.variables && prompt.variables.length > 0 && (
                        <div className="mb-3">
                          <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Inputs en cada llamada</p>
                          <div className="flex flex-wrap gap-1">
                            {prompt.variables.map((variable) => {
                              const isImage = variable.startsWith('@');
                              const display = isImage ? variable.slice(1) : variable;
                              return (
                                <span
                                  key={variable}
                                  className={cn(
                                    'text-xs px-2 py-1 rounded-md font-mono inline-flex items-center gap-1',
                                    isImage
                                      ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
                                      : 'bg-gray-800 text-gray-300',
                                  )}
                                  title={isImage ? 'Imagen adjunta como image_url block' : 'Variable de texto sustituida en el prompt'}
                                >
                                  {isImage ? '🖼️' : '{}'} {display}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2 pt-3 border-t border-gray-800">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(prompt)}
                          className="flex-1"
                        >
                          <Edit className="mr-2 h-3 w-3" />
                          Editar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(prompt)}
                          className="text-red-500 hover:text-red-600 hover:border-red-600"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
      </div>

      {/* Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          resetForm();
        }}
        title={editingPrompt ? 'Editar Prompt' : 'Nuevo Prompt'}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Clave (Key) *</Label>
              <Input
                value={formData.key}
                onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                placeholder="ej: product_analysis"
                disabled={!!editingPrompt}
              />
            </div>
            <div>
              <Label>Categoría *</Label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full rounded-lg border border-gray-800 bg-[#1a1a1a] px-4 py-2 text-white"
              >
                {CATEGORIES.map(cat => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <Label>Nombre *</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ej: Análisis de Producto"
            />
          </div>

          <div>
            <Label>Descripción</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Breve descripción de qué hace este prompt..."
              rows={2}
              className="bg-[#0a0a0a] border-gray-800"
            />
          </div>

          <div>
            <Label>Texto del Prompt *</Label>
            <Textarea
              value={formData.prompt_text}
              onChange={(e) => setFormData({ ...formData, prompt_text: e.target.value })}
              placeholder="You are an expert..."
              rows={18}
              className="bg-[#0a0a0a] border-gray-800 font-mono text-sm min-h-[400px] max-h-[60vh]"
            />
            <p className="mt-1 text-xs text-gray-500">
              Este es el prompt que se enviará al modelo de IA · {formData.prompt_text.length.toLocaleString()} caracteres
            </p>
          </div>

          <div>
            <Label>Variables (separadas por comas)</Label>
            <Input
              value={formData.variables}
              onChange={(e) => setFormData({ ...formData, variables: e.target.value })}
              placeholder="TEMPLATE_JSON, PRODUCT_NAME, @PRODUCT_IMAGES"
            />
            <p className="mt-1 text-xs text-gray-500">
              Documentación de los inputs que recibe esta llamada.
              <br />
              <span className="text-gray-300">{'{TEXT}'}</span> = variable de texto sustituida en el prompt vía <code>{'{NAME}'}</code> placeholder.
              <br />
              <span className="text-purple-300">@IMAGE</span> = imagen adjunta a la request como <code>image_url</code> block (se prefija con <code>@</code>). No se sustituye en el texto.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="h-4 w-4 rounded border-gray-700 bg-gray-900 text-brand-accent"
            />
            <Label htmlFor="is_active" className="cursor-pointer">
              Prompt activo
            </Label>
          </div>

          <Button
            onClick={handleSubmit}
            className="w-full bg-brand-accent hover:bg-brand-accent/90"
            disabled={createPrompt.isPending || updatePrompt.isPending}
          >
            {(createPrompt.isPending || updatePrompt.isPending) ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : (
              editingPrompt ? 'Actualizar' : 'Crear'
            )}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
