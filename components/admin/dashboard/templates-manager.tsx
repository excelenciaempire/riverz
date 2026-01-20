'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/admin/ui/button';
import { Input } from '@/components/admin/ui/input';
import { Label } from '@/components/admin/ui/label';
import { Modal } from '@/components/admin/ui/modal';
import { FileUpload } from '@/components/admin/ui/file-upload';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Loader2 } from 'lucide-react';

export function TemplatesManager() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    thumbnail_url: '',
    category: '',
    awareness_level: '',
    niche: '',
  });
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const queryClient = useQueryClient();

  const { data: templates, isLoading } = useQuery({
    queryKey: ['admin-templates'],
    queryFn: async () => {
      const res = await fetch('/api/admin/templates');
      if (!res.ok) throw new Error('Failed to fetch templates');
      const data = await res.json();
      return data.templates || [];
    },
  });

  const createTemplate = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await fetch('/api/admin/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          thumbnail_url: data.thumbnail_url,
          category: data.category || null,
          awareness_level: data.awareness_level || null,
          niche: data.niche || null,
        }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to create template');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-templates'] });
      setIsModalOpen(false);
      resetForm();
      toast.success('Plantilla creada');
    },
    onError: (error: any) => {
      console.error('Create template mutation error:', error);
      toast.error(error.message || 'Error al crear plantilla');
    },
  });

  const updateTemplate = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const res = await fetch(`/api/admin/templates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          thumbnail_url: data.thumbnail_url,
          category: data.category || null,
          awareness_level: data.awareness_level || null,
          niche: data.niche || null,
        }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to update template');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-templates'] });
      setIsModalOpen(false);
      resetForm();
      toast.success('Plantilla actualizada');
    },
    onError: (error: any) => {
      console.error('Update template mutation error:', error);
      toast.error(error.message || 'Error al actualizar plantilla');
    },
  });

  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/templates?id=${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to delete template');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-templates'] });
      toast.success('Plantilla eliminada');
    },
    onError: (error: any) => {
      console.error('Delete template mutation error:', error);
      toast.error(error.message || 'Error al eliminar plantilla');
    },
  });

  const uploadImage = async (file: File): Promise<string> => {
    const uploadFormData = new FormData();
    uploadFormData.append('file', file);
    
    const res = await fetch('/api/admin/upload', {
      method: 'POST',
      body: uploadFormData,
    });
    
    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || 'Failed to upload image');
    }
    
    const data = await res.json();
    return data.url;
  };

  const resetForm = () => {
    setFormData({
      name: '',
      thumbnail_url: '',
      category: '',
      awareness_level: '',
      niche: '',
    });
    setEditingTemplate(null);
    setSelectedImage(null);
  };

  const handleEdit = (template: any) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      thumbnail_url: template.thumbnail_url,
      category: template.category || '',
      awareness_level: template.awareness_level || '',
      niche: template.niche || '',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      setIsUploading(true);
      let thumbnailUrl = formData.thumbnail_url;

      // If a new image is selected, upload it
      if (selectedImage) {
        thumbnailUrl = await uploadImage(selectedImage);
      }

      const dataToSubmit = {
        ...formData,
        thumbnail_url: thumbnailUrl,
      };

      if (editingTemplate) {
        updateTemplate.mutate({ id: editingTemplate.id, data: dataToSubmit });
      } else {
        if (!thumbnailUrl) {
          toast.error('Por favor selecciona una imagen');
          setIsUploading(false);
          return;
        }
        createTemplate.mutate(dataToSubmit);
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Error al subir la imagen');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (template: any) => {
    if (!confirm(`¿Estás seguro de eliminar "${template.name}"?`)) return;
    deleteTemplate.mutate(template.id);
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
              <h3 className="font-semibold text-white">{template.name}</h3>
              <p className="mt-1 text-xs text-gray-400">{template.category}</p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => handleEdit(template)}>
                  <Edit className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleDelete(template)} className="text-red-500 hover:text-red-600">
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
            <Input 
              value={formData.name} 
              onChange={(e) => setFormData({ ...formData, name: e.target.value })} 
              placeholder="Ej: Template Vitaminas"
            />
          </div>
          
          <div>
            <Label className="mb-2 block">Imagen de Plantilla</Label>
            {(selectedImage || formData.thumbnail_url) ? (
              <div className="space-y-3">
                <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg border border-gray-800">
                  <img 
                    src={selectedImage ? URL.createObjectURL(selectedImage) : formData.thumbnail_url} 
                    alt="Preview" 
                    className="h-full w-full object-cover"
                  />
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    setSelectedImage(null);
                    if (!editingTemplate) {
                      setFormData({ ...formData, thumbnail_url: '' });
                    }
                  }}
                  className="w-full"
                >
                  Cambiar Imagen
                </Button>
              </div>
            ) : (
              <FileUpload
                onFilesSelected={(files) => {
                  if (files[0]) {
                    setSelectedImage(files[0]);
                  }
                }}
                accept={{ 'image/*': ['.jpg', '.jpeg', '.png', '.webp'] }}
                maxSize={50 * 1024 * 1024}
                variant="minimal"
                hideFileList
              />
            )}
          </div>

          <div>
            <Label>Categoría</Label>
            <Input 
              value={formData.category} 
              onChange={(e) => setFormData({ ...formData, category: e.target.value })} 
              placeholder="Ej: carousel, single, story"
            />
          </div>

          <div>
            <Label>Nivel de Consciencia</Label>
            <select 
              value={formData.awareness_level} 
              onChange={(e) => setFormData({ ...formData, awareness_level: e.target.value })} 
              className="w-full rounded-lg border border-gray-800 bg-[#1a1a1a] px-4 py-2 text-white"
            >
              <option value="">Seleccionar</option>
              <option value="unaware">Unaware</option>
              <option value="problem-aware">Problem Aware</option>
              <option value="solution-aware">Solution Aware</option>
            </select>
          </div>

          <div>
            <Label>Nicho</Label>
            <Input 
              value={formData.niche} 
              onChange={(e) => setFormData({ ...formData, niche: e.target.value })} 
              placeholder="Ej: health, beauty, fitness"
            />
          </div>

          <Button 
            onClick={handleSubmit} 
            className="w-full bg-brand-accent hover:bg-brand-accent/90" 
            disabled={!formData.name || (!selectedImage && !formData.thumbnail_url) || isUploading}
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Subiendo...
              </>
            ) : (
              editingTemplate ? 'Actualizar' : 'Crear'
            )}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

