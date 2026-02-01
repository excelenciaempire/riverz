'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Download, Check, Edit2, Loader2, Save, Undo2, X, Sparkles, Trash2, Clock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Generation {
  id: string;
  result_url: string;
  status: string;
  input_data: any;
  version?: number;
  parent_id?: string;
  created_at?: string;
  updated_at?: string;
}

interface ProjectDetail {
  id: string;
  name: string;
  generations: Generation[];
}

// Status display config
const statusConfig: Record<string, { label: string; color: string; icon: 'loader' | 'clock' | 'alert' | 'check' }> = {
  pending_analysis: { label: 'En cola', color: 'text-gray-400', icon: 'clock' },
  analyzing: { label: 'Analizando', color: 'text-blue-400', icon: 'loader' },
  adapting: { label: 'Adaptando', color: 'text-purple-400', icon: 'loader' },
  generating_prompt: { label: 'Generando prompt', color: 'text-indigo-400', icon: 'loader' },
  pending_generation: { label: 'Preparando imagen', color: 'text-cyan-400', icon: 'loader' },
  generating: { label: 'Generando imagen', color: 'text-[#07A498]', icon: 'loader' },
  completed: { label: 'Completado', color: 'text-green-400', icon: 'check' },
  failed: { label: 'Error', color: 'text-red-400', icon: 'alert' },
};

export default function ProjectDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [editingImage, setEditingImage] = useState<Generation | null>(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [generatedEditUrl, setGeneratedEditUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', params.id],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${params.id}`);
      if (!response.ok) throw new Error('Failed to fetch project');
      return response.json() as Promise<ProjectDetail>;
    },
    refetchInterval: (query) => {
        const hasPending = query.state.data?.generations?.some(
            (g: any) => ['pending_analysis', 'analyzing', 'adapting', 'generating_prompt', 'pending_generation', 'generating', 'processing'].includes(g.status)
        );
        // Poll every 2 seconds if processing for faster updates
        return hasPending ? 2000 : false;
    }
  });
  
  // Effect to trigger queue processing if needed
  useEffect(() => {
    const processQueue = async () => {
        // Trigger processing for any non-terminal status
        const needsProcessing = project?.generations?.some(
            (g: any) => ['pending_analysis', 'analyzing', 'adapting', 'generating_prompt', 'pending_generation', 'generating'].includes(g.status)
        );
        if (needsProcessing) {
            try {
                await fetch('/api/static-ads/process-queue', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ projectId: params.id })
                });
            } catch (e) {
                console.error('Queue processing error', e);
            }
        }
    };
    
    if (project) {
        processQueue();
    }
  }, [project, params.id]);

  const toggleSelection = (id: string) => {
    setSelectedImages((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (!project) return;
    if (selectedImages.length === project.generations.length) {
      setSelectedImages([]);
    } else {
      setSelectedImages(project.generations.map((g) => g.id));
    }
  };

  const handleDownload = async () => {
    if (selectedImages.length === 0) return;
    
    // Simple download logic (opens in new tabs for now, zip would be better for many)
    selectedImages.forEach((id) => {
      const img = project?.generations.find((g) => g.id === id);
      if (img?.result_url) {
        window.open(img.result_url, '_blank');
      }
    });
    toast.success('Descarga iniciada');
  };

  // Edit Mutation - Uses new static-ads edit endpoint
  const editMutation = useMutation({
    mutationFn: async () => {
      if (!editingImage) return;
      setIsGenerating(true);
      setGeneratedEditUrl(null);

      // Call the new edit endpoint which handles Claude + Nano Banana internally
      const response = await fetch('/api/static-ads/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          generationId: editingImage.id,
          editInstructions: editPrompt
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        if (response.status === 402) {
          throw new Error(`Créditos insuficientes.`);
        }
        throw new Error(data.error || 'Error al editar imagen');
      }

      return {
        resultUrl: data.resultUrl,
        newGenerationId: data.newGenerationId,
        version: data.version
      };
    },
    onSuccess: (result) => {
      if (result) {
        setGeneratedEditUrl(result.resultUrl);
        toast.success(`Edición completada - Versión ${result.version || 2}`);
        // Refresh the project to show the new version
        queryClient.invalidateQueries({ queryKey: ['project', params.id] });
      }
      setIsGenerating(false);
    },
    onError: (error: any) => {
      setIsGenerating(false);
      toast.error(error.message || 'Error al editar imagen');
      console.error(error);
    }
  });

  const handleSaveEdit = async () => {
    // The new edit endpoint already saves the image, so we just need to close the drawer
    toast.success('Imagen guardada');
    setEditingImage(null);
    setGeneratedEditUrl(null);
    setEditPrompt('');
    // Refresh is already done in the mutation onSuccess
  };

  // Delete single generation
  const deleteGenerationMutation = useMutation({
    mutationFn: async (generationId: string) => {
      const response = await fetch(`/api/generations/${generationId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Error al eliminar');
      return response.json();
    },
    onSuccess: () => {
      toast.success('Imagen eliminada');
      queryClient.invalidateQueries({ queryKey: ['project', params.id] });
    },
    onError: () => {
      toast.error('Error al eliminar la imagen');
    }
  });

  // Delete entire project
  const deleteProjectMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/projects/${params.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Error al eliminar');
      return response.json();
    },
    onSuccess: () => {
      toast.success('Proyecto eliminado');
      router.push('/crear/static-ads/historial');
    },
    onError: () => {
      toast.error('Error al eliminar el proyecto');
    }
  });

  const handleDeleteSelected = () => {
    if (selectedImages.length === 0) return;
    if (!confirm(`¿Eliminar ${selectedImages.length} imagen(es) seleccionadas?`)) return;
    
    selectedImages.forEach(id => {
      deleteGenerationMutation.mutate(id);
    });
    setSelectedImages([]);
  };

  const handleDeleteProject = () => {
    if (!confirm('¿Eliminar todo el proyecto y todas sus imágenes?')) return;
    deleteProjectMutation.mutate();
  };

  // Calculate progress stats
  const progressStats = useMemo(() => {
    if (!project?.generations) return { completed: 0, failed: 0, inProgress: 0, total: 0, percentage: 0 };
    
    const completed = project.generations.filter(g => g.status === 'completed').length;
    const failed = project.generations.filter(g => g.status === 'failed').length;
    const total = project.generations.length;
    const inProgress = total - completed - failed;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    return { completed, failed, inProgress, total, percentage };
  }, [project?.generations]);

  const isProcessing = progressStats.inProgress > 0;

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-black">
        <Loader2 className="h-8 w-8 animate-spin text-[#07A498]" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-black text-white">
      {/* Main Content */}
      <div className={cn("flex-1 overflow-y-auto p-6 transition-all", editingImage ? "mr-[400px]" : "")}>
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/crear/static-ads/historial')}
              className="flex items-center gap-2 text-gray-400 transition hover:text-white"
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="text-sm">Volver</span>
            </button>
            <h1 className="text-2xl font-bold">{project?.name}</h1>
          </div>
          
          <div className="flex gap-3">
            {!isProcessing && (
              <>
                <Button
                  variant="outline"
                  onClick={handleSelectAll}
                  className="border-gray-700 text-gray-300 hover:text-white"
                >
                  {selectedImages.length === project?.generations.length ? 'Deseleccionar' : 'Seleccionar Todo'}
                </Button>
                {selectedImages.length > 0 && (
                  <>
                    <Button
                      onClick={handleDownload}
                      className="bg-[#07A498] text-white hover:bg-[#068f84]"
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Descargar ({selectedImages.length})
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleDeleteSelected}
                      className="border-red-500/50 text-red-400 hover:bg-red-500/10 hover:border-red-500"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Eliminar ({selectedImages.length})
                    </Button>
                  </>
                )}
              </>
            )}
            <Button
              variant="outline"
              onClick={handleDeleteProject}
              className="border-gray-700 text-gray-400 hover:text-red-400 hover:border-red-500/50"
              title="Eliminar proyecto completo"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Progress Bar - only show when processing */}
        {isProcessing && (
          <div className="mb-6 p-4 rounded-xl bg-[#141414] border border-gray-800">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-[#07A498]" />
                <span className="font-medium">Generando imágenes...</span>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-green-400">{progressStats.completed} completadas</span>
                <span className="text-gray-400">{progressStats.inProgress} en proceso</span>
                {progressStats.failed > 0 && <span className="text-red-400">{progressStats.failed} fallidas</span>}
              </div>
            </div>
            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-[#07A498] to-[#0AC6B7] transition-all duration-500"
                style={{ width: `${progressStats.percentage}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Estimado: ~{Math.max(1, Math.ceil(progressStats.inProgress * 0.5))} minutos restantes
            </p>
          </div>
        )}

        {/* Grid - Modern 3:4 Design */}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {project?.generations.map((gen, idx) => {
            const isCompleted = gen.status === 'completed';
            const isFailed = gen.status === 'failed';
            const isPending = !isCompleted && !isFailed;
            const status = statusConfig[gen.status] || statusConfig.pending_analysis;
            
            return (
              <div
                key={gen.id}
                className={cn(
                  "group relative rounded-2xl border transition-all duration-300 overflow-hidden",
                  "bg-gradient-to-br from-[#1a1a1a] to-[#0f0f0f]",
                  isCompleted && selectedImages.includes(gen.id) 
                    ? "border-[#07A498] shadow-lg shadow-[#07A498]/20" 
                    : "border-gray-800/50 hover:border-gray-700"
                )}
                style={{ animationDelay: `${idx * 50}ms` }}
              >
                {/* Image Container with 3:4 aspect ratio */}
                <div className="relative aspect-[3/4] overflow-hidden bg-[#0a0a0a]">
                  {isCompleted && gen.result_url ? (
                    <>
                      <img
                        src={gen.result_url}
                        alt="Generated"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        onClick={() => toggleSelection(gen.id)}
                      />
                      
                      {/* Checkmark Overlay */}
                      <div
                        className={cn(
                          "absolute inset-0 flex items-center justify-center bg-[#07A498]/20 backdrop-blur-sm transition-opacity cursor-pointer",
                          selectedImages.includes(gen.id) ? "opacity-100" : "opacity-0"
                        )}
                        onClick={() => toggleSelection(gen.id)}
                      >
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#07A498] shadow-xl">
                          <Check className="h-8 w-8 text-white" />
                        </div>
                      </div>

                      {/* Version Badge */}
                      {gen.version && gen.version > 1 && (
                        <div className="absolute top-3 left-3 px-2 py-0.5 text-xs font-medium bg-purple-500/90 text-white rounded-full pointer-events-none">
                          v{gen.version}
                        </div>
                      )}
                    </>
                  ) : isPending ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
                      {/* Template thumbnail blurred background */}
                      {gen.input_data?.templateThumbnail && (
                        <img 
                          src={gen.input_data.templateThumbnail} 
                          alt="" 
                          className="absolute inset-0 h-full w-full object-cover opacity-10 blur-md"
                        />
                      )}
                      
                      {/* Loading Content */}
                      <div className="relative z-10 flex flex-col items-center text-center">
                        {/* Animated Icon */}
                        {status.icon === 'loader' && (
                          <div className="relative mb-4">
                            <div className="absolute inset-0 rounded-full bg-[#07A498]/20 animate-ping" />
                            <Sparkles className={cn("h-14 w-14 relative z-10 animate-spin", status.color)} />
                          </div>
                        )}
                        {status.icon === 'clock' && (
                          <Clock className={cn("h-14 w-14 mb-4", status.color)} />
                        )}
                        
                        {/* Status Label */}
                        <p className={cn("text-base font-bold text-center mb-3", status.color)}>
                          {status.label}
                        </p>
                        
                        {/* Progress Bar */}
                        <div className="w-full max-w-[75%] mb-3">
                          <div className="h-1.5 bg-gray-800/50 rounded-full overflow-hidden">
                            <div className={cn("h-full rounded-full animate-progress", 
                              status.color.replace('text-', 'bg-')
                            )} />
                          </div>
                        </div>
                        
                        {/* Template Name */}
                        <p className="text-xs text-gray-500 px-2 line-clamp-2 max-w-full">
                          {gen.input_data?.templateName || `Imagen ${idx + 1}`}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-gradient-to-br from-red-950/20 to-red-900/10">
                      <AlertCircle className="h-14 w-14 mb-3 text-red-400" />
                      <p className="text-base font-bold text-center text-red-400 mb-2">Error</p>
                      <p className="text-xs text-center text-red-400/70 px-2 line-clamp-3">
                        {gen.input_data?.templateName || 'Error en generación'}
                      </p>
                    </div>
                  )}
                </div>

                {/* Bottom Info Bar */}
                <div className="p-3 flex items-center justify-between border-t border-gray-800/50">
                  {isCompleted ? (
                    <>
                      <input
                        type="checkbox"
                        checked={selectedImages.includes(gen.id)}
                        onChange={() => toggleSelection(gen.id)}
                        className="h-4 w-4 cursor-pointer rounded accent-[#07A498]"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingImage(gen);
                          setEditPrompt('');
                          setGeneratedEditUrl(null);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#07A498]/10 text-[#07A498] text-xs font-medium transition hover:bg-[#07A498]/20"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                        Editar
                      </button>
                    </>
                  ) : (
                    <div className="flex items-center gap-2 text-xs text-gray-500 w-full">
                      <div className={cn("h-2 w-2 rounded-full animate-pulse", 
                        status.color.replace('text-', 'bg-')
                      )} />
                      <span className="flex-1 truncate">{status.label}...</span>
                      <span className="text-[10px] text-[#07A498] font-mono">100%</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Edit Drawer */}
      <div 
        className={cn(
          "fixed right-0 top-0 h-screen w-[400px] bg-[#141414] border-l border-gray-800 shadow-2xl transition-transform duration-300 transform p-6 flex flex-col z-50",
          editingImage ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[#07A498]" />
            Editor IA
          </h2>
          <button 
            onClick={() => setEditingImage(null)}
            className="text-gray-400 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {editingImage && (
          <div className="flex-1 flex flex-col gap-6 overflow-y-auto">
            {/* Image Preview */}
            <div className="relative aspect-square rounded-lg overflow-hidden border border-gray-700">
              <img
                src={generatedEditUrl || editingImage.result_url}
                alt="Editing"
                className="h-full w-full object-cover"
              />
              {isGenerating && (
                <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-[#07A498] mb-2" />
                  <p className="text-sm text-gray-300">Generando magia...</p>
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-300 mb-2 block">
                  Instrucciones
                </label>
                <Textarea
                  placeholder="Ej: Cambia el fondo a un atardecer en la playa, haz que sonría más..."
                  value={editPrompt}
                  onChange={(e) => setEditPrompt(e.target.value)}
                  className="bg-[#0a0a0a] border-gray-800 focus:border-[#07A498] min-h-[100px]"
                />
              </div>

              <Button
                onClick={() => editMutation.mutate()}
                disabled={isGenerating || !editPrompt}
                className="w-full bg-[#07A498] hover:bg-[#068f84] text-white"
              >
                {isGenerating ? 'Generando...' : 'Generar Edición'}
              </Button>

              {generatedEditUrl && (
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <Button
                    variant="outline"
                    onClick={() => setGeneratedEditUrl(null)}
                    className="border-gray-700 hover:bg-gray-800 text-gray-300"
                  >
                    <Undo2 className="mr-2 h-4 w-4" />
                    Deshacer
                  </Button>
                  <Button
                    onClick={handleSaveEdit}
                    className="bg-white text-black hover:bg-gray-200"
                  >
                    <Save className="mr-2 h-4 w-4" />
                    Guardar
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
