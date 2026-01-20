'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Modal } from '@/components/ui/modal';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Loader2, Eye, EyeOff, Code2, Sparkles } from 'lucide-react';
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

const CATEGORIES = [
  { value: 'image_generation', label: 'Generación de Imágenes' },
  { value: 'image_editing', label: 'Edición de Imágenes' },
  { value: 'analysis', label: 'Análisis' },
  { value: 'copywriting', label: 'Copywriting' },
  { value: 'other', label: 'Otro' }
];

export function PromptsManager() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<AIPrompt | null>(null);
  const [formData, setFormData] = useState({
    key: '',
    name: '',
    category: 'image_generation',
    prompt_text: '',
    description: '',
    variables: '',
    is_active: true
  });

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
      if (!response.ok) throw new Error('Failed to create prompt');
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
      if (!response.ok) throw new Error('Failed to update prompt');
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
      if (!response.ok) throw new Error('Failed to delete prompt');
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
      if (!response.ok) throw new Error('Failed to toggle prompt');
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
      category: 'image_generation',
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

  const getCategoryLabel = (category: string) => {
    return CATEGORIES.find(c => c.value === category)?.label || category;
  };

  const groupedPrompts = prompts?.reduce((acc, prompt) => {
    if (!acc[prompt.category]) {
      acc[prompt.category] = [];
    }
    acc[prompt.category].push(prompt);
    return acc;
  }, {} as Record<string, AIPrompt[]>);

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
          <h2 className="text-2xl font-bold text-white">Gestión de Prompts IA</h2>
          <p className="mt-1 text-sm text-gray-400">
            Configura y personaliza los prompts del sistema para cada proceso de IA
          </p>
        </div>
        <Button 
          onClick={() => setIsModalOpen(true)} 
          className="bg-brand-accent hover:bg-brand-accent/90"
        >
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Prompt
        </Button>
      </div>

      {/* Grouped by Category */}
      <div className="space-y-8">
        {groupedPrompts && Object.entries(groupedPrompts).map(([category, categoryPrompts]) => (
          <div key={category} className="space-y-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-brand-accent" />
              {getCategoryLabel(category)}
            </h3>
            
            <div className="grid gap-4 md:grid-cols-2">
              {categoryPrompts.map((prompt) => (
                <div
                  key={prompt.id}
                  className={cn(
                    "rounded-xl border bg-[#141414] p-5 transition-all",
                    prompt.is_active ? "border-gray-800" : "border-gray-800/50 opacity-60"
                  )}
                >
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-white">{prompt.name}</h4>
                        {!prompt.is_active && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">
                            Inactivo
                          </span>
                        )}
                      </div>
                      <code className="text-xs text-brand-accent/80 font-mono">
                        {prompt.key}
                      </code>
                    </div>
                    
                    <button
                      onClick={() => toggleActive.mutate({ id: prompt.id, is_active: !prompt.is_active })}
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
                        prompt.is_active 
                          ? "bg-brand-accent/20 text-brand-accent hover:bg-brand-accent/30"
                          : "bg-gray-800 text-gray-500 hover:bg-gray-700"
                      )}
                      title={prompt.is_active ? "Desactivar" : "Activar"}
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
                    <p className="text-xs text-gray-300 font-mono line-clamp-3 whitespace-pre-wrap">
                      {prompt.prompt_text}
                    </p>
                  </div>

                  {prompt.variables && prompt.variables.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {prompt.variables.map((variable) => (
                        <span
                          key={variable}
                          className="text-xs px-2 py-1 rounded-md bg-gray-800 text-gray-300 font-mono"
                        >
                          {variable}
                        </span>
                      ))}
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
              ))}
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
              rows={8}
              className="bg-[#0a0a0a] border-gray-800 font-mono text-sm"
            />
            <p className="mt-1 text-xs text-gray-500">
              Este es el prompt que se enviará al modelo de IA
            </p>
          </div>

          <div>
            <Label>Variables (separadas por comas)</Label>
            <Input
              value={formData.variables}
              onChange={(e) => setFormData({ ...formData, variables: e.target.value })}
              placeholder="productName, productImage, templateName"
            />
            <p className="mt-1 text-xs text-gray-500">
              Variables que este prompt utiliza (para documentación)
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
