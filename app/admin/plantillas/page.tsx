'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Edit, Trash2, ExternalLink } from 'lucide-react';

export default function PlantillasPage() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    thumbnail_url: '',
    canva_url: '',
    category: '',
    awareness_level: '',
    niche: '',
  });

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const { data } = await supabase
        .from('templates')
        .select('*')
        .order('created_at', { ascending: false });

      setTemplates(data || []);
    } catch (error) {
      console.error('Error loading templates:', error);
    }
  };

  const saveTemplate = async () => {
    try {
      await supabase.from('templates').insert(formData);
      setFormData({
        name: '',
        thumbnail_url: '',
        canva_url: '',
        category: '',
        awareness_level: '',
        niche: '',
      });
      setShowForm(false);
      loadTemplates();
    } catch (error) {
      console.error('Error saving template:', error);
    }
  };

  const deleteTemplate = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta plantilla?')) return;

    try {
      await supabase.from('templates').delete().eq('id', id);
      loadTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Plantillas</h1>
          <p className="mt-2 text-gray-400">Gestión de plantillas de Static Ads</p>
        </div>

        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 rounded-lg bg-brand-accent px-4 py-2 text-white hover:bg-brand-accent/90"
        >
          <Plus className="h-5 w-5" />
          Nueva Plantilla
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="rounded-lg border border-gray-700 bg-brand-dark-secondary p-6">
          <h3 className="mb-4 text-lg font-semibold text-white">Agregar Plantilla</h3>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm text-gray-400">Nombre</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full rounded-lg border border-gray-700 bg-brand-dark-primary px-4 py-2 text-white"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-gray-400">URL Thumbnail</label>
              <input
                type="text"
                value={formData.thumbnail_url}
                onChange={(e) => setFormData({ ...formData, thumbnail_url: e.target.value })}
                className="w-full rounded-lg border border-gray-700 bg-brand-dark-primary px-4 py-2 text-white"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-gray-400">URL Canva</label>
              <input
                type="text"
                value={formData.canva_url}
                onChange={(e) => setFormData({ ...formData, canva_url: e.target.value })}
                className="w-full rounded-lg border border-gray-700 bg-brand-dark-primary px-4 py-2 text-white"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-gray-400">Categoría</label>
              <input
                type="text"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full rounded-lg border border-gray-700 bg-brand-dark-primary px-4 py-2 text-white"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-gray-400">Nivel de Consciencia</label>
              <select
                value={formData.awareness_level}
                onChange={(e) => setFormData({ ...formData, awareness_level: e.target.value })}
                className="w-full rounded-lg border border-gray-700 bg-brand-dark-primary px-4 py-2 text-white"
              >
                <option value="">Seleccionar...</option>
                <option value="unaware">Unaware</option>
                <option value="problem-aware">Problem Aware</option>
                <option value="solution-aware">Solution Aware</option>
                <option value="product-aware">Product Aware</option>
                <option value="most-aware">Most Aware</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm text-gray-400">Nicho</label>
              <input
                type="text"
                value={formData.niche}
                onChange={(e) => setFormData({ ...formData, niche: e.target.value })}
                className="w-full rounded-lg border border-gray-700 bg-brand-dark-primary px-4 py-2 text-white"
              />
            </div>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={() => setShowForm(false)}
              className="rounded-lg bg-gray-700 px-4 py-2 text-white"
            >
              Cancelar
            </button>
            <button
              onClick={saveTemplate}
              className="rounded-lg bg-brand-accent px-4 py-2 text-white"
            >
              Guardar
            </button>
          </div>
        </div>
      )}

      {/* Templates Grid */}
      <div className="grid gap-6 md:grid-cols-3 lg:grid-cols-4">
        {templates.map((template) => (
          <div
            key={template.id}
            className="group relative overflow-hidden rounded-lg border border-gray-700 bg-brand-dark-secondary"
          >
            <img
              src={template.thumbnail_url}
              alt={template.name}
              className="aspect-square w-full object-cover"
            />

            {/* Overlay */}
            <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/70 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                onClick={() => window.open(template.canva_url, '_blank')}
                className="rounded-lg bg-brand-accent p-2"
              >
                <ExternalLink className="h-5 w-5" />
              </button>
              <button className="rounded-lg bg-blue-600 p-2">
                <Edit className="h-5 w-5" />
              </button>
              <button
                onClick={() => deleteTemplate(template.id)}
                className="rounded-lg bg-red-600 p-2"
              >
                <Trash2 className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4">
              <p className="text-sm font-medium text-white">{template.name}</p>
              <p className="mt-1 text-xs text-gray-400">
                {template.view_count} vistas · {template.edit_count} ediciones
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

