'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Modal } from '@/components/ui/modal';
import { toast } from 'sonner';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { prettyName } from '@/lib/pretty-name';

export function TemplatesManager() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    thumbnail_url: '',
    canva_url: '',
    category: '',
    awareness_level: '',
    niche: '',
  });

  const supabase = createClient();
  const queryClient = useQueryClient();

  const { data: templates, isLoading } = useQuery({
    queryKey: ['admin-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('templates')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createTemplate = useMutation({
    mutationFn: async (data: typeof formData) => {
      // Filter out empty strings for optional fields
      const cleanData = {
        name: data.name,
        thumbnail_url: data.thumbnail_url,
        canva_url: data.canva_url,
        ...(data.category && { category: data.category }),
        ...(data.awareness_level && { awareness_level: data.awareness_level }),
        ...(data.niche && { niche: data.niche }),
      };
      
      const { error } = await supabase.from('templates').insert([cleanData]);
      if (error) {
        console.error('Error creating template:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-templates'] });
      setIsModalOpen(false);
      resetForm();
      toast.success('Plantilla creada');
    },
    onError: (error: any) => {
      console.error('Create template error:', error);
      toast.error(error.message || 'Error al crear plantilla');
    },
  });

  const updateTemplate = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      // Filter out empty strings for optional fields
      const cleanData = {
        name: data.name,
        thumbnail_url: data.thumbnail_url,
        canva_url: data.canva_url,
        ...(data.category && { category: data.category }),
        ...(data.awareness_level && { awareness_level: data.awareness_level }),
        ...(data.niche && { niche: data.niche }),
      };
      
      const { error } = await supabase.from('templates').update(cleanData).eq('id', id);
      if (error) {
        console.error('Error updating template:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-templates'] });
      setIsModalOpen(false);
      resetForm();
      toast.success('Plantilla actualizada');
    },
    onError: (error: any) => {
      console.error('Update template error:', error);
      toast.error(error.message || 'Error al actualizar plantilla');
    },
  });

  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('templates').delete().eq('id', id);
      if (error) {
        console.error('Error deleting template:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-templates'] });
      toast.success('Plantilla eliminada');
    },
    onError: (error: any) => {
      console.error('Delete template error:', error);
      toast.error(error.message || 'Error al eliminar plantilla');
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      thumbnail_url: '',
      canva_url: '',
      category: '',
      awareness_level: '',
      niche: '',
    });
    setEditingTemplate(null);
  };

  const handleEdit = (template: any) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      thumbnail_url: template.thumbnail_url,
      canva_url: template.canva_url,
      category: template.category || '',
      awareness_level: template.awareness_level || '',
      niche: template.niche || '',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = () => {
    if (editingTemplate) {
      updateTemplate.mutate({ id: editingTemplate.id, data: formData });
    } else {
      createTemplate.mutate(formData);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white">Plantillas de Static Ads</h2>
        <Button onClick={() => setIsModalOpen(true)} className="bg-brand-accent hover:bg-brand-accent/90">
          <Plus className="mr-2 h-4 w-4" />
          Nueva Plantilla
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {templates?.map((template) => (
          <div key={template.id} className="group relative overflow-hidden rounded-2xl border border-gray-800 bg-[#141414]">
            <div className="aspect-[3/4] overflow-hidden bg-gray-900">{/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={template.thumbnail_url} alt={template.name} className="h-full w-full object-cover" />
            </div>
            <div className="p-4">
              <h3 className="font-semibold text-white">{prettyName(template.name)}</h3>
              <p className="mt-1 text-xs text-gray-400">{template.category}</p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => handleEdit(template)}>
                  <Edit className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="outline" onClick={() => deleteTemplate.mutate(template.id)} className="text-red-500 hover:text-red-600">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); resetForm(); }} title={editingTemplate ? 'Editar Plantilla' : 'Nueva Plantilla'}>
        <div className="space-y-4">
          <div>
            <Label>Nombre</Label>
            <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
          </div>
          <div>
            <Label>URL Thumbnail</Label>
            <Input value={formData.thumbnail_url} onChange={(e) => setFormData({ ...formData, thumbnail_url: e.target.value })} />
          </div>
          <div>
            <Label>URL Canva</Label>
            <Input value={formData.canva_url} onChange={(e) => setFormData({ ...formData, canva_url: e.target.value })} />
          </div>
          <div>
            <Label>Categoría</Label>
            <Input value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} />
          </div>
          <div>
            <Label>Nivel de Consciencia</Label>
            <select value={formData.awareness_level} onChange={(e) => setFormData({ ...formData, awareness_level: e.target.value })} className="w-full rounded-lg border border-gray-800 bg-[#1a1a1a] px-4 py-2 text-white">
              <option value="">Seleccionar</option>
              <option value="unaware">Unaware</option>
              <option value="problem-aware">Problem Aware</option>
              <option value="solution-aware">Solution Aware</option>
            </select>
          </div>
          <div>
            <Label>Nicho</Label>
            <Input value={formData.niche} onChange={(e) => setFormData({ ...formData, niche: e.target.value })} />
          </div>
          <Button onClick={handleSubmit} className="w-full bg-brand-accent hover:bg-brand-accent/90" disabled={!formData.name || !formData.thumbnail_url || !formData.canva_url}>
            {editingTemplate ? 'Actualizar' : 'Crear'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

