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
import { Plus, Download, Loader2 } from 'lucide-react';
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
        const { data: uploadData, error: uploadError } = await supabase.storage
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
      toast.success('Producto creado exitosamente');
    },
    onError: () => {
      toast.error('Error al crear producto');
    },
  });

  // Generate report
  const generateReport = async (productId: string) => {
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
      a.download = `reporte-${productId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success('Reporte descargado');
    } catch (error) {
      toast.error('Error al generar reporte');
    } finally {
      setGeneratingReportId(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.images.length < 3) {
      toast.error('Por favor sube al menos 3 imágenes');
      return;
    }

    createProduct.mutate(formData);
  };

  const canAddProduct = userData?.plan_type !== 'free' || (products?.length || 0) < 1;

  if (isLoading) {
    return <Loading text="Cargando productos..." />;
  }

  // Empty state
  if (!products || products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <h1 className="mb-8 text-3xl font-bold text-white">Mis Productos</h1>
        
        <div className="w-full max-w-2xl rounded-lg border border-gray-700 bg-brand-dark-secondary p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label htmlFor="name">Nombre *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="price">Precio de venta (USD) *</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="website">Sitio web *</Label>
              <Input
                id="website"
                type="url"
                value={formData.website}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="benefits">Beneficios, características, diferenciación *</Label>
              <Textarea
                id="benefits"
                value={formData.benefits}
                onChange={(e) => setFormData({ ...formData, benefits: e.target.value })}
                rows={4}
                required
              />
            </div>

            <div>
              <Label>Imágenes del Producto *</Label>
              <p className="mb-2 text-xs text-gray-400">
                Para mejores resultados, añada mínimo 3 fotos de alta calidad de distintos ángulos del producto
              </p>
              <FileUpload
                onFilesSelected={(files) => setFormData({ ...formData, images: files })}
                accept={{ 'image/*': ['.jpg', '.jpeg', '.png', '.webp'] }}
                maxFiles={10}
                multiple
                preview
              />
            </div>

            <Button type="submit" className="w-full" disabled={createProduct.isPending}>
              {createProduct.isPending ? 'Guardando...' : 'Guardar'}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  // Products list
  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white">Mis Productos</h1>
        <Button
          onClick={() => {
            if (!canAddProduct) {
              toast.error('Plan gratuito limitado a 1 producto. Actualiza tu plan para agregar más.');
              return;
            }
            setIsModalOpen(true);
          }}
          disabled={!canAddProduct}
        >
          <Plus className="mr-2 h-4 w-4" />
          Agregar Nuevo
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <div
            key={product.id}
            className="rounded-lg border border-gray-700 bg-brand-dark-secondary p-6"
          >
            <div className="mb-4">
              {product.images[0] && (
                <img
                  src={product.images[0]}
                  alt={product.name}
                  className="h-48 w-full rounded-lg object-cover"
                />
              )}
            </div>

            <h3 className="mb-2 text-lg font-semibold text-white">{product.name}</h3>
            <p className="mb-1 text-sm text-gray-400">
              Precio: ${product.price.toFixed(2)}
            </p>
            <p className="mb-4 text-sm text-gray-400 truncate">
              {product.website}
            </p>

            <Button
              onClick={() => generateReport(product.id)}
              variant="outline"
              className="w-full"
              disabled={generatingReportId === product.id}
            >
              {generatingReportId === product.id ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generando Reporte...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Descargar Reporte
                </>
              )}
            </Button>
          </div>
        ))}
      </div>

      {/* Add Product Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Agregar Producto"
        className="max-w-2xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="modal-name">Nombre *</Label>
            <Input
              id="modal-name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div>
            <Label htmlFor="modal-price">Precio de venta (USD) *</Label>
            <Input
              id="modal-price"
              type="number"
              step="0.01"
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: e.target.value })}
              required
            />
          </div>

          <div>
            <Label htmlFor="modal-website">Sitio web *</Label>
            <Input
              id="modal-website"
              type="url"
              value={formData.website}
              onChange={(e) => setFormData({ ...formData, website: e.target.value })}
              required
            />
          </div>

          <div>
            <Label htmlFor="modal-benefits">Beneficios *</Label>
            <Textarea
              id="modal-benefits"
              value={formData.benefits}
              onChange={(e) => setFormData({ ...formData, benefits: e.target.value })}
              rows={3}
              required
            />
          </div>

          <div>
            <Label>Imágenes *</Label>
            <FileUpload
              onFilesSelected={(files) => setFormData({ ...formData, images: files })}
              accept={{ 'image/*': ['.jpg', '.jpeg', '.png', '.webp'] }}
              maxFiles={10}
              multiple
              preview
            />
          </div>

          <Button type="submit" className="w-full" disabled={createProduct.isPending}>
            {createProduct.isPending ? 'Guardando...' : 'Guardar'}
          </Button>
        </form>
      </Modal>
    </div>
  );
}

