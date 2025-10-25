'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dropdown } from '@/components/ui/dropdown';
import { FileUpload } from '@/components/ui/file-upload';
import { ProgressBar } from '@/components/ui/loading';
import { toast } from 'sonner';
import { Download, Loader2 } from 'lucide-react';

type ModeType = 'video' | 'imagen';

const fpsOptions = [
  { value: '24', label: '24 FPS' },
  { value: '30', label: '30 FPS' },
  { value: '60', label: '60 FPS' },
];

export default function MejorarCalidadPage() {
  const [activeMode, setActiveMode] = useState<ModeType>('video');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [upscaleFactor, setUpscaleFactor] = useState(1);
  const [targetFps, setTargetFps] = useState('30');
  const [h264Output, setH264Output] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  const handleGenerate = async () => {
    const file = activeMode === 'video' ? videoFile : imageFile;

    if (!file) {
      toast.error('Por favor sube un archivo');
      return;
    }

    setIsGenerating(true);
    setProgress(0);

    try {
      const progressInterval = setInterval(() => {
        setProgress((prev) => Math.min(prev + 5, 90));
      }, 1000);

      const formData = new FormData();
      formData.append('file', file);

      if (activeMode === 'video') {
        formData.append('upscaleFactor', upscaleFactor.toString());
        formData.append('targetFps', targetFps);
        formData.append('h264Output', h264Output.toString());
      }

      const endpoint =
        activeMode === 'video'
          ? '/api/mejorar-calidad/video'
          : '/api/mejorar-calidad/imagen';

      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);

      if (!response.ok) throw new Error('Failed to improve quality');

      const data = await response.json();
      setProgress(100);
      setResultUrl(data.url);
      toast.success(`${activeMode === 'video' ? 'Video' : 'Imagen'} mejorado`);
    } catch (error) {
      toast.error('Error al mejorar calidad');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white">MEJORAR CALIDAD</h1>

        {/* Mode Tabs */}
        <div className="flex gap-4">
          <button
            onClick={() => setActiveMode('video')}
            className={`rounded-lg px-4 py-2 ${
              activeMode === 'video'
                ? 'bg-brand-accent text-white'
                : 'bg-brand-dark-secondary text-gray-400 hover:text-white'
            }`}
          >
            Video
          </button>
          <button
            onClick={() => setActiveMode('imagen')}
            className={`rounded-lg px-4 py-2 ${
              activeMode === 'imagen'
                ? 'bg-brand-accent text-white'
                : 'bg-brand-dark-secondary text-gray-400 hover:text-white'
            }`}
          >
            Imagen
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Left side - Configuration */}
        <div className="space-y-6">
          {/* VIDEO MODE */}
          {activeMode === 'video' && (
            <>
              <div>
                <Label>Subir Video</Label>
                <FileUpload
                  onFilesSelected={(files) => setVideoFile(files[0])}
                  accept={{ 'video/*': ['.mp4', '.mov', '.avi'] }}
                />
              </div>

              {/* Upscale Factor Slider */}
              <div>
                <Label>
                  Upscale Factor: {upscaleFactor} (2.0 duplica ancho y alto)
                </Label>
                <input
                  type="range"
                  min="1"
                  max="4"
                  step="0.1"
                  value={upscaleFactor}
                  onChange={(e) => setUpscaleFactor(parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>

              {/* Target FPS */}
              <div>
                <Label>Target FPS</Label>
                <Dropdown
                  options={fpsOptions}
                  value={targetFps}
                  onChange={setTargetFps}
                />
                <p className="mt-1 text-xs text-gray-400">
                  Si está configurado, se habilitará la interpolación de fotogramas
                </p>
              </div>

              {/* H264 Output Toggle */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="h264"
                  checked={h264Output}
                  onChange={(e) => setH264Output(e.target.checked)}
                  className="h-4 w-4"
                />
                <Label htmlFor="h264" className="cursor-pointer">
                  H264 Output
                </Label>
              </div>
              <p className="text-xs text-gray-400">
                Si usar códec H264 para video de salida. Por defecto es H265.
              </p>
            </>
          )}

          {/* IMAGEN MODE */}
          {activeMode === 'imagen' && (
            <div>
              <Label>Subir Imagen</Label>
              <FileUpload
                onFilesSelected={(files) => setImageFile(files[0])}
                accept={{ 'image/*': ['.jpg', '.jpeg', '.png', '.webp'] }}
                preview
              />
            </div>
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
                Procesando...
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
                Mejorando calidad...
              </h3>
              <ProgressBar progress={progress} />
            </div>
          ) : resultUrl ? (
            <div className="w-full">
              {activeMode === 'video' ? (
                <video src={resultUrl} controls className="w-full rounded-lg" />
              ) : (
                <img
                  src={resultUrl}
                  alt="Resultado"
                  className="w-full rounded-lg"
                />
              )}
              <Button className="mt-4 w-full">
                <Download className="mr-2 h-4 w-4" />
                Descargar
              </Button>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-4xl font-bold text-yellow-400">
                {activeMode === 'video' ? 'VIDEO' : 'IMAGEN'}
              </p>
              <p className="mt-4 text-gray-400">
                Sube tu {activeMode === 'video' ? 'video' : 'imagen'} para mejorar su calidad
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

