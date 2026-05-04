'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
import { Plus, Download, Loader2, Package, Trash2, DollarSign, ChevronDown, Upload, X } from 'lucide-react';
import type { Product } from '@/types';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

const CURRENCIES = [
  { code: 'COP', symbol: '$', locale: 'es-CO', name: 'Peso Colombiano' },
  { code: 'USD', symbol: '$', locale: 'en-US', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', locale: 'de-DE', name: 'Euro' },
  { code: 'MXN', symbol: '$', locale: 'es-MX', name: 'Peso Mexicano' },
];

export default function MarcasPage() {
  const { user } = useUser();
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  // Default currency for new product
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    website: '',
    benefits: '',
    images: [] as File[],
    currency: 'COP',
  });

  const queryClient = useQueryClient();

  // Fetch products
  const { data: products, isLoading } = useQuery({
    queryKey: ['products', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const response = await fetch('/api/products');
      if (!response.ok) {
        console.error('Error fetching products via API');
        return [];
      }
      return response.json() as Promise<Product[]>;
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

  // Delete product mutation
  const deleteProduct = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/products/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete product');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Producto eliminado');
    },
    onError: () => {
      toast.error('Error al eliminar producto');
    },
  });

  // Create product mutation
  const createProduct = useMutation({
    mutationFn: async (data: typeof formData) => {
      // 1. Upload images via Signed URLs (bypassing Vercel 4.5MB limit & RLS)
      const imageUrls: string[] = [];

      for (const image of data.images) {
        // A. Get Signed URL from Server
        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            filename: image.name,
            contentType: image.type 
          }),
        });

        if (!uploadRes.ok) {
           const err = await uploadRes.text();
           throw new Error(`Failed to get upload URL: ${err}`);
        }
        
        const { signedUrl, publicUrl } = await uploadRes.json();

        // B. Upload directly to Supabase Storage using Signed URL
        const uploadToStorage = await fetch(signedUrl, {
          method: 'PUT',
          body: image,
          headers: {
            'Content-Type': image.type,
          },
        });

        if (!uploadToStorage.ok) {
           throw new Error(`Failed to upload to storage: ${uploadToStorage.statusText}`);
        }

        imageUrls.push(publicUrl);
      }

      // 2. Create product via Server API
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: data.name,
          price: parseFloat(data.price),
          website: data.website,
          benefits: data.benefits,
          images: imageUrls,
          currency: data.currency,
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`Product creation failed: ${err}`);
      }

      const product = await response.json();
      return product;
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setIsModalOpen(false);
      setFormData({
        name: '',
        price: '',
        website: '',
        benefits: '',
        images: [],
        currency: 'COP',
      });
      toast.success('Producto agregado');
      
      // Redirect to Product Details page
      router.push(`/marcas/${data.id}`);
    },
    onError: () => {
      toast.error('Error al agregar producto');
    },
  });

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

  const formatPrice = (price: number, currencyCode?: string) => {
    // Default to COP if not specified
    const code = currencyCode || 'COP';
    const currencyInfo = CURRENCIES.find(c => c.code === code) || CURRENCIES[0];
    
    return new Intl.NumberFormat(currencyInfo.locale, {
      style: 'currency',
      currency: code,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  if (isLoading) {
    return <Loading text="Cargando productos..." />;
  }

  // Show products grid
  return (
    <div className="space-y-8">
      <section className="page-hero">
        <p className="app-v2-eyebrow">Tus marcas</p>
        <h1 className="app-v2-page-h1 mt-2">
          Marcas y productos.
          <br />
          <span className="text-[var(--rvz-ink-muted)]">El research que alimenta todo.</span>
        </h1>
        <p className="mt-4 max-w-xl text-[14px] leading-relaxed text-[var(--rvz-ink-muted)]">
          Cada marca alimenta a los 8 agentes con su voz, audiencia y ángulos. Subí fotos,
          precio y beneficios — el Investigador hace el resto.
        </p>
      </section>

      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {/* Existing Products */}
        {products?.map((product) => (
          <div
            key={product.id}
            className="card-cream group relative cursor-pointer overflow-hidden p-0 transition hover:-translate-y-0.5 hover:border-[var(--rvz-card-hover-border)]"
            onClick={() => router.push(`/marcas/${product.id}`)}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (confirm('¿Estás seguro de eliminar este producto?')) {
                  deleteProduct.mutate(product.id);
                }
              }}
              className="absolute right-2 top-2 z-10 rounded-full border border-[var(--rvz-card-border)] bg-[var(--rvz-card)] p-1.5 text-[var(--rvz-ink-muted)] opacity-0 backdrop-blur-sm transition-all hover:border-red-400 hover:text-red-500 group-hover:opacity-100"
              title="Eliminar producto"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>

            <div className="aspect-square overflow-hidden bg-[var(--rvz-bg-soft)]">
              {product.images && product.images.length > 0 ? (
                <img
                  src={product.images[0]}
                  alt={product.name}
                  className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-[var(--rvz-ink-faint)]">
                  <Package className="h-10 w-10" />
                </div>
              )}
            </div>

            <div className="p-3">
              <h3 className="mb-0.5 truncate text-[14px] font-medium tracking-tight">
                {product.name}
              </h3>
              <p className="text-[13px] text-[var(--rvz-ink-muted)]">
                {formatPrice(product.price, (product as any).currency)}
              </p>
            </div>
          </div>
        ))}

        {/* Add New Button */}
        <button
          onClick={handleAddProduct}
          className="group flex flex-col items-center justify-center rounded-[14px] border-2 border-dashed border-[var(--rvz-card-border)] bg-[var(--rvz-bg-soft)] p-4 transition hover:border-[var(--rvz-ink)] hover:bg-[var(--rvz-card)]"
        >
          <div className="mb-3 grid h-10 w-10 place-items-center rounded-lg bg-[var(--rvz-ink)] text-[var(--rvz-accent)]">
            <Plus className="h-5 w-5" />
          </div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--rvz-ink-muted)] group-hover:text-[var(--rvz-ink)]">
            Agregar producto
          </p>
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
            <Label className="mb-2 block text-sm font-medium text-gray-300">Imágenes del Producto</Label>
            
            {formData.images.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {formData.images.map((img, index) => (
                  <div key={index} className="group relative aspect-square overflow-hidden rounded-lg border border-gray-700 bg-gray-900">
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
                      className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/80 text-white opacity-0 backdrop-blur-sm transition hover:bg-red-600 group-hover:opacity-100"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                {formData.images.length < 5 && (
                  <button
                    onClick={() => document.getElementById('add-product-images')?.click()}
                    className="aspect-square flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-700 bg-gray-900/50 transition-all hover:border-gray-600 hover:bg-gray-900"
                  >
                    <Upload className="h-6 w-6 text-gray-400 mb-1" />
                    <span className="text-xs text-gray-400">Agregar</span>
                    <input
                      id="add-product-images"
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        const remaining = 5 - formData.images.length;
                        const filesToAdd = files.slice(0, remaining);
                        setFormData({ ...formData, images: [...formData.images, ...filesToAdd] });
                        if (files.length > remaining) {
                          toast.warning(`Solo se agregaron ${remaining} imagen(es). Máximo 5 permitidas.`);
                        }
                        e.target.value = '';
                      }}
                      className="hidden"
                    />
                  </button>
                )}
              </div>
            )}

            {formData.images.length === 0 && (
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
                hideFileList
                variant="compact"
              />
            )}
          </div>

          <div>
            <Label className="mb-2 block text-[12px] font-medium text-[var(--rvz-ink-muted)]">Nombre del producto</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ej: iPhone 15 Pro"
            />
          </div>

          <div>
            <Label className="mb-2 block text-[12px] font-medium text-[var(--rvz-ink-muted)]">Precio de venta</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-2.5 text-[var(--rvz-ink-faint)]">$</span>
                <Input
                  type="number"
                  step="0.01"
                  className="pl-7"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="min-w-[100px]">
                    <span className="mr-2">{formData.currency}</span>
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="border-[var(--rvz-card-border)] bg-[var(--rvz-card)] text-[var(--rvz-ink)]">
                  {CURRENCIES.map((c) => (
                    <DropdownMenuItem
                      key={c.code}
                      onClick={() => setFormData({ ...formData, currency: c.code })}
                      className="cursor-pointer hover:bg-[var(--rvz-bg-soft)]"
                    >
                      <span className="w-8 font-bold">{c.code}</span>
                      <span className="text-[var(--rvz-ink-muted)]">{c.name}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div>
            <Label className="mb-2 block text-[12px] font-medium text-[var(--rvz-ink-muted)]">Sitio web</Label>
            <Input
              value={formData.website}
              onChange={(e) => setFormData({ ...formData, website: e.target.value })}
              placeholder="https://..."
            />
          </div>

          <div>
            <Label className="mb-2 block text-[12px] font-medium text-[var(--rvz-ink-muted)]">Beneficios del producto</Label>
            <Textarea
              value={formData.benefits}
              onChange={(e) => setFormData({ ...formData, benefits: e.target.value })}
              placeholder="Lista los beneficios principales: calidad, garantía, entrega rápida..."
              rows={3}
              className="resize-none"
            />
          </div>

          <Button
            onClick={() => createProduct.mutate(formData)}
            className="w-full"
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
