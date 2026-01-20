'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { ArrowLeft, Sparkles, Plus } from 'lucide-react';
import { ResearchProgress } from '@/components/products/research-progress';
import { ResearchPanel } from '@/components/products/research-panel';
import type { Product } from '@/types';

// Extended product type with research fields
interface ProductWithResearch extends Product {
  research_data?: any;
  research_status?: 'pending' | 'processing' | 'completed' | 'failed' | null;
}

export default function ProductClient({ product }: { product: ProductWithResearch }) {
  const router = useRouter();
  const [isResearchPanelOpen, setIsResearchPanelOpen] = useState(false);
  const [localResearchData, setLocalResearchData] = useState(product.research_data);
  const [localResearchStatus, setLocalResearchStatus] = useState(product.research_status);

  // Deep Research Mutation
  const deepResearch = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/products/deep-research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: product.id }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Error en el research');
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast.success('Deep Research completado');
      setLocalResearchData(data.researchData);
      setLocalResearchStatus('completed');
      router.refresh();
    },
    onError: (err: any) => {
      toast.error(err.message || 'Error al realizar el research');
      setLocalResearchStatus('failed');
    },
  });

  const handleStartResearch = () => {
    setLocalResearchStatus('processing');
    deepResearch.mutate();
  };

  const handleViewResearch = () => {
    setIsResearchPanelOpen(true);
  };

  if (!product) return <div className="p-8 text-center text-red-500">Producto no encontrado</div>;

  const hasResearch = !!(localResearchData || product.research_data);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <Button variant="ghost" onClick={() => router.push('/marcas')} className="text-gray-400 hover:text-white">
          <ArrowLeft className="mr-2 h-4 w-4" /> Volver
        </Button>
        
        <Button onClick={() => router.push('/marcas')} variant="outline" className="border-brand-accent text-brand-accent hover:bg-brand-accent/10">
          <Plus className="mr-2 h-4 w-4" /> Agregar otro producto
        </Button>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Images */}
        <div className="space-y-4">
          <div className="aspect-square overflow-hidden rounded-2xl border border-gray-800 bg-[#141414]">
             {product.images && product.images[0] && (
               <img src={product.images[0]} alt={product.name} className="h-full w-full object-cover" />
             )}
          </div>
          {product.images && product.images.length > 1 && (
            <div className="grid grid-cols-4 gap-2">
              {product.images.slice(1).map((img, i) => (
                <div key={i} className="aspect-square overflow-hidden rounded-lg border border-gray-800 bg-[#141414]">
                  <img src={img} alt="" className="h-full w-full object-cover" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-white">{product.name}</h1>
            <p className="mt-2 text-2xl text-brand-accent">${product.price}</p>
          </div>

          <div className="rounded-xl border border-gray-800 bg-[#141414] p-6">
            <h3 className="mb-3 font-semibold text-white">Información</h3>
            <div className="space-y-3 text-gray-400">
              <p><span className="text-gray-500">Web:</span> {product.website || 'N/A'}</p>
              <p><span className="text-gray-500">Beneficios:</span> {product.benefits}</p>
            </div>
          </div>

          {/* Deep Research Section */}
          <div className="rounded-xl border border-brand-accent/20 bg-brand-accent/5 p-6">
            <h3 className="mb-4 flex items-center font-semibold text-white">
              <Sparkles className="mr-2 h-5 w-5 text-brand-accent" />
              Deep Research de Mercado
            </h3>
            
            <p className="mb-4 text-sm text-gray-400">
              {hasResearch 
                ? 'El research profundo está listo. Úsalo para crear ads que conecten emocionalmente con tu audiencia.'
                : 'La IA analizará Reddit, reseñas y redes sociales para descubrir los verdaderos motivadores emocionales de compra de tu público objetivo.'
              }
            </p>

            <ResearchProgress
              productId={product.id}
              initialStatus={localResearchStatus || product.research_status || null}
              hasResearch={hasResearch}
              onStartResearch={handleStartResearch}
              onViewResearch={handleViewResearch}
              isStarting={deepResearch.isPending}
            />

            {/* Quick stats if research exists */}
            {hasResearch && (localResearchData || product.research_data) && (
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-black/30 p-2">
                  <p className="text-lg font-bold text-brand-accent">
                    {(localResearchData || product.research_data)?.problema_central?.emociones?.length || 0}
                  </p>
                  <p className="text-xs text-gray-500">Emociones</p>
                </div>
                <div className="rounded-lg bg-black/30 p-2">
                  <p className="text-lg font-bold text-brand-accent">
                    {(localResearchData || product.research_data)?.miedos_oscuros?.miedos?.length || 0}
                  </p>
                  <p className="text-xs text-gray-500">Miedos</p>
                </div>
                <div className="rounded-lg bg-black/30 p-2">
                  <p className="text-lg font-bold text-brand-accent">
                    {(localResearchData || product.research_data)?.lenguaje?.palabras_clave?.length || 0}
                  </p>
                  <p className="text-xs text-gray-500">Keywords</p>
                </div>
              </div>
            )}
          </div>

          {/* Action Button to go to Static Ads */}
          <Button 
            onClick={() => router.push('/crear/static-ads')}
            className="w-full bg-gradient-to-r from-brand-accent to-brand-blue hover:opacity-90"
            size="lg"
          >
            Ir a Crear Static Ads
          </Button>
        </div>
      </div>

      {/* Research Panel Modal */}
      <ResearchPanel
        isOpen={isResearchPanelOpen}
        onClose={() => setIsResearchPanelOpen(false)}
        researchData={localResearchData || product.research_data}
        productName={product.name}
      />
    </div>
  );
}
