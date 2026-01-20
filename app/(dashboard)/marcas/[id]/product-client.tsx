'use client';

import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Loading } from '@/components/ui/loading';
import { toast } from 'sonner';
import { ArrowLeft, Sparkles, Edit, Plus, Loader2 } from 'lucide-react';
import type { Product } from '@/types';

export default function ProductClient({ product }: { product: Product }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  // Analyze Mutation
  const analyzeProduct = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/products/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: product.id }),
      });

      if (!response.ok) {
         if (response.status === 404) throw new Error('Servicio de análisis no disponible (404)');
         throw new Error('Error en el análisis');
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast.success('Análisis completado: ' + (data.aiPrompt ? 'Prompt generado' : 'Sin cambios'));
      // We need to refresh the server data. 
      // The easiest way is to refresh the page route
      router.refresh();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  if (!product) return <div className="p-8 text-center text-red-500">Producto no encontrado</div>;

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

          {/* AI Analysis Section */}
          <div className="rounded-xl border border-brand-accent/20 bg-brand-accent/5 p-6">
            <h3 className="mb-3 flex items-center font-semibold text-white">
              <Sparkles className="mr-2 h-5 w-5 text-brand-accent" />
              Investigación de IA
            </h3>
            
            {product.ai_prompt ? (
              <div className="space-y-4">
                <div className="rounded-lg bg-black/40 p-4 text-sm text-gray-300">
                  {product.ai_prompt}
                </div>
                <div className="flex gap-3">
                    <Button onClick={() => analyzeProduct.mutate()} disabled={analyzeProduct.isPending} variant="outline" size="sm">
                       {analyzeProduct.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                       Regenerar Análisis
                    </Button>
                    <Button onClick={() => router.push(`/admin/dashboard`)} variant="ghost" size="sm">
                        <Edit className="mr-2 h-4 w-4" /> Editar Prompt (Admin)
                    </Button>
                </div>
              </div>
            ) : (
              <div>
                <p className="mb-4 text-sm text-gray-400">
                  La IA analizará tu producto para crear los mejores clones.
                </p>
                <Button 
                  onClick={() => analyzeProduct.mutate()} 
                  disabled={analyzeProduct.isPending}
                  className="w-full bg-brand-accent hover:bg-brand-accent/90"
                >
                  {analyzeProduct.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Analizando...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-5 w-5" />
                      Empezar Research
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
