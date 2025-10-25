'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dropdown } from '@/components/ui/dropdown';
import { FileUpload } from '@/components/ui/file-upload';
import { ProgressBar } from '@/components/ui/loading';
import { toast } from 'sonner';
import { Download, Loader2, Undo2, Redo2, RotateCcw } from 'lucide-react';

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
  const [activeMode, setActiveMode] = useState<ModeType>('crear');
  const [prompt, setPrompt] = useState('');
  const [format, setFormat] = useState('1:1');
  const [image, setImage] = useState<File | null>(null);
  const [images, setImages] = useState<File[]>([]);
  const [referenceImage, setReferenceImage] = useState<File | null>(null);
  const [productImage, setProductImage] = useState<File | null>(null);
  const [numVariants, setNumVariants] = useState('1');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [resultImages, setResultImages] = useState<string[]>([]);
  const [versionHistory, setVersionHistory] = useState<string[]>([]);
  const [currentVersion, setCurrentVersion] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const handleGenerate = async () => {
    if (!prompt) {
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
          // Canvas data would be added here
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
          formData.append('prompt', prompt);
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
        setVersionHistory([...versionHistory, ...data.images]);
      }

      toast.success('Imagen generada');
    } catch (error) {
      toast.error('Error al generar imagen');
    } finally {
      setIsGenerating(false);
    }
  };

  const usePrevious = () => {
    if (currentVersion > 0) {
      setCurrentVersion(currentVersion - 1);
    }
  };

  const redo = () => {
    if (currentVersion < versionHistory.length - 1) {
      setCurrentVersion(currentVersion + 1);
    }
  };

  const reset = () => {
    // Reset canvas or drawing tools
    toast.info('Canvas reiniciado');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white">EDITAR FOTO</h1>

        {/* Mode Tabs */}
        <div className="flex gap-4">
          <button
            onClick={() => setActiveMode('crear')}
            className={`rounded-lg px-4 py-2 ${
              activeMode === 'crear'
                ? 'bg-brand-accent text-white'
                : 'bg-brand-dark-secondary text-gray-400 hover:text-white'
            }`}
          >
            Crear
          </button>
          <button
            onClick={() => setActiveMode('editar')}
            className={`rounded-lg px-4 py-2 ${
              activeMode === 'editar'
                ? 'bg-brand-accent text-white'
                : 'bg-brand-dark-secondary text-gray-400 hover:text-white'
            }`}
          >
            Editar
          </button>
          <button
            onClick={() => setActiveMode('combinar')}
            className={`rounded-lg px-4 py-2 ${
              activeMode === 'combinar'
                ? 'bg-brand-accent text-white'
                : 'bg-brand-dark-secondary text-gray-400 hover:text-white'
            }`}
          >
            Combinar
          </button>
          <button
            onClick={() => setActiveMode('clonar')}
            className={`rounded-lg px-4 py-2 ${
              activeMode === 'clonar'
                ? 'bg-brand-accent text-white'
                : 'bg-brand-dark-secondary text-gray-400 hover:text-white'
            }`}
          >
            Clonar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Left side - Configuration */}
        <div className="space-y-6">
          {/* CREAR MODE */}
          {activeMode === 'crear' && (
            <>
              <div>
                <Label>Prompt</Label>
                <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe la imagen que quieres crear..."
                  rows={4}
                />
              </div>

              <div>
                <Label>Formato</Label>
                <Dropdown
                  options={formatOptions}
                  value={format}
                  onChange={setFormat}
                />
              </div>
            </>
          )}

          {/* EDITAR MODE */}
          {activeMode === 'editar' && (
            <>
              {!image ? (
                <div>
                  <Label>Subir Imagen</Label>
                  <FileUpload
                    onFilesSelected={(files) => setImage(files[0])}
                    accept={{ 'image/*': ['.jpg', '.jpeg', '.png'] }}
                    preview
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <Label>Qué te gustaría hacer?</Label>
                    <Input
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder="Ej: Cambia el fondo, añade texto..."
                    />
                  </div>

                  {/* Drawing Tools Placeholder */}
                  <div className="flex gap-2">
                    <Button variant="outline" size="icon">
                      ✏️
                    </Button>
                    <Button variant="outline" size="icon">
                      T
                    </Button>
                    <Button variant="outline" size="icon">
                      →
                    </Button>
                    <Button variant="outline" size="icon">
                      🖼️
                    </Button>
                    <Button variant="outline" size="icon">
                      P
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* COMBINAR MODE */}
          {activeMode === 'combinar' && (
            <>
              <div>
                <Label>Subir Imágenes</Label>
                <FileUpload
                  onFilesSelected={setImages}
                  accept={{ 'image/*': ['.jpg', '.jpeg', '.png'] }}
                  maxFiles={5}
                  multiple
                  preview
                />
              </div>

              <div>
                <Label>Prompt</Label>
                <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe cómo combinar las imágenes..."
                  rows={3}
                />
              </div>

              <div>
                <Label>Formato</Label>
                <Dropdown
                  options={formatOptions}
                  value={format}
                  onChange={setFormat}
                />
              </div>
            </>
          )}

          {/* CLONAR MODE */}
          {activeMode === 'clonar' && (
            <>
              <div>
                <Label>Imagen de Referencia</Label>
                <FileUpload
                  onFilesSelected={(files) => setReferenceImage(files[0])}
                  accept={{ 'image/*': ['.jpg', '.jpeg', '.png'] }}
                  preview
                />
              </div>

              <div>
                <Label>Foto del Producto</Label>
                <FileUpload
                  onFilesSelected={(files) => setProductImage(files[0])}
                  accept={{ 'image/*': ['.jpg', '.jpeg', '.png'] }}
                  preview
                />
              </div>

              <div>
                <Label>Especificaciones</Label>
                <Input
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Agrega detalles específicos..."
                />
              </div>

              <div>
                <Label>Formato</Label>
                <Dropdown
                  options={formatOptions}
                  value={format}
                  onChange={setFormat}
                />
              </div>

              <div>
                <Label>Número de Variantes</Label>
                <Dropdown
                  options={variantOptions}
                  value={numVariants}
                  onChange={setNumVariants}
                />
              </div>
            </>
          )}

          {/* Generate Button */}
          <Button
            onClick={handleGenerate}
            className="w-full"
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
        </div>

        {/* Right side - Preview/Result */}
        <div className="flex flex-col items-center justify-center rounded-lg border border-gray-700 bg-brand-dark-secondary p-8">
          {isGenerating ? (
            <div className="w-full space-y-4">
              <h3 className="text-center text-xl font-semibold text-white">
                Generando imagen...
              </h3>
              <ProgressBar progress={progress} />
            </div>
          ) : resultImages.length > 0 ? (
            <div className="w-full space-y-4">
              {activeMode === 'clonar' ? (
                <div className="grid grid-cols-2 gap-4">
                  {resultImages.map((img, index) => (
                    <div key={index} className="relative">
                      <img
                        src={img}
                        alt={`Resultado ${index + 1}`}
                        className="w-full rounded-lg"
                      />
                      <Button
                        size="icon"
                        className="absolute bottom-2 right-2"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <img
                    src={resultImages[currentVersion] || resultImages[0]}
                    alt="Resultado"
                    className="w-full rounded-lg"
                  />

                  {activeMode === 'editar' && versionHistory.length > 0 && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={usePrevious}
                        disabled={currentVersion === 0}
                      >
                        <Undo2 className="mr-2 h-4 w-4" />
                        Use Previous
                      </Button>
                      <Button
                        variant="outline"
                        onClick={redo}
                        disabled={currentVersion === versionHistory.length - 1}
                      >
                        <Redo2 className="mr-2 h-4 w-4" />
                        Redo
                      </Button>
                      <Button variant="outline" onClick={reset}>
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Reset
                      </Button>
                    </div>
                  )}

                  <Button className="w-full">
                    <Download className="mr-2 h-4 w-4" />
                    Descargar
                  </Button>
                </>
              )}
            </div>
          ) : (
            <div className="text-center">
              <p className="text-4xl font-bold text-yellow-400">
                EDITAR FOTO SCREEN
              </p>
              <p className="mt-4 text-gray-400">
                {activeMode === 'crear' && 'Escribe un prompt para crear una imagen'}
                {activeMode === 'editar' && 'Sube una imagen para editar'}
                {activeMode === 'combinar' && 'Sube múltiples imágenes para combinar'}
                {activeMode === 'clonar' && 'Sube una referencia y producto para clonar'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

