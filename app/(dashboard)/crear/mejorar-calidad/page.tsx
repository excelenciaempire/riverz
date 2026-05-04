'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { FileUpload } from '@/components/ui/file-upload';
import { ProgressBar } from '@/components/ui/loading';
import { toast } from 'sonner';
import { Download, Loader2, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { startPolling, handleCreditsError } from '@/lib/polling-helper';

type ModeType = 'video' | 'imagen';

export default function MejorarCalidadPage() {
  const router = useRouter();
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
      const formData = new FormData();
      formData.append('file', file);

      if (activeMode === 'video') {
        formData.append('targetResolution', '1080p');
        formData.append('enhanceDetails', 'true');
        formData.append('reduceNoise', 'true');
      } else {
        formData.append('targetResolution', '4k');
        formData.append('enhanceDetails', 'true');
      }

      const endpoint =
        activeMode === 'video'
          ? '/api/mejorar-calidad/video'
          : '/api/mejorar-calidad/imagen';

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
        
        throw new Error(errorData.error || 'Failed to improve quality');
      }

      const data = await response.json();
      const { jobId } = data;

      startPolling({
        jobId,
        statusEndpoint: '/api/mejorar-calidad/status',
        onProgress: (progress) => setProgress(progress),
        onComplete: (resultUrl) => {
          setResultUrl(resultUrl);
          toast.success(`${activeMode === 'video' ? 'Video' : 'Imagen'} mejorado exitosamente`);
          setIsGenerating(false);
        },
        onError: (error) => {
          toast.error(error);
          setIsGenerating(false);
        },
      });

    } catch (error: any) {
      console.error('Generation error:', error);
      toast.error(error.message || 'Error al mejorar calidad');
      setIsGenerating(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1600px]">
      {/* Back Button */}
      <button
        onClick={() => router.push('/crear')}
        className="mb-4 flex items-center gap-2 text-[var(--rvz-ink-muted)] transition hover:text-[var(--rvz-ink)]"
      >
        <ArrowLeft className="h-5 w-5" />
        <span className="text-sm">Volver</span>
      </button>

      {/* Tabs */}
      <div className="mb-8 flex gap-6 border-b border-[var(--rvz-card-border)]">
        <button
          onClick={() => setActiveMode('video')}
          className={cn(
            'pb-3 text-base transition',
            activeMode === 'video'
              ? 'border-b-2 border-[var(--rvz-ink)] font-medium text-[var(--rvz-ink)]'
              : 'text-[var(--rvz-ink-muted)] hover:text-[var(--rvz-ink)]'
          )}
        >
          Video
        </button>
        <button
          onClick={() => setActiveMode('imagen')}
          className={cn(
            'pb-3 text-base transition',
            activeMode === 'imagen'
              ? 'border-b-2 border-[var(--rvz-ink)] font-medium text-[var(--rvz-ink)]'
              : 'text-[var(--rvz-ink-muted)] hover:text-[var(--rvz-ink)]'
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
                <FileUpload
                  onFilesSelected={(files) => setVideoFile(files[0])}
                  accept={{ 'video/*': ['.mp4', '.mov', '.avi'] }}
                  maxSize={100 * 1024 * 1024}
                  variant="minimal"
                  hideFileList
                />
                {videoFile && (
                  <p className="mt-2 text-sm text-[var(--rvz-ink-muted)]">
                    Archivo: {videoFile.name}
                  </p>
                )}
              </div>

              {/* upscale_factor */}
              <div>
                <Label className="mb-3 block">upscale_factor</Label>
                <div className="rounded-2xl border border-[var(--rvz-card-border)] bg-[var(--rvz-bg)] p-6">
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
                      <span className="text-[var(--rvz-ink)]">{upscaleFactor.toFixed(1)}</span>
                      <button
                        onClick={() => setUpscaleFactor(1)}
                        className="rounded bg-[var(--rvz-card)] px-2 py-1 text-xs text-[var(--rvz-ink-muted)] hover:bg-[var(--rvz-bg-soft)]"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-[var(--rvz-ink-muted)]">
                    Factor to upscale the video by (e.g. 2.0 doubles width and height)
                  </p>
                </div>
              </div>

              {/* target_fps */}
              <div>
                <Label className="mb-3 block">target_fps</Label>
                <div className="rounded-2xl border border-[var(--rvz-card-border)] bg-[var(--rvz-bg)] p-6">
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
                      <span className="text-[var(--rvz-ink)]">{targetFps}</span>
                      <button
                        onClick={() => setTargetFps(30)}
                        className="rounded bg-[var(--rvz-card)] px-2 py-1 text-xs text-[var(--rvz-ink-muted)] hover:bg-[var(--rvz-bg-soft)]"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-[var(--rvz-ink-muted)]">
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
                        ? 'bg-[var(--rvz-accent)] text-[var(--rvz-ink)]'
                        : 'bg-[#1a2332] text-[var(--rvz-ink-muted)] hover:bg-[var(--rvz-card)]'
                    )}
                  >
                    True
                  </button>
                  <button
                    onClick={() => setH264Output(false)}
                    className={cn(
                      'flex-1 rounded-lg px-6 py-3 text-sm font-medium transition',
                      !h264Output
                        ? 'bg-[var(--rvz-accent)] text-[var(--rvz-ink)]'
                        : 'bg-[#1a2332] text-[var(--rvz-ink-muted)] hover:bg-[var(--rvz-card)]'
                    )}
                  >
                    False
                  </button>
                </div>
                <p className="mt-2 text-xs text-[var(--rvz-ink-muted)]">
                  Whether to use H264 codec for output video. Default is H265.
                </p>
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

          {/* IMAGEN Mode */}
          {activeMode === 'imagen' && (
            <>
              <div>
                <Label className="mb-2 block">Subir Imagen</Label>
                <FileUpload
                  onFilesSelected={(files) => setImageFile(files[0])}
                  accept={{ 'image/*': ['.jpg', '.jpeg', '.png'] }}
                  variant="minimal"
                  hideFileList
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
        </div>

        {/* Right side - Result */}
        <div className="flex flex-col items-center justify-center rounded-lg border border-[var(--rvz-card-border)] bg-[var(--rvz-card)] p-8 min-h-[600px]">
          {isGenerating ? (
            <div className="w-full space-y-4">
              <h3 className="text-center text-xl font-semibold text-[var(--rvz-ink)]">
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
              
              <Button className="w-full bg-[var(--rvz-accent)] hover:bg-[var(--rvz-accent)]/90">
                <Download className="mr-2 h-4 w-4" />
                Descargar
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-center text-[var(--rvz-ink-muted)]">
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
