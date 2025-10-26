'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
  Undo2, 
  Redo2, 
  RotateCcw,
  Pencil,
  Type,
  ArrowRight,
  Image as ImageIcon,
  Palette,
  ArrowLeft
} from 'lucide-react';
import { cn } from '@/lib/utils';

type ModeType = 'crear' | 'editar' | 'combinar' | 'clonar';

const formatOptions = [
  { value: '1:1', label: '1:1' },
  { value: '9:16', label: '9:16' },
  { value: '16:9', label: '16:9' },
  { value: '3:4', label: '3:4' },
  { value: '4:3', label: '4:3' },
  { value: '3:2', label: '3:2' },
  { value: '2:3', label: '2:3' },
  { value: '5:4', label: '5:4' },
  { value: '4:5', label: '4:5' },
  { value: '21:9', label: '21:9' },
  { value: 'auto', label: 'Auto' },
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
  const [image, setImage] = useState<File | null>(null);
  const [images, setImages] = useState<File[]>([]);
  const [referenceImage, setReferenceImage] = useState<File | null>(null);
  const [productImage, setProductImage] = useState<File | null>(null);
  const [numVariants, setNumVariants] = useState('1');
  const [specificRequests, setSpecificRequests] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [resultImages, setResultImages] = useState<string[]>([]);
  const [versionHistory, setVersionHistory] = useState<string[]>([]);
  const [currentVersion, setCurrentVersion] = useState(0);

  const handleGenerate = async () => {
    if (!prompt && activeMode !== 'clonar') {
      toast.error('Por favor escribe un prompt');
      return;
    }

    setIsGenerating(true);
    setProgress(0);

    try {
      const progressInterval = setInterval(() => {
        setProgress((prev) => Math.min(prev + 5, 90));
      }, 1000);

      let endpoint = '';
      const formData = new FormData();

      switch (activeMode) {
        case 'crear':
          endpoint = '/api/editar-foto/crear';
          formData.append('prompt', prompt);
          formData.append('format', format);
          break;

        case 'editar':
          endpoint = '/api/editar-foto/editar';
          if (image) formData.append('image', image);
          formData.append('prompt', prompt);
          break;

        case 'combinar':
          endpoint = '/api/editar-foto/combinar';
          images.forEach((img, index) => {
            formData.append(`image${index}`, img);
          });
          formData.append('prompt', prompt);
          formData.append('format', format);
          break;

        case 'clonar':
          endpoint = '/api/editar-foto/clonar';
          if (referenceImage) formData.append('referenceImage', referenceImage);
          if (productImage) formData.append('productImage', productImage);
          formData.append('prompt', specificRequests);
          formData.append('format', format);
          formData.append('numVariants', numVariants);
          break;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);

      if (!response.ok) throw new Error('Failed to generate image');

      const data = await response.json();
      setProgress(100);
      setResultImages(Array.isArray(data.images) ? data.images : [data.imageUrl]);
      
      if (activeMode === 'editar') {
        setVersionHistory([...versionHistory, ...(Array.isArray(data.images) ? data.images : [data.imageUrl])]);
      }

      toast.success('Imagen generada');
    } catch (error) {
      toast.error('Error al generar imagen');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1600px]">
      {/* Back Button */}
      <button
        onClick={() => router.push('/crear')}
        className="mb-4 flex items-center gap-2 text-gray-400 transition hover:text-white"
      >
        <ArrowLeft className="h-5 w-5" />
        <span className="text-sm">Volver</span>
      </button>

      {/* Tabs */}
      <div className="mb-8 flex gap-6 border-b border-gray-800">
        <button
          onClick={() => setActiveMode('crear')}
          className={cn(
            'pb-3 text-base transition',
            activeMode === 'crear'
              ? 'border-b-2 border-brand-accent font-medium text-white'
              : 'text-gray-400 hover:text-white'
          )}
        >
          Crear
        </button>
        <button
          onClick={() => setActiveMode('editar')}
          className={cn(
            'pb-3 text-base transition',
            activeMode === 'editar'
              ? 'border-b-2 border-brand-accent font-medium text-white'
              : 'text-gray-400 hover:text-white'
          )}
        >
          Editar
        </button>
        <button
          onClick={() => setActiveMode('combinar')}
          className={cn(
            'pb-3 text-base transition',
            activeMode === 'combinar'
              ? 'border-b-2 border-brand-accent font-medium text-white'
              : 'text-gray-400 hover:text-white'
          )}
        >
          Combinar
        </button>
        <button
          onClick={() => setActiveMode('clonar')}
          className={cn(
            'pb-3 text-base transition',
            activeMode === 'clonar'
              ? 'border-b-2 border-brand-accent font-medium text-white'
              : 'text-gray-400 hover:text-white'
          )}
        >
          Clonar
        </button>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[440px_1fr]">
        {/* Left side - Configuration */}
        <div className="space-y-4">
          {/* CREAR Mode */}
          {activeMode === 'crear' && (
            <>
              <div>
                <Label className="mb-2 block">Prompt</Label>
                <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe la imagen que quieres crear..."
                  rows={6}
                />
              </div>

              <div>
                <Label className="mb-2 block">Formato</Label>
                <Dropdown
                  options={formatOptions}
                  value={format}
                  onChange={setFormat}
                />
              </div>

              <Button
                onClick={handleGenerate}
                className="w-full rounded-2xl bg-brand-accent py-6 hover:bg-brand-accent/90"
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

          {/* EDITAR Mode */}
          {activeMode === 'editar' && (
            <>
              <div>
                <Label className="mb-2 block">Subir Imagen</Label>
                <div className="overflow-hidden rounded-2xl border-2 border-gray-800 bg-[#0a0a0a]">
                  <FileUpload
                    onFilesSelected={(files) => setImage(files[0])}
                    accept={{ 'image/*': ['.jpg', '.jpeg', '.png'] }}
                    preview
                  />
                </div>
              </div>

              <div>
                <Label className="mb-2 block">Qué te gustaría hacer?</Label>
                <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe los cambios que quieres hacer..."
                  rows={4}
                />
              </div>

              <Button
                onClick={handleGenerate}
                className="w-full rounded-2xl bg-brand-accent py-6 hover:bg-brand-accent/90"
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

          {/* COMBINAR Mode */}
          {activeMode === 'combinar' && (
            <>
              <div>
                <Label className="mb-2 block">Subir Imágenes (Máximo 5)</Label>
                {images.length < 5 ? (
                  <div className="overflow-hidden rounded-2xl border-2 border-dashed border-gray-800 bg-[#0a0a0a]">
                    <FileUpload
                      onFilesSelected={(files) => {
                        const newImages = [...images, ...Array.from(files)].slice(0, 5);
                        setImages(newImages);
                      }}
                      accept={{ 'image/*': ['.jpg', '.jpeg', '.png'] }}
                      multiple
                      maxFiles={5}
                      hideFileList
                    />
                  </div>
                ) : null}
                {images.length > 0 && (
                  <div className={`grid grid-cols-5 gap-2 ${images.length < 5 ? 'mt-4' : ''}`}>
                    {images.map((img, index) => (
                      <div key={index} className="group relative aspect-square overflow-hidden rounded-lg border-2 border-gray-700">
                        <img
                          src={URL.createObjectURL(img)}
                          alt={`Imagen ${index + 1}`}
                          className="h-full w-full object-cover"
                        />
                        <button
                          onClick={() => setImages(images.filter((_, i) => i !== index))}
                          className="absolute right-1 top-1 cursor-pointer rounded-full bg-red-500 p-1 text-white opacity-0 transition hover:bg-red-600 group-hover:opacity-100"
                        >
                          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <Label className="mb-2 block">Prompt</Label>
                <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe cómo quieres combinar las imágenes..."
                  rows={4}
                />
              </div>

              <div>
                <Label className="mb-2 block">Formato</Label>
                <Dropdown
                  options={formatOptions}
                  value={format}
                  onChange={setFormat}
                />
              </div>

              <Button
                onClick={handleGenerate}
                className="w-full rounded-2xl bg-brand-accent py-6 hover:bg-brand-accent/90"
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

          {/* CLONAR Mode */}
          {activeMode === 'clonar' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="mb-2 block text-center text-sm">Imagen de Referencia</Label>
                  <div className="aspect-square overflow-hidden rounded-2xl border-2 border-gray-800 bg-[#0a0a0a]">
                    {referenceImage ? (
                      <img
                        src={URL.createObjectURL(referenceImage)}
                        alt="Reference"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <FileUpload
                        onFilesSelected={(files) => setReferenceImage(files[0])}
                        accept={{ 'image/*': ['.jpg', '.jpeg', '.png'] }}
                        preview
                      />
                    )}
                  </div>
                </div>

                <div>
                  <Label className="mb-2 block text-center text-sm">Imagen del Producto</Label>
                  <div className="aspect-square overflow-hidden rounded-2xl border-2 border-gray-800 bg-[#0a0a0a]">
                    {productImage ? (
                      <img
                        src={URL.createObjectURL(productImage)}
                        alt="Product"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <FileUpload
                        onFilesSelected={(files) => setProductImage(files[0])}
                        accept={{ 'image/*': ['.jpg', '.jpeg', '.png'] }}
                        preview
                      />
                    )}
                  </div>
                </div>
              </div>

              <div>
                <Label className="mb-2 block">Solicitudes Específicas (Opcional)</Label>
                <Textarea
                  value={specificRequests}
                  onChange={(e) => setSpecificRequests(e.target.value)}
                  placeholder="Describe detalles específicos: ángulos, colores, estilo, iluminación, etc."
                  rows={3}
                  className="text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="mb-2 block">Format</Label>
                  <Dropdown
                    options={formatOptions}
                    value={format}
                    onChange={setFormat}
                    placeholder="Portrait (2:3)"
                  />
                </div>

                <div>
                  <Label className="mb-2 block">Image</Label>
                  <Dropdown
                    options={variantOptions}
                    value={numVariants}
                    onChange={setNumVariants}
                  />
                </div>
              </div>

              <Button
                onClick={handleGenerate}
                className="w-full rounded-2xl bg-brand-accent py-6 hover:bg-brand-accent/90"
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

        {/* Right side - Result */}
        <div className="relative flex flex-col">
          {activeMode === 'editar' && resultImages.length > 0 && (
            <div className="absolute right-0 top-0 flex flex-col gap-2 rounded-l-lg bg-[#1a2332] p-2">
              <button className="rounded-lg p-3 text-white hover:bg-gray-800">
                <Pencil className="h-5 w-5" />
              </button>
              <button className="rounded-lg p-3 text-white hover:bg-gray-800">
                <Type className="h-5 w-5" />
              </button>
              <button className="rounded-lg p-3 text-white hover:bg-gray-800">
                <ArrowRight className="h-5 w-5" />
              </button>
              <button className="rounded-lg p-3 text-white hover:bg-gray-800">
                <ImageIcon className="h-5 w-5" />
              </button>
              <button className="rounded-lg p-3 text-white hover:bg-gray-800">
                <Palette className="h-5 w-5" />
              </button>
              <div className="my-2 h-px bg-gray-700" />
              <button className="rounded-lg p-3 text-white hover:bg-gray-800">
                <Undo2 className="h-5 w-5" />
              </button>
              <button className="rounded-lg p-3 text-white hover:bg-gray-800">
                <Redo2 className="h-5 w-5" />
              </button>
              <button className="rounded-lg p-3 text-red-400 hover:bg-gray-800">
                <RotateCcw className="h-5 w-5" />
              </button>
            </div>
          )}

          <div className="flex-1 rounded-lg border border-gray-700 bg-brand-dark-secondary p-8 flex items-center justify-center min-h-[600px]">
            {isGenerating ? (
              <div className="w-full space-y-4">
                <h3 className="text-center text-xl font-semibold text-white">
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
                      <button className="absolute bottom-2 right-2 rounded-lg bg-brand-accent p-2 opacity-0 group-hover:opacity-100 transition">
                        <Download className="h-4 w-4 text-white" />
                      </button>
                    </div>
                  ))}
                </div>

                {activeMode === 'editar' && (
                  <div className="flex gap-3 justify-center">
                    <Button variant="outline" size="sm">
                      <Undo2 className="mr-2 h-4 w-4" />
                      Use Previous
                    </Button>
                    <Button variant="outline" size="sm">
                      <Redo2 className="mr-2 h-4 w-4" />
                      Redo
                    </Button>
                    <Button variant="outline" size="sm">
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Reset
                    </Button>
                  </div>
                )}

                <div className="flex gap-4 justify-center">
                  <Button variant="outline">Editar</Button>
                  <Button variant="outline">Aumentar</Button>
                  <Button className="bg-brand-accent hover:bg-brand-accent/90">
                    <Download className="mr-2 h-4 w-4" />
                    Descargar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center text-gray-500">
                <p>
                  {activeMode === 'crear' && 'La imagen creada aparecerá aquí'}
                  {activeMode === 'editar' && 'La imagen editada aparecerá aquí'}
                  {activeMode === 'combinar' && 'Las imágenes combinadas aparecerán aquí'}
                  {activeMode === 'clonar' && 'Las variaciones aparecerán aquí'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
