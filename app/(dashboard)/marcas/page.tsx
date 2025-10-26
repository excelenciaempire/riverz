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
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Mis Productos</h1>
          <p className="mt-2 text-gray-400">Agrega tu primer producto para comenzar</p>
        </div>

        <div className="rounded-lg border border-gray-700 bg-brand-dark-secondary p-8">
          <div className="space-y-6">
            {/* Product Images */}
            <div>
              <Label className="mb-2 block">Imágenes del Producto</Label>
              <div className="rounded-lg border-2 border-dashed border-gray-700 bg-[#1a2332] p-6">
                <div className="flex flex-col items-center justify-center text-center">
                  <div className="mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-gray-800">
                    <Package className="h-12 w-12 text-gray-600" />
                  </div>
                  <p className="mb-2 text-sm text-gray-400">Click to upload or drag and drop</p>
                  <p className="text-xs text-gray-500">
                    Supported formats: JPEG, PNG, WEBP Maximum file size: 10MB; Maximum file count: 5
                  </p>
                  <FileUpload
                    onFilesSelected={(files) =>
                      setFormData({ ...formData, images: [...formData.images, ...files] })
                    }
                    accept={{ 'image/*': ['.jpg', '.jpeg', '.png', '.webp'] }}
                    multiple
                  />
                </div>
                {formData.images.length > 0 && (
                  <div className="mt-4 grid grid-cols-3 gap-3">
                    {formData.images.map((img, index) => (
                      <div key={index} className="relative aspect-square overflow-hidden rounded-lg">
                        <img
                          src={URL.createObjectURL(img)}
                          alt={`Product ${index + 1}`}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Para mejores resultados, añade mínimo 3 fotos de alta calidad de distintos ángulos del producto
              </p>
            </div>

            {/* Name */}
            <div>
              <Label className="mb-2 block">Nombre</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nombre del producto"
              />
            </div>

            {/* Price */}
            <div>
              <Label className="mb-2 block">Precio de venta</Label>
              <Input
                type="number"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                placeholder="0.00"
              />
            </div>

            {/* Website */}
            <div>
              <Label className="mb-2 block">Sitio web</Label>
              <Input
                value={formData.website}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                placeholder="https://..."
              />
            </div>

            {/* Benefits */}
            <div>
              <Label className="mb-2 block">Beneficios, características, diferenciación</Label>
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
              size="lg"
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
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Mis Productos</h1>
          <p className="mt-2 text-gray-400">Gestiona tus productos</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Existing Products */}
        {products.map((product) => (
          <div
            key={product.id}
            className="overflow-hidden rounded-lg border border-gray-700 bg-brand-dark-secondary"
          >
            <div className="aspect-square overflow-hidden bg-gray-800">
              {product.images && product.images.length > 0 ? (
                <img
                  src={product.images[0]}
                  alt={product.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <Package className="h-16 w-16 text-gray-600" />
                </div>
              )}
            </div>
            
            <div className="p-4">
              <h3 className="mb-1 text-lg font-semibold text-white">{product.name}</h3>
              <p className="mb-4 text-sm text-gray-400">${product.price}</p>
              
              <Button
                onClick={() => downloadReport(product.id)}
                variant="outline"
                className="w-full"
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
          className="flex min-h-[300px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-700 bg-brand-dark-secondary p-8 transition hover:border-brand-accent hover:bg-gray-800"
        >
          <Plus className="mb-4 h-12 w-12 text-brand-accent" />
          <p className="text-lg font-medium text-white">Agregar Nuevo</p>
        </button>
      </div>

      {/* Add Product Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Agregar Producto"
      >
        <div className="space-y-4">
          <div>
            <Label>Nombre</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Nombre del producto"
            />
          </div>

          <div>
            <Label>Precio de venta</Label>
            <Input
              type="number"
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: e.target.value })}
              placeholder="0.00"
            />
          </div>

          <div>
            <Label>Sitio web</Label>
            <Input
              value={formData.website}
              onChange={(e) => setFormData({ ...formData, website: e.target.value })}
              placeholder="https://..."
            />
          </div>

          <div>
            <Label>Beneficios</Label>
            <Textarea
              value={formData.benefits}
              onChange={(e) => setFormData({ ...formData, benefits: e.target.value })}
              placeholder="Describe los beneficios..."
              rows={3}
            />
          </div>

          <div>
            <Label>Imágenes</Label>
            <FileUpload
              onFilesSelected={(files) =>
                setFormData({ ...formData, images: [...formData.images, ...files] })
              }
              accept={{ 'image/*': ['.jpg', '.jpeg', '.png'] }}
              multiple
              preview
            />
          </div>

          <Button
            onClick={() => createProduct.mutate(formData)}
            className="w-full bg-brand-accent hover:bg-brand-accent/90"
            disabled={createProduct.isPending || !formData.name || !formData.price}
          >
            {createProduct.isPending ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
