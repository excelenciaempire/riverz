'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Dropdown } from '@/components/ui/dropdown';
import { toast } from 'sonner';
import { ExternalLink, Star, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Template, Product } from '@/types';

type TabType = 'plantillas' | 'ideacion';

const awarenessLevels = [
  'Unaware - Crear Consciencia',
  'Problem Aware - Identificar Dolor',
  'Solution Aware - Presentar Categoría'
];

export default function StaticAdsPage() {
  const { user } = useUser();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('plantillas');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [awarenessFilter, setAwarenessFilter] = useState('all');
  const [nicheFilter, setNicheFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

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
    queryKey: ['templates', awarenessFilter, nicheFilter, typeFilter],
    queryFn: async () => {
      let query = supabase.from('templates').select('*');

      if (awarenessFilter !== 'all') {
        query = query.eq('awareness_level', awarenessFilter);
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
    queryKey: ['ad-concepts', selectedProduct],
    queryFn: async () => {
      if (!selectedProduct) return null;

      const response = await fetch('/api/static-ads/ideate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: selectedProduct }),
      });

      if (!response.ok) throw new Error('Failed to fetch concepts');
      return response.json();
    },
    enabled: !!selectedProduct && activeTab === 'ideacion',
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
    window.open(template.canva_url, '_blank');
  };

  return (
    <div className="mx-auto max-w-[1800px]">
      {/* Back Button */}
      <button
        onClick={() => router.push('/crear')}
        className="mb-4 flex items-center gap-2 text-gray-400 transition hover:text-white"
      >
        <ArrowLeft className="h-5 w-5" />
        <span className="text-sm">Volver</span>
      </button>

      {/* Tabs */}
      <div className="mb-8 flex gap-6 border-b border-gray-800">
        <button
          onClick={() => setActiveTab('plantillas')}
          className={cn(
            'pb-3 text-lg transition',
            activeTab === 'plantillas'
              ? 'border-b-2 border-white font-medium text-white'
              : 'text-gray-400 hover:text-white'
          )}
        >
          Plantillas
        </button>
        <button
          onClick={() => setActiveTab('ideacion')}
          className={cn(
            'pb-3 text-lg transition',
            activeTab === 'ideacion'
              ? 'border-b-2 border-white font-medium text-white'
              : 'text-gray-400 hover:text-white'
          )}
        >
          Ideación
        </button>
      </div>

      {/* PLANTILLAS Tab */}
      {activeTab === 'plantillas' && (
        <div className="space-y-6">
          {/* Filters */}
          <div className="flex gap-4">
            <div className="flex-1">
              <Dropdown
                options={[
                  { value: 'all', label: 'Todos los niveles' },
                  { value: 'unaware', label: 'Unaware' },
                  { value: 'problem-aware', label: 'Problem Aware' },
                  { value: 'solution-aware', label: 'Solution Aware' },
                ]}
                value={awarenessFilter}
                onChange={setAwarenessFilter}
                placeholder="Nivel de consciencia"
              />
            </div>
            <div className="flex-1">
              <Dropdown
                options={[
                  { value: 'all', label: 'Todos los nichos' },
                  { value: 'health', label: 'Salud' },
                  { value: 'beauty', label: 'Belleza' },
                  { value: 'fitness', label: 'Fitness' },
                ]}
                value={nicheFilter}
                onChange={setNicheFilter}
                placeholder="Nicho"
              />
            </div>
            <div className="flex-1">
              <Dropdown
                options={[
                  { value: 'all', label: 'Todos los tipos' },
                  { value: 'carousel', label: 'Carousel' },
                  { value: 'story', label: 'Story' },
                  { value: 'post', label: 'Post' },
                ]}
                value={typeFilter}
                onChange={setTypeFilter}
                placeholder="Tipo"
              />
            </div>
          </div>

          {/* Templates Grid */}
          {isLoading ? (
            <div className="text-center text-gray-400">Cargando plantillas...</div>
          ) : (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
              {templates?.map((template, index) => (
                <div
                  key={template.id}
                  className="group relative aspect-[3/4] overflow-hidden rounded-lg border-2 border-gray-700 bg-[#1a2332] cursor-pointer transition hover:border-brand-accent"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && handleTemplateClick(template, index)}
                  onClick={() => handleTemplateClick(template, index)}
                >
                  <img
                    src={template.thumbnail_url}
                    alt={template.name}
                    className="h-full w-full object-cover"
                  />
                  
                  {/* Hover Overlay */}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition group-hover:opacity-100">
                    {canEditTemplate(index) ? (
                      <div className="text-center">
                        <ExternalLink className="mx-auto mb-2 h-8 w-8 text-brand-accent" />
                        <p className="text-sm font-medium text-white">Abrir en Canva</p>
                      </div>
                    ) : (
                      <div className="text-center px-4">
                        <p className="text-sm font-medium text-yellow-400">Upgrade para editar</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* IDEACIÓN Tab */}
      {activeTab === 'ideacion' && (
        <div className="space-y-6">
          {/* Product Selector */}
          <div className="mx-auto max-w-md">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                // Open product selector modal
              }}
            >
              Seleccionar Producto
            </Button>
          </div>

          {selectedProduct || adConcepts ? (
            <div className="space-y-8">
              {awarenessLevels.map((level, levelIndex) => (
                <div key={levelIndex}>
                  {/* Level Header */}
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-accent text-sm font-bold text-white">
                      {levelIndex === 0 ? '💡' : levelIndex === 1 ? '⚠️' : '✨'}
                    </div>
                    <h3 className="text-lg font-semibold text-white">{level}</h3>
                  </div>

                  {/* Concepts Grid */}
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {[...Array(5)].map((_, index) => (
                      <div
                        key={index}
                        className="group rounded-lg border border-gray-700 bg-[#1a2332] p-4 transition hover:border-brand-accent"
                      >
                        <div className="mb-3 flex items-start justify-between">
                          <h4 className="text-sm font-medium text-brand-accent">
                            ¿Sabías que el {levelIndex * 20 + index * 5}% de las personas tienen déficit de vitamina?
                          </h4>
                          <button className="text-gray-400 hover:text-yellow-400">
                            <Star className="h-4 w-4" />
                          </button>
                        </div>
                        
                        <p className="mb-3 text-xs text-gray-400">
                          La mayoría ignora su cansancio, dolores y bajo humor pueden deberse a un déficit silencioso que impacta tu bienestar. Descubre cómo una pequeña cápsula puede transformar tu energía.
                        </p>

                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-brand-accent">CTA: Descubre Más</span>
                          <button className="rounded bg-gray-800 px-2 py-1 text-gray-300 hover:bg-gray-700">
                            Copiar Idea
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border-2 border-dashed border-gray-700 bg-[#1a2332] p-12 text-center">
              <p className="text-gray-400">
                Selecciona un producto para generar ideas de anuncios
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
