'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Download, Check, Edit2, Loader2, Save, Undo2, X, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Generation {
  id: string;
  result_url: string;
  status: string;
  input_data: any;
}

interface ProjectDetail {
  id: string;
  name: string;
  generations: Generation[];
}

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
            (g: any) => g.status === 'pending_analysis' || g.status === 'analyzing' || g.status === 'generating' || g.status === 'processing'
        );
        return hasPending ? 3000 : false;
    }
  });
  
  // Effect to trigger queue processing if needed
  useEffect(() => {
    const processQueue = async () => {
        const hasPending = project?.generations?.some(
            (g: any) => g.status === 'pending_analysis' || g.status === 'generating'
        );
        if (hasPending) {
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
  }, [project, params.id]); // Add project as dependency to retry on each refresh if still pending

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

  // Edit Mutation
  const editMutation = useMutation({
    mutationFn: async () => {
      if (!editingImage) return;
      setIsGenerating(true);
      setGeneratedEditUrl(null);

      // 1. Start Task
      const startRes = await fetch('/api/ai/edit-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: editPrompt,
          imageUrl: editingImage.result_url,
          generationId: editingImage.id
        }),
      });

      if (!startRes.ok) {
        const errorData = await startRes.json().catch(() => ({}));
        if (startRes.status === 402) {
          throw new Error(`Créditos insuficientes. Necesitas ${errorData.required || 14} créditos.`);
        }
        throw new Error(errorData.error || 'Error starting edit');
      }
      
      const { taskId } = await startRes.json();

      // 2. Poll Status with timeout
      const maxAttempts = 60; // Max 2 minutes (60 * 2 seconds)
      let attempts = 0;
      
      const poll = async (): Promise<string> => {
        attempts++;
        if (attempts > maxAttempts) {
          throw new Error('Timeout: La generación está tardando demasiado');
        }
        
        const statusRes = await fetch(`/api/ai/task-status/${taskId}`);
        if (!statusRes.ok) throw new Error('Error checking status');
        const statusData = await statusRes.json();

        if (statusData.data?.status === 'SUCCESS' && statusData.data?.result) {
          return statusData.data.result;
        } else if (statusData.data?.status === 'FAILED') {
          throw new Error('La generación falló');
        } else {
          // Wait and retry
          await new Promise(r => setTimeout(r, 2000));
          return poll();
        }
      };

      return poll();
    },
    onSuccess: (url) => {
      setGeneratedEditUrl(url);
      setIsGenerating(false);
      toast.success('Edición completada - Revisa el resultado');
    },
    onError: (error: any) => {
      setIsGenerating(false);
      toast.error(error.message || 'Error al editar imagen');
      console.error(error);
    }
  });

  const handleSaveEdit = async () => {
    if (!editingImage || !generatedEditUrl) return;
    
    try {
      // Save the edited image to the database
      const response = await fetch('/api/ai/save-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          generationId: editingImage.id,
          newImageUrl: generatedEditUrl
        }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al guardar');
      }
      
      toast.success('Imagen guardada en el proyecto');
      setEditingImage(null);
      setGeneratedEditUrl(null);
      setEditPrompt('');
      queryClient.invalidateQueries({ queryKey: ['project', params.id] });
    } catch (error: any) {
      toast.error(error.message || 'Error al guardar la imagen');
    }
  };

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
        <div className="mb-8 flex items-center justify-between">
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
            <Button
              variant="outline"
              onClick={handleSelectAll}
              className="border-gray-700 text-gray-300 hover:text-white"
            >
              {selectedImages.length === project?.generations.length ? 'Deseleccionar' : 'Seleccionar Todo'}
            </Button>
            {selectedImages.length > 0 && (
              <Button
                onClick={handleDownload}
                className="bg-[#07A498] text-white hover:bg-[#068f84]"
              >
                <Download className="mr-2 h-4 w-4" />
                Descargar ({selectedImages.length})
              </Button>
            )}
          </div>
        </div>

        {/* Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {project?.generations.map((gen) => (
            <div
              key={gen.id}
              className={cn(
                "group relative aspect-square overflow-hidden rounded-xl border-2 bg-[#1a2332] transition-all",
                selectedImages.includes(gen.id) ? "border-[#07A498]" : "border-gray-800 hover:border-gray-600"
              )}
            >
              <img
                src={gen.result_url || "https://via.placeholder.com/400"}
                alt="Generated"
                className="h-full w-full object-cover"
              />
              
              {/* Selection Overlay */}
              <div 
                className="absolute inset-0 cursor-pointer"
                onClick={() => toggleSelection(gen.id)}
              />

              {/* Checkbox */}
              <div className={cn(
                "absolute top-3 right-3 flex h-6 w-6 items-center justify-center rounded-full border transition-all pointer-events-none",
                selectedImages.includes(gen.id) ? "bg-[#07A498] border-[#07A498] text-white" : "border-white/50 bg-black/30"
              )}>
                {selectedImages.includes(gen.id) && <Check className="h-4 w-4" />}
              </div>

              {/* Actions Overlay */}
              <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-full transition-transform group-hover:translate-y-0 bg-gradient-to-t from-black/90 to-transparent flex justify-center">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingImage(gen);
                    setGeneratedEditUrl(null);
                    setEditPrompt('');
                  }}
                  className="bg-white/90 text-black hover:bg-white"
                >
                  <Edit2 className="mr-2 h-3 w-3" />
                  Editar con IA
                </Button>
              </div>
            </div>
          ))}
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
