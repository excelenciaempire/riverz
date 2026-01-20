'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Loader2, Package } from 'lucide-react';
import { useState } from 'react';

interface Product {
  id: string;
  name: string;
  ai_prompt: string;
  images: string[];
}

export default function AdminProductsPage() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [promptValue, setPromptValue] = useState('');

  const { data: products, isLoading } = useQuery({
    queryKey: ['admin-products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Product[];
    },
  });

  const updatePromptMutation = useMutation({
    mutationFn: async ({ id, prompt }: { id: string, prompt: string }) => {
      const { error } = await supabase
        .from('products')
        .update({ ai_prompt: prompt })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Prompt actualizado');
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
    },
    onError: () => {
      toast.error('Error al actualizar prompt');
    }
  });

  if (isLoading) {
    return <div className="p-8 text-center text-white">Cargando productos...</div>;
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-white mb-8">Gestión de Prompts de Productos</h1>
      
      <div className="grid gap-6">
        {products?.map((product) => (
          <div key={product.id} className="bg-[#141414] border border-gray-800 rounded-xl p-6">
            <div className="flex gap-6">
              <div className="w-24 h-24 bg-gray-900 rounded-lg overflow-hidden shrink-0">
                {product.images?.[0] ? (
                  <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
                ) : (
                  <Package className="w-full h-full p-6 text-gray-700" />
                )}
              </div>
              
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-white mb-2">{product.name}</h3>
                
                {editingId === product.id ? (
                  <div className="space-y-3">
                    <label className="text-sm text-gray-400">Prompt Interno (Gemini):</label>
                    <Textarea
                      value={promptValue}
                      onChange={(e) => setPromptValue(e.target.value)}
                      className="bg-[#0a0a0a] border-gray-700 text-white min-h-[100px]"
                    />
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        onClick={() => updatePromptMutation.mutate({ id: product.id, prompt: promptValue })}
                        disabled={updatePromptMutation.isPending}
                        className="bg-[#07A498] hover:bg-[#068f84] text-white"
                      >
                        {updatePromptMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Guardar
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => setEditingId(null)}
                        className="border-gray-700 hover:bg-gray-800 text-white"
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-gray-400 mb-1">Prompt Interno:</p>
                    <div className="bg-[#0a0a0a] p-3 rounded-lg border border-gray-800 text-gray-300 text-sm mb-3">
                      {product.ai_prompt || 'Sin análisis aún...'}
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => {
                        setEditingId(product.id);
                        setPromptValue(product.ai_prompt || '');
                      }}
                      className="border-gray-700 hover:bg-gray-800 text-white"
                    >
                      Editar Prompt
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
