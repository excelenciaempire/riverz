'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { FileUpload } from '@/components/ui/file-upload';
import { ProgressBar } from '@/components/ui/loading';
import { toast } from 'sonner';
import { Download, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type ModeType = 'video' | 'imagen';

export default function MejorarCalidadPage() {
  const [activeMode, setActiveMode] = useState<ModeType>('video');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [upscaleFactor, setUpscaleFactor] = useState(1);
  const [targetFps, setTargetFps] = useState(30);
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
        formData.append('targetFps', targetFps.toString());
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
    <div className="mx-auto max-w-[1600px]">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white">Mejorar Calidad</h1>
        <p className="mt-2 text-gray-400">Mejora la calidad de videos e imágenes con IA</p>
      </div>

      {/* Tabs */}
      <div className="mb-8 flex gap-6 border-b border-gray-800">
        <button
          onClick={() => setActiveMode('video')}
          className={cn(
            'pb-3 text-base transition',
            activeMode === 'video'
              ? 'border-b-2 border-brand-accent font-medium text-white'
              : 'text-gray-400 hover:text-white'
          )}
        >
          Video
        </button>
        <button
          onClick={() => setActiveMode('imagen')}
          className={cn(
            'pb-3 text-base transition',
            activeMode === 'imagen'
              ? 'border-b-2 border-brand-accent font-medium text-white'
              : 'text-gray-400 hover:text-white'
          )}
        >
          Imagen
        </button>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[440px_1fr]">
        {/* Left side - Configuration */}
        <div className="space-y-4">
          {/* VIDEO Mode */}
          {activeMode === 'video' && (
            <>
              <div>
                <Label className="mb-2 block">Subir Video</Label>
                <div className="rounded-2xl border border-gray-800 bg-[#0a0a0a] p-6">
                  <FileUpload
                    onFilesSelected={(files) => setVideoFile(files[0])}
                    accept={{ 'video/*': ['.mp4', '.mov', '.avi'] }}
                  />
                </div>
                {videoFile && (
                  <p className="mt-2 text-sm text-gray-400">
                    URL del video a upscale: {videoFile.name}
                  </p>
                )}
              </div>

              {/* upscale_factor */}
              <div>
                <Label className="mb-3 block">upscale_factor</Label>
                <div className="rounded-2xl border border-gray-800 bg-[#0a0a0a] p-6">
                  <div className="flex items-center justify-between gap-4">
                    <input
                      type="range"
                      min="1"
                      max="4"
                      step="0.1"
                      value={upscaleFactor}
                      onChange={(e) => setUpscaleFactor(parseFloat(e.target.value))}
                      className="flex-1 accent-brand-accent"
                    />
                    <div className="flex items-center gap-2">
                      <span className="text-white">{upscaleFactor.toFixed(1)}</span>
                      <button
                        onClick={() => setUpscaleFactor(1)}
                        className="rounded bg-gray-800 px-2 py-1 text-xs text-gray-400 hover:bg-gray-700"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    Factor to upscale the video by (e.g. 2.0 doubles width and height)
                  </p>
                </div>
              </div>

              {/* target_fps */}
              <div>
                <Label className="mb-3 block">target_fps</Label>
                <div className="rounded-2xl border border-gray-800 bg-[#0a0a0a] p-6">
                  <div className="flex items-center justify-between gap-4">
                    <input
                      type="range"
                      min="24"
                      max="120"
                      step="1"
                      value={targetFps}
                      onChange={(e) => setTargetFps(parseInt(e.target.value))}
                      className="flex-1 accent-brand-accent"
                    />
                    <div className="flex items-center gap-2">
                      <span className="text-white">{targetFps}</span>
                      <button
                        onClick={() => setTargetFps(30)}
                        className="rounded bg-gray-800 px-2 py-1 text-xs text-gray-400 hover:bg-gray-700"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    Target FPS for frame interpolation. If set, frame interpolation will be enabled.
                  </p>
                </div>
              </div>

              {/* H264_output */}
              <div>
                <Label className="mb-3 block">H264_output</Label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setH264Output(true)}
                    className={cn(
                      'flex-1 rounded-lg px-6 py-3 text-sm font-medium transition',
                      h264Output
                        ? 'bg-brand-accent text-white'
                        : 'bg-[#1a2332] text-gray-400 hover:bg-gray-800'
                    )}
                  >
                    True
                  </button>
                  <button
                    onClick={() => setH264Output(false)}
                    className={cn(
                      'flex-1 rounded-lg px-6 py-3 text-sm font-medium transition',
                      !h264Output
                        ? 'bg-brand-accent text-white'
                        : 'bg-[#1a2332] text-gray-400 hover:bg-gray-800'
                    )}
                  >
                    False
                  </button>
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  Whether to use H264 codec for output video. Default is H265.
                </p>
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

          {/* IMAGEN Mode */}
          {activeMode === 'imagen' && (
            <>
              <div>
                <Label className="mb-2 block">Subir Imagen</Label>
                <div className="rounded-2xl border border-gray-800 bg-[#0a0a0a] p-6">
                  <FileUpload
                    onFilesSelected={(files) => setImageFile(files[0])}
                    accept={{ 'image/*': ['.jpg', '.jpeg', '.png'] }}
                    preview
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
        <div className="flex flex-col items-center justify-center rounded-lg border border-gray-700 bg-brand-dark-secondary p-8 min-h-[600px]">
          {isGenerating ? (
            <div className="w-full space-y-4">
              <h3 className="text-center text-xl font-semibold text-white">
                Mejorando calidad...
              </h3>
              <ProgressBar progress={progress} />
            </div>
          ) : resultUrl ? (
            <div className="w-full space-y-6">
              {activeMode === 'video' ? (
                <video src={resultUrl} controls className="w-full rounded-lg" />
              ) : (
                <img src={resultUrl} alt="Result" className="w-full rounded-lg" />
              )}
              
              <Button className="w-full bg-brand-accent hover:bg-brand-accent/90">
                <Download className="mr-2 h-4 w-4" />
                Descargar
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-center text-gray-500">
              <p>
                {activeMode === 'video' ? 'El video mejorado aparecerá aquí' : 'La imagen mejorada aparecerá aquí'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
