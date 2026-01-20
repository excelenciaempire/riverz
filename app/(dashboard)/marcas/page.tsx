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
    <div className="mx-auto max-w-7xl">

      <div className="grid gap-6 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {/* Existing Products */}
        {products?.map((product) => (
          <div
            key={product.id}
            className="group relative cursor-pointer overflow-hidden rounded-xl border border-gray-800 bg-[#141414] transition hover:border-gray-700 hover:shadow-lg"
            onClick={() => router.push(`/marcas/${product.id}`)}
          >
             {/* Delete Button (Visible on Hover) */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (confirm('¿Estás seguro de eliminar este producto?')) {
                  deleteProduct.mutate(product.id);
                }
              }}
              className="absolute right-2 top-2 z-10 rounded-full bg-black/60 p-2 text-white opacity-0 backdrop-blur-sm transition-all hover:bg-red-500/80 group-hover:opacity-100"
              title="Eliminar producto"
            >
              <Trash2 className="h-4 w-4" />
            </button>

            <div className="aspect-square overflow-hidden bg-[#0a0a0a]">
              {product.images && product.images.length > 0 ? (
                <img
                  src={product.images[0]}
                  alt={product.name}
                  className="h-full w-full object-cover transition duration-300 group-hover:scale-110"
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <Package className="h-10 w-10 text-gray-700" />
                </div>
              )}
            </div>
            
            <div className="p-4">
              <h3 className="mb-1 truncate text-base font-semibold text-white">{product.name}</h3>
              <p className="text-sm font-medium text-brand-accent">
                {formatPrice(product.price, (product as any).currency)}
              </p>
            </div>
          </div>
        ))}

        {/* Add New Button */}
        <button
          onClick={handleAddProduct}
          className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-800 bg-[#141414]/50 p-4 transition hover:border-brand-accent hover:bg-brand-accent/5"
        >
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-accent/10">
             <Plus className="h-6 w-6 text-brand-accent" />
          </div>
          <p className="text-sm font-semibold text-gray-400 group-hover:text-white">Agregar Nuevo</p>
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
            <Label className="mb-2 block text-sm font-medium text-gray-300">Nombre del Producto</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ej: iPhone 15 Pro"
              className="bg-gray-900/50 border-gray-700"
            />
          </div>

          <div>
            <Label className="mb-2 block text-sm font-medium text-gray-300">Precio de Venta</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-2.5 text-gray-400">$</span>
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
                  <Button variant="outline" className="min-w-[100px] border-gray-700 bg-[#0a0a0a] text-white hover:bg-[#1a1a1a]">
                    <span className="mr-2">{formData.currency}</span>
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="border-gray-800 bg-[#141414] text-gray-300">
                  {CURRENCIES.map((c) => (
                    <DropdownMenuItem 
                      key={c.code}
                      onClick={() => setFormData({ ...formData, currency: c.code })}
                      className="cursor-pointer hover:bg-white/10 hover:text-white"
                    >
                      <span className="w-8 font-bold">{c.code}</span>
                      <span className="text-gray-400">{c.name}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
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
            <Label className="mb-2 block text-sm font-medium text-gray-300">Beneficios del Producto</Label>
            <Textarea
              value={formData.benefits}
              onChange={(e) => setFormData({ ...formData, benefits: e.target.value })}
              placeholder="Lista los beneficios principales: calidad, garantía, entrega rápida..."
              rows={3}
              className="bg-gray-900/50 border-gray-700 resize-none"
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
