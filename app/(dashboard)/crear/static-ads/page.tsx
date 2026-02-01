'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Dropdown } from '@/components/ui/dropdown';
import { toast } from 'sonner';
import { Star, Check, Loader2, Zap, Clock, AlertCircle, X, Image as ImageIcon } from 'lucide-react';
import { subscribeToGenerations, ProgressState } from '@/lib/realtime-helper';

// Maximum templates per generation - now supports parallel processing
const MAX_TEMPLATES_PER_GENERATION = 25;
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
  const [progressData, setProgressData] = useState({
    percentage: 0,
    completed: 0,
    total: 0,
    failed: 0,
    inProgress: 0,
    isComplete: false
  });
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [bulkEstimate, setBulkEstimate] = useState<{
    totalCredits: number;
    estimatedMinutes: number;
    message: string;
  } | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Cancel generation process
  const cancelGeneration = async () => {
    if (!currentProjectId) return;
    
    setIsCancelling(true);
    try {
      // Stop polling and realtime
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      if (realtimeCleanupRef.current) {
        realtimeCleanupRef.current();
        realtimeCleanupRef.current = null;
      }
      
      // Call API to cancel
      const response = await fetch(`/api/projects/${currentProjectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      });
      
      if (response.ok) {
        toast.success('Proceso cancelado');
        setIsProgressOpen(false);
        setCurrentProjectId(null);
        setSelectedTemplateIds([]);
        setIsCloneBarVisible(false);
        setCompletedImages([]);
      } else {
        toast.error('Error al cancelar');
      }
    } catch (error) {
      toast.error('Error al cancelar el proceso');
    } finally {
      setIsCancelling(false);
    }
  };

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

  // Fetch user products for ideation and cloning (using API with service role)
  const { data: products } = useQuery({
    queryKey: ['products', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const response = await fetch('/api/products');
      if (!response.ok) {
        console.error('Error fetching products');
        return [];
      }
      return response.json() as Promise<Product[]>;
    },
    enabled: !!user,
  });

  // Fetch estimate when selection changes
  useEffect(() => {
    if (selectedTemplateIds.length > 0) {
      fetch('/api/static-ads/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateCount: selectedTemplateIds.length }),
      })
        .then(res => res.json())
        .then(setBulkEstimate)
        .catch(() => setBulkEstimate(null));
    } else {
      setBulkEstimate(null);
    }
  }, [selectedTemplateIds.length]);

  // Cleanup polling and realtime on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (realtimeCleanupRef.current) realtimeCleanupRef.current();
    };
  }, []);

  // Realtime subscription ref
  const realtimeCleanupRef = useRef<(() => void) | null>(null);
  const [completedImages, setCompletedImages] = useState<string[]>([]);

  // Start realtime subscription and polling for progress
  const startPolling = (projectId: string) => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    if (realtimeCleanupRef.current) realtimeCleanupRef.current();
    
    // Subscribe to realtime updates
    realtimeCleanupRef.current = subscribeToGenerations(
      projectId,
      // On individual update
      (generation) => {
        console.log(`[REALTIME] Generation updated: ${generation.id} -> ${generation.status}`);
        if (generation.status === 'completed' && generation.result_url) {
          setCompletedImages(prev => {
            if (!prev.includes(generation.result_url!)) {
              return [...prev, generation.result_url!];
            }
            return prev;
          });
        }
      },
      // On progress update
      (progress: ProgressState) => {
        setProgressData({
          percentage: progress.percentage,
          completed: progress.completed,
          total: progress.total,
          failed: progress.failed,
          inProgress: progress.inProgress,
          isComplete: progress.isComplete
        });

        if (progress.isComplete) {
          // Stop polling when complete
          if (pollingRef.current) clearInterval(pollingRef.current);
          toast.success(`¡${progress.completed} imágenes generadas!`);
          setTimeout(() => {
            router.push(`/crear/static-ads/historial/${projectId}`);
          }, 1500);
        }
      }
    );
    
    // Also poll to advance the pipeline (triggers processing)
    const poll = async () => {
      try {
        console.log(`[POLL] Calling process-queue for project ${projectId}...`);
        const response = await fetch('/api/static-ads/process-queue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId }),
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[POLL] API Error ${response.status}:`, errorText);
        } else {
          const data = await response.json();
          console.log(`[POLL] Progress:`, data.progress);
        }
      } catch (error) {
        console.error('[POLL] Network error:', error);
      }
    };

    // Initial call
    poll();
    
    // Poll every 3 seconds for parallel processing
    // This triggers the backend to process batches in parallel
    pollingRef.current = setInterval(poll, 3000);
  };

  // Cleanup realtime subscription on unmount
  useEffect(() => {
    return () => {
      if (realtimeCleanupRef.current) realtimeCleanupRef.current();
    };
  }, []);

  // Clone Mutation
  const cloneMutation = useMutation({
    mutationFn: async ({ templateIds, productId, projectName }: { templateIds: string[], productId: string, projectName: string }) => {
      const response = await fetch('/api/static-ads/clone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateIds, productId, projectName }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 402) {
          throw new Error(`Créditos insuficientes. Necesitas ${errorData.required || 'más'} créditos.`);
        }
        throw new Error(errorData.error || 'Error al clonar plantillas');
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast.success(`Iniciando generación de ${data.bulk?.total || selectedTemplateIds.length} imágenes...`);
      
      // Redirect immediately to project page - no popup
      router.push(`/crear/static-ads/historial/${data.project.id}`);
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
      // Check if we've reached the maximum
      if (selectedTemplateIds.length >= MAX_TEMPLATES_PER_GENERATION) {
        toast.error(`Máximo ${MAX_TEMPLATES_PER_GENERATION} plantillas por generación`);
        return;
      }
      newSelected = [...selectedTemplateIds, template.id];
    }
    
    setSelectedTemplateIds(newSelected);
    setIsCloneBarVisible(newSelected.length > 0);
  };

  // Check if selected product has completed research
  const selectedProductData = products?.find(p => p.id === selectedProduct);
  const hasCompletedResearch = selectedProductData?.research_status === 'completed';
  const needsResearch = selectedProduct && !hasCompletedResearch;

  const initiateCloneProcess = () => {
    if (!selectedProduct) {
      toast.error('Selecciona un producto primero');
      return;
    }
    if (!hasCompletedResearch) {
      toast.error('Debes completar el research del producto antes de clonar templates');
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
    setProgressData({
      percentage: 5,
      completed: 0,
      total: selectedTemplateIds.length,
      failed: 0,
      inProgress: selectedTemplateIds.length,
      isComplete: false
    });
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
            {/* Selection info */}
            <div className="text-sm text-gray-400 whitespace-nowrap">
              {selectedTemplateIds.length}/{MAX_TEMPLATES_PER_GENERATION} seleccionadas
            </div>
            {selectedTemplateIds.length > 0 && (
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedTemplateIds([]);
                  setIsCloneBarVisible(false);
                }}
                className="border-gray-700 text-gray-300 hover:text-white whitespace-nowrap"
              >
                Limpiar selección
              </Button>
            )}
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
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
            {/* Selection count with estimate */}
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#07A498]/20 text-[#07A498] font-bold text-lg">
                {selectedTemplateIds.length}
              </div>
              <div>
                <p className="text-sm font-medium text-white">
                  Plantillas seleccionadas
                </p>
                {bulkEstimate && (
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <Zap className="h-3 w-3 text-yellow-500" />
                      {bulkEstimate.totalCredits.toLocaleString()} créditos
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-blue-400" />
                      ~{bulkEstimate.estimatedMinutes} min
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Product selector */}
            <div className="flex flex-1 items-center gap-3 max-w-md">
              <span className="text-sm font-medium text-gray-300 whitespace-nowrap">Producto:</span>
              <div className="flex-1">
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

            {/* Research Warning */}
            {needsResearch && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30">
                <AlertCircle className="h-4 w-4 text-amber-500" />
                <span className="text-xs text-amber-400">Research requerido</span>
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => router.push(`/marcas/${selectedProduct}`)}
                  className="text-xs text-amber-500 hover:text-amber-400 p-0 h-auto"
                >
                  Completar
                </Button>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedTemplateIds([]);
                  setIsCloneBarVisible(false);
                }}
                className="border-gray-700 text-gray-300 hover:text-white"
              >
                Cancelar
              </Button>
              <Button
                onClick={initiateCloneProcess}
                disabled={cloneMutation.isPending || !selectedProduct || needsResearch}
                className="bg-[#07A498] text-white hover:bg-[#068f84] px-6 py-5 rounded-xl shadow-lg shadow-[#07A498]/20 disabled:opacity-50"
              >
                {cloneMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  <>
                    Generar {selectedTemplateIds.length} Imágenes
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Project Name Modal */}
      {isProjectModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-gray-800 bg-[#141414] p-6 shadow-2xl">
            <h2 className="mb-2 text-xl font-bold text-white">Confirmar Generación Masiva</h2>
            <p className="mb-6 text-sm text-gray-400">
              Vas a generar {selectedTemplateIds.length} imágenes únicas para tu producto.
            </p>

            {/* Cost Summary */}
            {bulkEstimate && (
              <div className="mb-6 rounded-xl bg-[#07A498]/10 border border-[#07A498]/30 p-4">
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-[#07A498]">{bulkEstimate.totalCredits.toLocaleString()}</p>
                    <p className="text-xs text-gray-400">Créditos a usar</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">~{bulkEstimate.estimatedMinutes} min</p>
                    <p className="text-xs text-gray-400">Tiempo estimado</p>
                  </div>
                </div>
                <p className="mt-3 text-center text-xs text-gray-400">
                  {bulkEstimate.message}
                </p>
              </div>
            )}
            
            <label className="mb-2 block text-sm font-medium text-gray-300">
              Nombre del proyecto
            </label>
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
                disabled={!projectName.trim()}
              >
                <Zap className="mr-2 h-4 w-4" />
                Generar {selectedTemplateIds.length} Imágenes
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Progress Popup */}
      {isProgressOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-md">
          <div className="w-full max-w-md rounded-2xl border border-gray-800 bg-[#141414] p-8">
            {/* Header */}
            <div className="mb-6 text-center">
              {progressData.isComplete ? (
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20">
                  <Check className="h-8 w-8 text-green-500" />
                </div>
              ) : (
                <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-[#07A498]" />
              )}
              <h2 className="text-2xl font-bold text-white">
                {progressData.isComplete ? '¡Generación Completa!' : 'Generando Imágenes'}
              </h2>
              <p className="mt-2 text-gray-400">
                {progressData.isComplete 
                  ? 'Todas las imágenes están listas'
                  : 'Procesando con IA, puedes cerrar y volver después'
                }
              </p>
            </div>
            
            {/* Progress Stats */}
            <div className="mb-6 grid grid-cols-3 gap-4 text-center">
              <div className="rounded-lg bg-[#07A498]/10 p-3">
                <p className="text-2xl font-bold text-[#07A498]">{progressData.completed}</p>
                <p className="text-xs text-gray-400">Completadas</p>
              </div>
              <div className="rounded-lg bg-blue-500/10 p-3">
                <p className="text-2xl font-bold text-blue-400">{progressData.inProgress}</p>
                <p className="text-xs text-gray-400">En Proceso</p>
              </div>
              <div className="rounded-lg bg-gray-800 p-3">
                <p className="text-2xl font-bold text-white">{progressData.total}</p>
                <p className="text-xs text-gray-400">Total</p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mb-4">
              <div className="mb-2 flex justify-between text-xs">
                <span className="text-gray-400">Progreso</span>
                <span className="text-[#07A498] font-medium">{progressData.percentage}%</span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-gray-800">
                <div 
                  className="h-full bg-gradient-to-r from-[#07A498] to-[#0ab6a8] transition-all duration-500 ease-out"
                  style={{ width: `${progressData.percentage}%` }}
                />
              </div>
            </div>

            {/* Real-time Image Previews */}
            {completedImages.length > 0 && !progressData.isComplete && (
              <div className="mb-4">
                <p className="mb-2 text-xs text-gray-400 flex items-center gap-1">
                  <ImageIcon className="h-3 w-3" />
                  Imágenes generadas ({completedImages.length})
                </p>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {completedImages.slice(-6).map((url, idx) => (
                    <img
                      key={idx}
                      src={url}
                      alt={`Generated ${idx + 1}`}
                      className="h-16 w-16 rounded-lg object-cover border border-gray-700 animate-in fade-in slide-in-from-right-2 duration-300"
                    />
                  ))}
                  {completedImages.length > 6 && (
                    <div className="h-16 w-16 rounded-lg bg-gray-800 flex items-center justify-center text-xs text-gray-400">
                      +{completedImages.length - 6}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Failed Warning */}
            {progressData.failed > 0 && (
              <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-500/10 p-3 text-sm text-red-400">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{progressData.failed} imagen(es) fallaron. Puedes reintentar desde el historial.</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              {!progressData.isComplete ? (
                <>
                  <Button
                    variant="outline"
                    className="flex-1 border-red-500/50 text-red-400 hover:bg-red-500/10 hover:border-red-500"
                    onClick={cancelGeneration}
                    disabled={isCancelling}
                  >
                    {isCancelling ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <X className="h-4 w-4 mr-2" />
                    )}
                    Cancelar
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 border-gray-700 hover:bg-gray-800"
                    onClick={() => {
                      setIsProgressOpen(false);
                      // Don't stop polling - let it continue in background
                    }}
                  >
                    Continuar Navegando
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    className="flex-1 border-gray-700 hover:bg-gray-800"
                    onClick={() => {
                      setIsProgressOpen(false);
                      setCurrentProjectId(null);
                      setSelectedTemplateIds([]);
                      setIsCloneBarVisible(false);
                    }}
                  >
                    Cerrar
                  </Button>
                  {currentProjectId && (
                    <Button
                      className="flex-1 bg-[#07A498] hover:bg-[#068f84] text-white"
                      onClick={() => router.push(`/crear/static-ads/historial/${currentProjectId}`)}
                    >
                      Ver Resultados
                    </Button>
                  )}
                </>
              )}
            </div>

            {/* Bulk info */}
            {bulkEstimate && !progressData.isComplete && (
              <p className="mt-4 text-center text-xs text-gray-500">
                Tiempo estimado: ~{bulkEstimate.estimatedMinutes} minutos para {progressData.total} imágenes
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
