'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Dropdown } from '@/components/ui/dropdown';
import { toast } from 'sonner';
import { Star, Check, Loader2 } from 'lucide-react';
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
  
  // Multi-select state
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);
  const [isCloneBarVisible, setIsCloneBarVisible] = useState(false);
  
  // Project & Progress State
  const [projectName, setProjectName] = useState('');
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isProgressOpen, setIsProgressOpen] = useState(false);
  const [progressValue, setProgressValue] = useState(0);

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

  // Fetch user products for ideation and cloning
  const { data: products } = useQuery({
    queryKey: ['products', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('clerk_user_id', user.id);

      if (error) {
        console.error('Error fetching products:', error);
        return [];
      }
      return data as Product[];
    },
    enabled: !!user,
  });

  // Clone Mutation
  const cloneMutation = useMutation({
    mutationFn: async ({ templateIds, productId, projectName }: { templateIds: string[], productId: string, projectName: string }) => {
      const response = await fetch('/api/static-ads/clone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateIds, productId, projectName }),
      });
      
      if (!response.ok) {
        if (response.status === 402) throw new Error('Créditos insuficientes');
        throw new Error('Error al clonar plantillas');
      }
      return response.json();
    },
    onSuccess: (data) => {
      // Simulate progress for UX
      let progress = 0;
      const interval = setInterval(() => {
        progress += 10;
        setProgressValue(progress);
        if (progress >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            router.push(`/crear/static-ads/historial/${data.project.id}`);
          }, 500);
        }
      }, 200);
    },
    onError: (error) => {
      setIsProgressOpen(false);
      toast.error(error.message);
    }
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
    // Toggle selection
    const isSelected = selectedTemplateIds.includes(template.id);
    let newSelected: string[];
    
    if (isSelected) {
      newSelected = selectedTemplateIds.filter(id => id !== template.id);
    } else {
      newSelected = [...selectedTemplateIds, template.id];
    }
    
    setSelectedTemplateIds(newSelected);
    setIsCloneBarVisible(newSelected.length > 0);
  };

  const initiateCloneProcess = () => {
    if (!selectedProduct) {
      toast.error('Selecciona un producto primero');
      return;
    }
    setIsProjectModalOpen(true);
  };

  const confirmClone = () => {
    if (!projectName.trim()) {
      toast.error('Ingresa un nombre para el proyecto');
      return;
    }
    setIsProjectModalOpen(false);
    setIsProgressOpen(true);
    setProgressValue(10); // Start progress
    cloneMutation.mutate({ 
      templateIds: selectedTemplateIds, 
      productId: selectedProduct,
      projectName 
    });
  };

  return (
    <div className="mx-auto max-w-[1800px] pb-24">
      {/* Tabs - Pill Style */}
      <div className="mb-8 inline-flex gap-2 rounded-full bg-gray-900/50 p-1.5 border border-gray-800">
        <button
          onClick={() => setActiveTab('plantillas')}
          className={cn(
            'px-6 py-2.5 text-sm font-medium transition-all rounded-full',
            activeTab === 'plantillas'
              ? 'bg-brand-accent text-white shadow-lg shadow-brand-accent/20'
              : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
          )}
        >
          Plantillas
        </button>
        <button
          onClick={() => setActiveTab('ideacion')}
          className={cn(
            'px-6 py-2.5 text-sm font-medium transition-all rounded-full',
            activeTab === 'ideacion'
              ? 'bg-brand-accent text-white shadow-lg shadow-brand-accent/20'
              : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
          )}
        >
          Ideación
        </button>
      </div>

      {/* PLANTILLAS Tab */}
      {activeTab === 'plantillas' && (
        <div className="space-y-6">
          {/* Filters */}
          <div className="flex gap-4 items-center">
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
            {/* Select All Button */}
            <Button
              variant="outline"
              onClick={() => {
                if (templates && selectedTemplateIds.length === templates.length) {
                  setSelectedTemplateIds([]);
                  setIsCloneBarVisible(false);
                } else if (templates) {
                  setSelectedTemplateIds(templates.map(t => t.id));
                  setIsCloneBarVisible(true);
                }
              }}
              className="border-gray-700 text-gray-300 hover:text-white whitespace-nowrap"
            >
              {templates && selectedTemplateIds.length === templates.length ? 'Deseleccionar Todo' : 'Seleccionar Todo'}
            </Button>
          </div>

          {/* Templates Grid */}
          {isLoading ? (
            <div className="text-center text-gray-400">Cargando plantillas...</div>
          ) : (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
              {/* Select All / Deselect All Button (if needed outside) - but UI request says direct selector */}
              
              {templates?.map((template, index) => {
                const isSelected = selectedTemplateIds.includes(template.id);
                const canEdit = canEditTemplate(index);

                return (
                  <div
                    key={template.id}
                    className={cn(
                      "group relative aspect-3/4 overflow-hidden rounded-lg border-2 bg-[#1a2332] transition-all",
                      isSelected ? "border-[#07A498] ring-2 ring-[#07A498]/30" : "border-gray-700"
                    )}
                  >
                    <img
                      src={template.thumbnail_url}
                      alt={template.name}
                      className={cn("h-full w-full object-cover transition-transform duration-300", isSelected && "scale-105")}
                    />
                    
                    {/* Direct Selection Area / Overlay */}
                    <div 
                      className="absolute inset-0 z-10 cursor-pointer"
                      onClick={() => handleTemplateClick(template, index)}
                    />

                    {/* Selection Indicator */}
                    <div className={cn(
                      "absolute top-3 right-3 z-20 flex h-6 w-6 items-center justify-center rounded-full border transition-all pointer-events-none",
                      isSelected ? "bg-[#07A498] border-[#07A498] text-white" : "border-white/50 bg-black/30"
                    )}>
                      {isSelected && <Check className="h-4 w-4" />}
                    </div>
                    
                    {/* Hover Overlay - Premium Badge for Locked */}
                    {!canEdit && (
                      <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 opacity-0 transition group-hover:opacity-100">
                        <div className="text-center px-4">
                          <p className="text-sm font-medium text-yellow-400">Upgrade para editar</p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* IDEACIÓN Tab */}
      {activeTab === 'ideacion' && (
        <div className="space-y-6">
          {/* Product Selector */}
          <div className="mx-auto max-w-md">
             <Dropdown
                options={products?.map(p => ({ value: p.id, label: p.name })) || []}
                value={selectedProduct}
                onChange={setSelectedProduct}
                placeholder="Seleccionar Producto"
                className="w-full"
              />
          </div>

          {selectedProduct || adConcepts ? (
            <div className="space-y-8">
              {awarenessLevels.map((level, levelIndex) => (
                <div key={levelIndex}>
                  {/* Level Header */}
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#07A498] text-sm font-bold text-white">
                      {levelIndex === 0 ? '💡' : levelIndex === 1 ? '⚠️' : '✨'}
                    </div>
                    <h3 className="text-lg font-semibold text-white">{level}</h3>
                  </div>

                  {/* Concepts Grid */}
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {[...Array(5)].map((_, index) => (
                      <div
                        key={index}
                        className="group rounded-lg border border-gray-700 bg-[#1a2332] p-4 transition hover:border-[#07A498]"
                      >
                        <div className="mb-3 flex items-start justify-between">
                          <h4 className="text-sm font-medium text-[#07A498]">
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
                          <span className="text-[#07A498]">CTA: Descubre Más</span>
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

      {/* Floating Bottom Bar for Cloning */}
      {isCloneBarVisible && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-800 bg-[#0a0a0a]/95 backdrop-blur-lg p-4 transition-transform duration-300 transform translate-y-0">
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#07A498]/20 text-[#07A498] font-bold">
                {selectedTemplateIds.length}
              </div>
              <p className="text-sm font-medium text-white">
                Plantillas seleccionadas
              </p>
            </div>

            <div className="flex flex-1 items-center gap-4">
              <span className="text-sm font-medium text-gray-300 whitespace-nowrap">Clonar con producto:</span>
              <div className="flex-1 max-w-md">
                 <Dropdown
                    options={products?.map(p => ({ value: p.id, label: p.name })) || []}
                    value={selectedProduct}
                    onChange={setSelectedProduct}
                    placeholder={products && products.length > 0 ? "Seleccionar producto..." : "No hay productos creados"}
                    className="w-full"
                    openDirection="up"
                  />
              </div>
            </div>

            <Button
              onClick={initiateCloneProcess}
              disabled={cloneMutation.isPending || !selectedProduct}
              className="bg-[#07A498] text-white hover:bg-[#068f84] px-8 py-6 rounded-xl shadow-lg shadow-[#07A498]/20"
            >
              {cloneMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Procesando...
                </>
              ) : (
                'Confirmar y Clonar'
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Project Name Modal */}
      {isProjectModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-gray-800 bg-[#141414] p-6 shadow-2xl">
            <h2 className="mb-4 text-xl font-bold text-white">Nombre del Proyecto</h2>
            <p className="mb-6 text-sm text-gray-400">Asigna un nombre para identificar este grupo de imágenes en tu historial.</p>
            
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="Ej: Campaña Black Friday 2026"
              className="mb-6 w-full rounded-lg border border-gray-700 bg-[#0a0a0a] px-4 py-3 text-white focus:border-[#07A498] focus:outline-none"
              autoFocus
            />

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 border-gray-700 hover:bg-gray-800"
                onClick={() => setIsProjectModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1 bg-[#07A498] hover:bg-[#068f84] text-white"
                onClick={confirmClone}
              >
                Comenzar Clonación
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Progress Popup */}
      {isProgressOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-md">
          <div className="w-full max-w-sm text-center">
            <Loader2 className="mx-auto mb-6 h-12 w-12 animate-spin text-[#07A498]" />
            <h2 className="mb-2 text-2xl font-bold text-white">Clonando Imágenes</h2>
            <p className="mb-8 text-gray-400">Estamos generando tus variantes, por favor espera...</p>
            
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-800">
              <div 
                className="h-full bg-[#07A498] transition-all duration-300 ease-out"
                style={{ width: `${progressValue}%` }}
              />
            </div>
            <p className="mt-2 text-right text-xs text-[#07A498]">{progressValue}%</p>
          </div>
        </div>
      )}
    </div>
  );
}
