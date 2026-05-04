'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dropdown } from '@/components/ui/dropdown';
import { FileUpload } from '@/components/ui/file-upload';
import { ProgressBar } from '@/components/ui/loading';
import { toast } from 'sonner';
import { 
  Download, 
  Loader2, 
  ArrowLeft,
  X,
  Sparkles,
  Upload
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { startPolling, handleCreditsError } from '@/lib/polling-helper';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Product } from '@/types';
import dynamic from 'next/dynamic';

const CanvasEditor = dynamic(() => import('@/components/editor/CanvasEditor'), { 
  ssr: false,
  loading: () => (
    <div className="h-[600px] w-full animate-pulse bg-[var(--rvz-card)] rounded-xl" />
  )
});

type ModeType = 'crear' | 'clonar' | 'canvas';

const formatOptions = [
  { value: '1:1', label: 'Cuadrado (1:1)' },
  { value: '9:16', label: 'Vertical (9:16)' },
  { value: '16:9', label: 'Horizontal (16:9)' },
  { value: '3:4', label: 'Retrato (3:4)' },
  { value: '4:3', label: 'Paisaje (4:3)' },
  { value: '3:2', label: 'Clásico (3:2)' },
  { value: '2:3', label: 'Vertical Clásico (2:3)' },
];

const variantOptions = [
  { value: '1', label: '1 imagen' },
  { value: '2', label: '2 imágenes' },
  { value: '3', label: '3 imágenes' },
  { value: '4', label: '4 imágenes' },
];

export default function EditarFotoPage() {
  const router = useRouter();
  const [activeMode, setActiveMode] = useState<ModeType>('crear');
  const [prompt, setPrompt] = useState('');
  const [format, setFormat] = useState('1:1');
  const [images, setImages] = useState<File[]>([]);
  const [referenceImage, setReferenceImage] = useState<File | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string>('none');
  const [productImage, setProductImage] = useState<File | null>(null);
  const [numVariants, setNumVariants] = useState('1');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [resultImages, setResultImages] = useState<string[]>([]);

  const { data: products } = useQuery({
    queryKey: ['products-list'],
    queryFn: async () => {
      const response = await fetch('/api/products');
      if (!response.ok) return [];
      return response.json() as Promise<Product[]>;
    },
  });

  const handleGenerate = async () => {
    if (!prompt && activeMode !== 'clonar') {
      toast.error('Por favor escribe un prompt');
      return;
    }

    setIsGenerating(true);
    setProgress(0);

    try {
      let endpoint = '';
      const formData = new FormData();

      switch (activeMode) {
        case 'crear':
          if (images.length > 0) {
             if (images.length > 1) {
                endpoint = '/api/editar-foto/combinar';
                images.forEach((img, i) => formData.append(`image${i}`, img));
             } else {
                endpoint = '/api/editar-foto/editar';
                formData.append('image', images[0]);
             }
          } else {
             endpoint = '/api/editar-foto/crear';
          }
          formData.append('prompt', prompt);
          formData.append('format', format);
          break;

        case 'clonar':
          endpoint = '/api/editar-foto/clonar';
          if (referenceImage) formData.append('referenceImage', referenceImage);
          if (selectedProductId !== 'none') {
             const prod = products?.find(p => p.id === selectedProductId);
             if (prod) {
                if (prod.images && prod.images.length > 0) {
                    const imgRes = await fetch(prod.images[0]);
                    const imgBlob = await imgRes.blob();
                    formData.append('productImage', imgBlob, 'product.jpg');
                }
             }
          } else if (productImage) {
             formData.append('productImage', productImage);
          }
          
          formData.append('prompt', prompt);
          formData.append('format', format);
          formData.append('variants', numVariants);
          break;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        
        if (response.status === 402) {
          handleCreditsError(errorData, router, toast);
          setIsGenerating(false);
          return;
        }
        
        throw new Error(errorData.error || 'Failed to generate image');
      }

      const data = await response.json();
      const { jobId } = data;

      startPolling({
        jobId,
        statusEndpoint: '/api/editar-foto/status',
        onProgress: (progress) => setProgress(progress),
        onComplete: (resultUrl) => {
          setResultImages([resultUrl]);
          toast.success('Imagen generada exitosamente');
          setIsGenerating(false);
        },
        onError: (error) => {
          toast.error(error);
          setIsGenerating(false);
        },
      });

    } catch (error: any) {
      console.error('Generation error:', error);
      toast.error(error.message || 'Error al generar imagen');
      setIsGenerating(false);
    }
  };

  return (
    <div className={cn('flex flex-col', activeMode === 'canvas' ? 'h-[calc(100vh-4rem)]' : '')}>
      <div className="mx-auto w-full max-w-[1600px] mb-6">
        <button
          onClick={() => router.push('/crear')}
          className="mb-4 flex items-center gap-2 text-[var(--rvz-ink-muted)] transition hover:text-[var(--rvz-ink)]"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="text-sm">Volver</span>
        </button>

        <div className="inline-flex gap-2 rounded-full bg-[var(--rvz-card)]/50 p-1.5 border border-[var(--rvz-card-border)]">
          <button
            onClick={() => setActiveMode('crear')}
            className={cn(
              'px-6 py-2.5 text-sm font-medium transition-all rounded-full',
              activeMode === 'crear'
                ? 'bg-[var(--rvz-accent)] text-[var(--rvz-ink)] shadow-lg shadow-brand-accent/20'
                : 'text-[var(--rvz-ink-muted)] hover:text-[var(--rvz-ink)] hover:bg-[var(--rvz-card)]/50'
            )}
          >
            Generar
          </button>
          <button
            onClick={() => setActiveMode('clonar')}
            className={cn(
              'px-6 py-2.5 text-sm font-medium transition-all rounded-full',
              activeMode === 'clonar'
                ? 'bg-[var(--rvz-accent)] text-[var(--rvz-ink)] shadow-lg shadow-brand-accent/20'
                : 'text-[var(--rvz-ink-muted)] hover:text-[var(--rvz-ink)] hover:bg-[var(--rvz-card)]/50'
            )}
          >
            Clonar Estilo
          </button>
          <button
            onClick={() => setActiveMode('canvas')}
            className={cn(
              'px-6 py-2.5 text-sm font-medium transition-all rounded-full',
              activeMode === 'canvas'
                ? 'bg-[var(--rvz-accent)] text-[var(--rvz-ink)] shadow-lg shadow-brand-accent/20'
                : 'text-[var(--rvz-ink-muted)] hover:text-[var(--rvz-ink)] hover:bg-[var(--rvz-card)]/50'
            )}
          >
            Editor Avanzado
          </button>
        </div>
      </div>

      {activeMode === 'canvas' ? (
        <div className="flex-1 overflow-hidden -mt-2">
          <CanvasEditor />
        </div>
      ) : (
        <div className="mx-auto max-w-[1600px] w-full">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[440px_1fr]">
            <div className="space-y-5 rounded-2xl border border-[var(--rvz-card-border)] bg-[var(--rvz-card)]/30 p-6">
              {activeMode === 'crear' && (
                <>
                  <div>
                    <Label className="mb-3 block text-sm font-medium text-[var(--rvz-ink-muted)]">Instrucciones</Label>
                    <Textarea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder=""
                      rows={6}
                      className="resize-none bg-[var(--rvz-card)]/50 border-[var(--rvz-card-border)]"
                    />
                  </div>

                  <div>
                    <Label className="mb-3 block text-sm font-medium text-[var(--rvz-ink-muted)]">Imagen (Opcional)</Label>
                    
                    {images.length > 0 && (
                      <div className="grid grid-cols-4 gap-2">
                        {images.map((img, index) => (
                          <div key={index} className="group relative aspect-square overflow-hidden rounded-lg border border-[var(--rvz-card-border)] bg-[var(--rvz-card)]">
                            <img
                              src={URL.createObjectURL(img)}
                              alt={`Ref ${index + 1}`}
                              className="h-full w-full object-cover"
                            />
                            <button
                              onClick={() => setImages(images.filter((_, i) => i !== index))}
                              className="absolute right-1.5 top-1.5 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-black/70 text-[var(--rvz-ink)] opacity-0 backdrop-blur-sm transition hover:bg-red-500 group-hover:opacity-100"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                        {images.length < 8 && (
                          <button
                            onClick={() => document.getElementById('add-more-images')?.click()}
                            className="aspect-square flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-[var(--rvz-card-border)] bg-[var(--rvz-card)]/50 transition-all hover:border-[var(--rvz-card-hover-border)] hover:bg-[var(--rvz-card)]"
                          >
                            <Upload className="h-5 w-5 text-[var(--rvz-ink-muted)] mb-1" />
                            <span className="text-[10px] text-[var(--rvz-ink-muted)] text-center px-1">Agregar<br />(máx. 8)</span>
                            <input
                              id="add-more-images"
                              type="file"
                              multiple
                              accept="image/*"
                              onChange={(e) => {
                                const files = Array.from(e.target.files || []);
                                const remaining = 8 - images.length;
                                const filesToAdd = files.slice(0, remaining);
                                setImages([...images, ...filesToAdd]);
                                e.target.value = '';
                              }}
                              className="hidden"
                            />
                          </button>
                        )}
                      </div>
                    )}

                    {images.length === 0 && (
                      <FileUpload
                        onFilesSelected={(files) => {
                          const newImages = [...images, ...Array.from(files)].slice(0, 8);
                          setImages(newImages);
                        }}
                        accept={{ 'image/*': ['.jpg', '.jpeg', '.png'] }}
                        multiple
                        maxFiles={8}
                        hideFileList
                        variant="compact"
                      />
                    )}
                  </div>

                  <div>
                    <Label className="mb-3 block text-sm font-medium text-[var(--rvz-ink-muted)]">Formato</Label>
                    <Dropdown
                      options={formatOptions}
                      value={format}
                      onChange={setFormat}
                    />
                  </div>

                  <Button
                    onClick={handleGenerate}
                    className="w-full rounded-2xl bg-[var(--rvz-accent)] py-6 hover:bg-[var(--rvz-accent)]/90"
                    size="lg"
                    disabled={isGenerating}
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Generando...
                      </>
                    ) : (
                      'Generar'
                    )}
                  </Button>
                </>
              )}

              {activeMode === 'clonar' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="mb-3 block text-sm font-medium text-[var(--rvz-ink-muted)]">Referencia</Label>
                      <div className="aspect-[3/4] overflow-hidden rounded-lg">
                        {referenceImage ? (
                          <div className="relative h-full w-full group">
                            <img
                              src={URL.createObjectURL(referenceImage)}
                              alt="Reference"
                              className="h-full w-full object-cover rounded-lg"
                            />
                            <button
                              onClick={() => setReferenceImage(null)}
                              className="absolute top-2 right-2 rounded-full bg-black/80 p-1.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                            >
                              <X className="h-4 w-4 text-[var(--rvz-ink)]" />
                            </button>
                          </div>
                        ) : (
                          <FileUpload
                            onFilesSelected={(files) => setReferenceImage(files[0])}
                            accept={{ 'image/*': ['.jpg', '.jpeg', '.png'] }}
                            variant="compact"
                            hideFileList
                          />
                        )}
                      </div>
                    </div>

                    <div>
                      <Label className="mb-3 block text-sm font-medium text-[var(--rvz-ink-muted)]">Producto</Label>
                      <div className="aspect-[3/4] overflow-hidden rounded-lg">
                        {productImage ? (
                          <div className="relative h-full w-full group">
                            <img
                              src={URL.createObjectURL(productImage)}
                              alt="Product"
                              className="h-full w-full object-cover rounded-lg"
                            />
                            <button
                              onClick={() => setProductImage(null)}
                              className="absolute top-2 right-2 rounded-full bg-black/80 p-1.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                            >
                              <X className="h-4 w-4 text-[var(--rvz-ink)]" />
                            </button>
                          </div>
                        ) : (
                          <FileUpload
                            onFilesSelected={(files) => setProductImage(files[0])}
                            accept={{ 'image/*': ['.jpg', '.jpeg', '.png'] }}
                            variant="compact"
                            hideFileList
                          />
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <Label className="mb-3 block text-sm font-medium text-[var(--rvz-ink-muted)]">Producto Existente <span className="text-[var(--rvz-ink-muted)] text-xs font-normal">(Opcional)</span></Label>
                    <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                      <SelectTrigger className="w-full bg-[var(--rvz-card)]/50 border-[var(--rvz-card-border)] text-[var(--rvz-ink)]">
                        <SelectValue placeholder="Seleccionar producto..." />
                      </SelectTrigger>
                      <SelectContent className="bg-[var(--rvz-card)] border-[var(--rvz-card-border)] text-[var(--rvz-ink-muted)]">
                        <SelectItem value="none">Ninguno</SelectItem>
                        {products?.map(product => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="mb-3 block text-sm font-medium text-[var(--rvz-ink-muted)]">Indicaciones Adicionales <span className="text-[var(--rvz-ink-muted)] text-xs font-normal">(Opcional)</span></Label>
                    <Textarea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder=""
                      rows={3}
                      className="text-sm resize-none bg-[var(--rvz-card)]/50 border-[var(--rvz-card-border)]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="mb-3 block text-sm font-medium text-[var(--rvz-ink-muted)]">Formato</Label>
                      <Dropdown
                        options={formatOptions}
                        value={format}
                        onChange={setFormat}
                      />
                    </div>

                    <div>
                      <Label className="mb-3 block text-sm font-medium text-[var(--rvz-ink-muted)]">Variantes</Label>
                      <Dropdown
                        options={variantOptions}
                        value={numVariants}
                        onChange={setNumVariants}
                      />
                    </div>
                  </div>

                  <Button
                    onClick={handleGenerate}
                    className="w-full rounded-2xl bg-[var(--rvz-accent)] py-6 hover:bg-[var(--rvz-accent)]/90"
                    size="lg"
                    disabled={isGenerating}
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Generando...
                      </>
                    ) : (
                      'Generar'
                    )}
                  </Button>
                </>
              )}
            </div>

            <div className="relative flex flex-col">
              <div className="flex-1 rounded-2xl border border-[var(--rvz-card-border)] bg-[var(--rvz-card)]/30 p-8 flex items-center justify-center min-h-[600px]">
                {isGenerating ? (
                  <div className="w-full space-y-4">
                    <h3 className="text-center text-xl font-semibold text-[var(--rvz-ink)]">
                      Generando imagen...
                    </h3>
                    <ProgressBar progress={progress} />
                  </div>
                ) : resultImages.length > 0 ? (
                  <div className="w-full space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      {resultImages.map((img, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={img}
                            alt={`Result ${index + 1}`}
                            className="w-full rounded-lg"
                          />
                          <button className="absolute bottom-2 right-2 rounded-lg bg-[var(--rvz-accent)] p-2 opacity-0 group-hover:opacity-100 transition">
                            <Download className="h-4 w-4 text-[var(--rvz-ink)]" />
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-4 justify-center">
                      <Button className="bg-[var(--rvz-accent)] hover:bg-[var(--rvz-accent)]/90">
                        <Download className="mr-2 h-4 w-4" />
                        Descargar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center text-[var(--rvz-ink-muted)]">
                    <p>
                      {activeMode === 'crear' && 'La imagen creada aparecerá aquí'}
                      {activeMode === 'clonar' && 'Las variaciones aparecerán aquí'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
