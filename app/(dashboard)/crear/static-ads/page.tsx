'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useUser } from '@clerk/nextjs';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { ExternalLink } from 'lucide-react';
import type { Template, Product } from '@/types';

type TabType = 'plantillas' | 'ideacion';

export default function StaticAdsPage() {
  const { user } = useUser();
  const [activeTab, setActiveTab] = useState<TabType>('plantillas');
  const [selectedFilters, setSelectedFilters] = useState({
    awarenessLevel: 'all',
    niche: 'all',
    type: 'all',
  });

  const supabase = createClient();

  // Fetch user data for plan check
  const { data: userData } = useQuery({
    queryKey: ['user', user?.id],
    queryFn: async () => {
      const response = await fetch('/api/user');
      if (!response.ok) throw new Error('Failed to fetch user');
      return response.json();
    },
    enabled: !!user,
  });

  // Fetch templates
  const { data: templates, isLoading } = useQuery({
    queryKey: ['templates', selectedFilters],
    queryFn: async () => {
      let query = supabase.from('templates').select('*');

      if (selectedFilters.awarenessLevel !== 'all') {
        query = query.eq('awareness_level', selectedFilters.awarenessLevel);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Template[];
    },
  });

  // Fetch user products for ideation
  const { data: products } = useQuery({
    queryKey: ['products', user?.id],
    queryFn: async () => {
      const { data: userDataLocal } = await supabase
        .from('users')
        .select('id')
        .eq('clerk_id', user!.id)
        .single();

      if (!userDataLocal) return [];

      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('user_id', userDataLocal.id);

      if (error) throw error;
      return data as Product[];
    },
    enabled: !!user && activeTab === 'ideacion',
  });

  // Fetch ad concepts (generated from products)
  const { data: adConcepts } = useQuery({
    queryKey: ['ad-concepts', products?.[0]?.id],
    queryFn: async () => {
      if (!products || products.length === 0) return null;

      const response = await fetch('/api/static-ads/ideate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: products[0].id }),
      });

      if (!response.ok) throw new Error('Failed to fetch concepts');
      return response.json();
    },
    enabled: !!products && products.length > 0 && activeTab === 'ideacion',
  });

  const canEditTemplate = (index: number) => {
    if (userData?.plan_type !== 'free') return true;
    return index < 3; // Free users can edit first 3 templates
  };

  const handleTemplateClick = (template: Template, index: number) => {
    if (!canEditTemplate(index)) {
      toast.error('Actualiza tu plan para editar más plantillas');
      return;
    }

    // Track edit
    supabase
      .from('templates')
      .update({ edit_count: template.edit_count + 1 })
      .eq('id', template.id)
      .then(() => {
        window.open(template.canva_url, '_blank');
      });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-white">STATIC ADS</h1>

      {/* Tabs */}
      <div className="border-b border-gray-700">
        <div className="flex gap-8">
          <button
            onClick={() => setActiveTab('plantillas')}
            className={`pb-4 ${
              activeTab === 'plantillas'
                ? 'border-b-2 border-brand-accent text-white'
                : 'text-gray-400'
            }`}
          >
            Plantillas
          </button>
          <button
            onClick={() => setActiveTab('ideacion')}
            className={`pb-4 ${
              activeTab === 'ideacion'
                ? 'border-b-2 border-brand-accent text-white'
                : 'text-gray-400'
            }`}
          >
            Ideación
          </button>
        </div>
      </div>

      {/* PLANTILLAS TAB */}
      {activeTab === 'plantillas' && (
        <div>
          {/* Filters */}
          <div className="mb-6 flex gap-4">
            <select
              value={selectedFilters.awarenessLevel}
              onChange={(e) =>
                setSelectedFilters({
                  ...selectedFilters,
                  awarenessLevel: e.target.value,
                })
              }
              className="rounded-lg border border-gray-700 bg-brand-dark-secondary px-4 py-2 text-white"
            >
              <option value="all">Todos los niveles</option>
              <option value="unaware">Unaware</option>
              <option value="problem-aware">Problem Aware</option>
              <option value="solution-aware">Solution Aware</option>
              <option value="product-aware">Product Aware</option>
              <option value="most-aware">Most Aware</option>
            </select>

            <select
              value={selectedFilters.niche}
              onChange={(e) =>
                setSelectedFilters({ ...selectedFilters, niche: e.target.value })
              }
              className="rounded-lg border border-gray-700 bg-brand-dark-secondary px-4 py-2 text-white"
            >
              <option value="all">Todos los nichos</option>
              <option value="health">Salud</option>
              <option value="beauty">Belleza</option>
              <option value="tech">Tecnología</option>
              <option value="fashion">Moda</option>
            </select>

            <select
              value={selectedFilters.type}
              onChange={(e) =>
                setSelectedFilters({ ...selectedFilters, type: e.target.value })
              }
              className="rounded-lg border border-gray-700 bg-brand-dark-secondary px-4 py-2 text-white"
            >
              <option value="all">Todos los tipos</option>
              <option value="carousel">Carousel</option>
              <option value="single">Single Image</option>
              <option value="video">Video</option>
            </select>
          </div>

          {/* Templates Grid */}
          {isLoading ? (
            <div className="text-center text-gray-400">Cargando plantillas...</div>
          ) : (
            <div className="grid gap-6 md:grid-cols-3 lg:grid-cols-4">
              {templates?.map((template, index) => (
                <div
                  key={template.id}
                  className="group relative overflow-hidden rounded-lg border border-gray-700 bg-brand-dark-secondary transition hover:border-brand-accent"
                >
                  <img
                    src={template.thumbnail_url}
                    alt={template.name}
                    className="aspect-square w-full object-cover"
                  />

                  {/* Hover Overlay */}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/70 opacity-0 transition-opacity group-hover:opacity-100">
                    {canEditTemplate(index) ? (
                      <button
                        onClick={() => handleTemplateClick(template, index)}
                        className="flex items-center gap-2 rounded-lg bg-brand-accent px-4 py-2 font-medium text-white hover:bg-brand-accent/90"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Abrir en Canva
                      </button>
                    ) : (
                      <div className="text-center">
                        <p className="font-medium text-white">
                          Upgrade para editar
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="p-3">
                    <p className="text-sm font-medium text-white">
                      {template.name}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* IDEACIÓN TAB */}
      {activeTab === 'ideacion' && (
        <div className="space-y-8">
          {!products || products.length === 0 ? (
            <div className="rounded-lg border border-gray-700 bg-brand-dark-secondary p-8 text-center">
              <p className="text-gray-400">
                Primero debes agregar un producto en la sección de Marcas para ver ideas de anuncios.
              </p>
            </div>
          ) : adConcepts ? (
            <>
              {['Unaware', 'Problem Aware', 'Solution Aware', 'Product Aware', 'Most Aware'].map((level) => (
                <div key={level}>
                  <h3 className="mb-4 text-xl font-semibold text-white">
                    {level}
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div
                        key={i}
                        className="rounded-lg border border-gray-700 bg-brand-dark-secondary p-6"
                      >
                        <h4 className="mb-2 font-semibold text-brand-accent">
                          Concepto {i}
                        </h4>
                        <p className="text-sm text-gray-300">
                          Idea de anuncio basada en tu producto con enfoque en {level}...
                        </p>
                        <div className="mt-4 flex gap-2">
                          <button className="text-xs text-brand-accent hover:underline">
                            Ver más
                          </button>
                          <button className="text-xs text-brand-accent hover:underline">
                            Copiar idea
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </>
          ) : (
            <div className="text-center text-gray-400">Cargando conceptos...</div>
          )}
        </div>
      )}
    </div>
  );
}

