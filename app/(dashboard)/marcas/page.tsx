'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@clerk/nextjs';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { FileUpload } from '@/components/ui/file-upload';
import { Loading } from '@/components/ui/loading';
import { Modal } from '@/components/ui/modal';
import { toast } from 'sonner';
import { Plus, Download, Loader2, Package } from 'lucide-react';
import type { Product } from '@/types';

export default function MarcasPage() {
  const { user } = useUser();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    website: '',
    benefits: '',
    images: [] as File[],
  });
  const [generatingReportId, setGeneratingReportId] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const supabase = createClient();

  // Fetch products
  const { data: products, isLoading } = useQuery({
    queryKey: ['products', user?.id],
    queryFn: async () => {
      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('clerk_id', user!.id)
        .single();

      if (!userData) return [];

      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('user_id', userData.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Product[];
    },
    enabled: !!user,
  });

  // Get user data for plan check
  const { data: userData } = useQuery({
    queryKey: ['user', user?.id],
    queryFn: async () => {
      const response = await fetch('/api/user');
      if (!response.ok) throw new Error('Failed to fetch user');
      return response.json();
    },
    enabled: !!user,
  });

  // Create product mutation
  const createProduct = useMutation({
    mutationFn: async (data: typeof formData) => {
      // Upload images to Supabase storage
      const imageUrls: string[] = [];

      for (const image of data.images) {
        const fileName = `${Date.now()}_${image.name}`;
        const { error: uploadError } = await supabase.storage
          .from('products')
          .upload(fileName, image);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('products')
          .getPublicUrl(fileName);

        imageUrls.push(publicUrl);
      }

      // Get user ID
      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('clerk_id', user!.id)
        .single();

      if (!userData) throw new Error('User not found');

      // Create product
      const { data: product, error } = await supabase
        .from('products')
        .insert({
          user_id: userData.id,
          name: data.name,
          price: parseFloat(data.price),
          website: data.website,
          benefits: data.benefits,
          images: imageUrls,
        })
        .select()
        .single();

      if (error) throw error;
      return product;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setIsModalOpen(false);
      setFormData({
        name: '',
        price: '',
        website: '',
        benefits: '',
        images: [],
      });
      toast.success('Producto agregado');
    },
    onError: () => {
      toast.error('Error al agregar producto');
    },
  });

  // Download report
  const downloadReport = async (productId: string) => {
    setGeneratingReportId(productId);

    try {
      const response = await fetch('/api/marcas/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId }),
      });

      if (!response.ok) throw new Error('Failed to generate report');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'reporte-producto.pdf';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Reporte descargado');
    } catch (error) {
      toast.error('Error al generar reporte');
    } finally {
      setGeneratingReportId(null);
    }
  };

  const canAddProduct = () => {
    if (userData?.plan_type !== 'free') return true;
    return !products || products.length < 1;
  };

  const handleAddProduct = () => {
    if (!canAddProduct()) {
      toast.error('Upgrade tu cuenta para agregar más productos');
      return;
    }
    setIsModalOpen(true);
  };

  if (isLoading) {
    return <Loading text="Cargando productos..." />;
  }

  // Show form if no products
  if (!products || products.length === 0) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-white">Mis Productos</h1>
          <p className="mt-2 text-gray-400">Agrega tu primer producto para comenzar</p>
        </div>

        <div className="rounded-2xl border border-gray-800 bg-[#141414] p-8">
          <div className="space-y-6">
            {/* Product Images */}
            <div>
              <Label className="mb-3 block text-sm font-medium">Imágenes del Producto (máx. 5)</Label>
              {formData.images.length < 5 ? (
                <div className="rounded-xl border-2 border-dashed border-gray-700 bg-[#0a0a0a] p-8 transition hover:border-gray-600">
                  <FileUpload
                    onFilesSelected={(files) => {
                      const remaining = 5 - formData.images.length;
                      const filesToAdd = files.slice(0, remaining);
                      setFormData({ ...formData, images: [...formData.images, ...filesToAdd] });
                      if (files.length > remaining) {
                        toast.warning(`Solo se agregaron ${remaining} imagen(es). Máximo 5 permitidas.`);
                      }
                    }}
                    accept={{ 'image/*': ['.jpg', '.jpeg', '.png', '.webp'] }}
                    multiple
                  />
                </div>
              ) : null}
              
              {formData.images.length > 0 && (
                <div className={`grid grid-cols-5 gap-3 ${formData.images.length < 5 ? 'mt-6' : ''}`}>
                  {formData.images.map((img, index) => (
                    <div key={index} className="group relative aspect-square cursor-pointer overflow-hidden rounded-lg border border-gray-700">
                      <img
                        src={URL.createObjectURL(img)}
                        alt={`Product ${index + 1}`}
                        className="h-full w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const newImages = formData.images.filter((_, i) => i !== index);
                          setFormData({ ...formData, images: newImages });
                        }}
                        className="absolute right-1 top-1 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-red-500 text-white opacity-0 transition hover:bg-red-600 group-hover:opacity-100"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              <p className="mt-3 text-xs text-gray-500">
                Para mejores resultados, añade mínimo 3 fotos de alta calidad de distintos ángulos del producto
              </p>
            </div>

            {/* Name */}
            <div>
              <Label className="mb-2 block text-sm font-medium">Nombre</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nombre del producto"
              />
            </div>

            {/* Price */}
            <div>
              <Label className="mb-2 block text-sm font-medium">Precio de venta</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                placeholder="0.00"
              />
            </div>

            {/* Website */}
            <div>
              <Label className="mb-2 block text-sm font-medium">Sitio web</Label>
              <Input
                value={formData.website}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                placeholder="https://..."
              />
            </div>

            {/* Benefits */}
            <div>
              <Label className="mb-2 block text-sm font-medium">Beneficios</Label>
              <Textarea
                value={formData.benefits}
                onChange={(e) => setFormData({ ...formData, benefits: e.target.value })}
                placeholder="Describe los beneficios y características principales..."
                rows={4}
              />
            </div>

            {/* Submit Button */}
            <Button
              onClick={() => createProduct.mutate(formData)}
              className="w-full bg-brand-accent hover:bg-brand-accent/90"
              disabled={createProduct.isPending || !formData.name || !formData.price}
            >
              {createProduct.isPending ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Guardando...
                </>
              ) : (
                'Guardar'
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Show products grid
  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Mis Productos</h1>
        <p className="mt-2 text-gray-400">Gestiona tus productos y descarga reportes</p>
      </div>

      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        {/* Existing Products */}
        {products.map((product) => (
          <div
            key={product.id}
            className="group overflow-hidden rounded-2xl border border-gray-800 bg-[#141414] transition hover:border-gray-700"
          >
            <div className="aspect-square overflow-hidden bg-[#0a0a0a]">
              {product.images && product.images.length > 0 ? (
                <img
                  src={product.images[0]}
                  alt={product.name}
                  className="h-full w-full object-cover transition group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <Package className="h-16 w-16 text-gray-700" />
                </div>
              )}
            </div>
            
            <div className="p-5">
              <h3 className="mb-1 text-lg font-semibold text-white">{product.name}</h3>
              <p className="mb-4 text-base text-gray-400">${product.price}</p>
              
              <Button
                onClick={() => downloadReport(product.id)}
                variant="outline"
                className="w-full border-gray-700 hover:border-brand-accent hover:bg-brand-accent/10"
                disabled={generatingReportId === product.id}
              >
                {generatingReportId === product.id ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generando...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Descargar Reporte
                  </>
                )}
              </Button>
            </div>
          </div>
        ))}

        {/* Add New Button */}
        <button
          onClick={handleAddProduct}
          className="flex min-h-[380px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-800 bg-[#141414] p-8 transition hover:border-brand-accent hover:bg-[#1a1a1a]"
        >
          <Plus className="mb-4 h-12 w-12 text-brand-accent" />
          <p className="text-lg font-semibold text-white">Agregar Nuevo</p>
        </button>
      </div>

      {/* Add Product Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Agregar Producto"
      >
        <div className="space-y-5">
          <div>
            <Label className="mb-2 block text-sm font-medium">Imágenes (máx. 5)</Label>
            {formData.images.length < 5 ? (
              <div className="rounded-xl border-2 border-dashed border-gray-700 bg-[#0a0a0a] p-6">
                <FileUpload
                  onFilesSelected={(files) => {
                    const remaining = 5 - formData.images.length;
                    const filesToAdd = files.slice(0, remaining);
                    setFormData({ ...formData, images: [...formData.images, ...filesToAdd] });
                    if (files.length > remaining) {
                      toast.warning(`Solo se agregaron ${remaining} imagen(es). Máximo 5 permitidas.`);
                    }
                  }}
                  accept={{ 'image/*': ['.jpg', '.jpeg', '.png'] }}
                  multiple
                />
              </div>
            ) : null}
            
            {formData.images.length > 0 && (
              <div className={`grid grid-cols-3 gap-3 ${formData.images.length < 5 ? 'mt-4' : ''}`}>
                {formData.images.map((img, index) => (
                  <div key={index} className="group relative aspect-square cursor-pointer overflow-hidden rounded-lg border border-gray-700">
                    <img
                      src={URL.createObjectURL(img)}
                      alt={`Product ${index + 1}`}
                      className="h-full w-full object-cover"
                    />
                    <button
                      onClick={() => {
                        const newImages = formData.images.filter((_, i) => i !== index);
                        setFormData({ ...formData, images: newImages });
                      }}
                      className="absolute right-1.5 top-1.5 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full bg-red-500 text-xs text-white opacity-0 transition hover:bg-red-600 group-hover:opacity-100"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <Label className="mb-2 block text-sm font-medium">Nombre</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Nombre del producto"
            />
          </div>

          <div>
            <Label className="mb-2 block text-sm font-medium">Precio de venta</Label>
            <Input
              type="number"
              step="0.01"
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: e.target.value })}
              placeholder="0.00"
            />
          </div>

          <div>
            <Label className="mb-2 block text-sm font-medium">Sitio web</Label>
            <Input
              value={formData.website}
              onChange={(e) => setFormData({ ...formData, website: e.target.value })}
              placeholder="https://..."
            />
          </div>

          <div>
            <Label className="mb-2 block text-sm font-medium">Beneficios</Label>
            <Textarea
              value={formData.benefits}
              onChange={(e) => setFormData({ ...formData, benefits: e.target.value })}
              placeholder="Describe los beneficios..."
              rows={3}
            />
          </div>

          <Button
            onClick={() => createProduct.mutate(formData)}
            className="w-full bg-brand-accent hover:bg-brand-accent/90"
            disabled={createProduct.isPending || !formData.name || !formData.price}
          >
            {createProduct.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : (
              'Guardar'
            )}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
