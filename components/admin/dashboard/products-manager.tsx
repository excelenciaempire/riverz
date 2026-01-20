'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Loader2, Save, Edit2, X } from 'lucide-react';

export function ProductsManager() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrompt, setEditPrompt] = useState('');

  // Fetch products
  const { data: products, isLoading } = useQuery({
    queryKey: ['admin-products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*, users(email)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Update prompt mutation
  const updatePromptMutation = useMutation({
    mutationFn: async ({ id, prompt }: { id: string; prompt: string }) => {
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
      toast.error('Error al actualizar');
    },
  });

  if (isLoading) return <div>Cargando productos...</div>;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-white">Gestión de Productos e IA</h2>
      
      <div className="rounded-xl border border-gray-800 bg-[#141414] overflow-hidden">
        <table className="w-full text-left text-sm text-gray-400">
          <thead className="bg-black text-xs uppercase text-gray-500">
            <tr>
              <th className="px-6 py-4">Producto</th>
              <th className="px-6 py-4">Usuario</th>
              <th className="px-6 py-4">AI Prompt</th>
              <th className="px-6 py-4">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {products?.map((product) => (
              <tr key={product.id} className="hover:bg-[#1a1a1a]">
                <td className="px-6 py-4 font-medium text-white">{product.name}</td>
                <td className="px-6 py-4">{product.users?.email || product.clerk_user_id}</td>
                <td className="px-6 py-4">
                  {editingId === product.id ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editPrompt}
                        onChange={(e) => setEditPrompt(e.target.value)}
                        className="min-h-[100px] w-full bg-[#0a0a0a]"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => updatePromptMutation.mutate({ id: product.id, prompt: editPrompt })}
                          disabled={updatePromptMutation.isPending}
                        >
                          {updatePromptMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingId(null)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="max-w-md truncate" title={product.ai_prompt}>
                      {product.ai_prompt || <span className="text-gray-600 italic">Sin prompt generado</span>}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4">
                  {editingId !== product.id && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditingId(product.id);
                        setEditPrompt(product.ai_prompt || '');
                      }}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
