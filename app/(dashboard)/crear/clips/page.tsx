'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FileUpload } from '@/components/ui/file-upload';
import { ProgressBar } from '@/components/ui/loading';
import { toast } from 'sonner';
import { Download, Loader2, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { startPolling, handleCreditsError } from '@/lib/polling-helper';

export default function ClipsPage() {
  const router = useRouter();
  const [image, setImage] = useState<File | null>(null);
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState('sora-2');
  const [format, setFormat] = useState('9:16');
  const [duration, setDuration] = useState('10');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [resultVideo, setResultVideo] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt) {
      toast.error('Por favor escribe un prompt');
      return;
    }

    setIsGenerating(true);
    setProgress(0);

    try {
      const formData = new FormData();
      if (image) formData.append('image', image);
      formData.append('prompt', prompt);
      formData.append('model', model);
      formData.append('format', format);
      formData.append('duration', duration);

      const response = await fetch('/api/clips/generate', {
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
        
        throw new Error(errorData.error || 'Failed to generate clip');
      }

      const data = await response.json();
      const { jobId } = data;

      startPolling({
        jobId,
        statusEndpoint: '/api/clips/status',
        onProgress: (progress) => setProgress(progress),
        onComplete: (resultUrl) => {
          setResultVideo(resultUrl);
          toast.success('Clip generado exitosamente');
          setIsGenerating(false);
        },
        onError: (error) => {
          toast.error(error);
          setIsGenerating(false);
        },
      });

    } catch (error: any) {
      console.error('Generation error:', error);
      toast.error(error.message || 'Error al generar clip');
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

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[440px_1fr]">
        {/* Left side - Configuration */}
        <div className="space-y-4">
        {/* Optional Image */}
        <div>
          <Label className="mb-1.5 block text-sm">Subir Imagen (Opcional)</Label>
          <FileUpload
            onFilesSelected={(files) => setImage(files[0])}
            accept={{ 'image/*': ['.jpg', '.jpeg', '.png'] }}
            variant="minimal"
            hideFileList
          />
        </div>

        {/* Prompt */}
        <div>
          <Label className="mb-1.5 block text-sm">Prompt</Label>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe el video que quieres crear..."
            rows={5}
          />
        </div>

        {/* Modelo */}
        <div>
          <Label className="mb-2 block text-sm">Modelo</Label>
          <div className="flex gap-3">
            <button
              onClick={() => setModel('sora-2')}
              className={cn(
                'flex-1 cursor-pointer rounded-xl border-2 px-6 py-3 text-sm font-medium transition',
                model === 'sora-2'
                  ? 'border-[var(--rvz-ink)] bg-[var(--rvz-accent)]/10 text-[var(--rvz-ink)]'
                  : 'border-[var(--rvz-card-border)] bg-[var(--rvz-bg)] text-[var(--rvz-ink-muted)] hover:border-[var(--rvz-card-border)]'
              )}
            >
              Sora 2
            </button>
            <button
              onClick={() => setModel('sora-2-pro')}
              className={cn(
                'flex-1 cursor-pointer rounded-xl border-2 px-6 py-3 text-sm font-medium transition',
                model === 'sora-2-pro'
                  ? 'border-[var(--rvz-ink)] bg-[var(--rvz-accent)]/10 text-[var(--rvz-ink)]'
                  : 'border-[var(--rvz-card-border)] bg-[var(--rvz-bg)] text-[var(--rvz-ink-muted)] hover:border-[var(--rvz-card-border)]'
              )}
            >
              Sora 2 Pro
            </button>
          </div>
        </div>

        {/* Formato */}
        <div>
          <Label className="mb-2 block text-sm">Formato</Label>
          <div className="flex gap-3">
            <button
              onClick={() => setFormat('9:16')}
              className={cn(
                'flex-1 cursor-pointer rounded-xl border-2 px-6 py-3 text-sm font-medium transition',
                format === '9:16'
                  ? 'border-[var(--rvz-ink)] bg-[var(--rvz-accent)]/10 text-[var(--rvz-ink)]'
                  : 'border-[var(--rvz-card-border)] bg-[var(--rvz-bg)] text-[var(--rvz-ink-muted)] hover:border-[var(--rvz-card-border)]'
              )}
            >
              Vertical 9:16
            </button>
            <button
              onClick={() => setFormat('16:9')}
              className={cn(
                'flex-1 cursor-pointer rounded-xl border-2 px-6 py-3 text-sm font-medium transition',
                format === '16:9'
                  ? 'border-[var(--rvz-ink)] bg-[var(--rvz-accent)]/10 text-[var(--rvz-ink)]'
                  : 'border-[var(--rvz-card-border)] bg-[var(--rvz-bg)] text-[var(--rvz-ink-muted)] hover:border-[var(--rvz-card-border)]'
              )}
            >
              Horizontal 16:9
            </button>
          </div>
        </div>

        {/* Duración */}
        <div>
          <Label className="mb-2 block text-sm">Duración</Label>
          <div className="flex gap-3">
            <button
              onClick={() => setDuration('10')}
              className={cn(
                'flex-1 cursor-pointer rounded-xl border-2 px-6 py-3 text-sm font-medium transition',
                duration === '10'
                  ? 'border-[var(--rvz-ink)] bg-[var(--rvz-accent)]/10 text-[var(--rvz-ink)]'
                  : 'border-[var(--rvz-card-border)] bg-[var(--rvz-bg)] text-[var(--rvz-ink-muted)] hover:border-[var(--rvz-card-border)]'
              )}
            >
              10 Segundos
            </button>
            <button
              onClick={() => setDuration('15')}
              className={cn(
                'flex-1 cursor-pointer rounded-xl border-2 px-6 py-3 text-sm font-medium transition',
                duration === '15'
                  ? 'border-[var(--rvz-ink)] bg-[var(--rvz-accent)]/10 text-[var(--rvz-ink)]'
                  : 'border-[var(--rvz-card-border)] bg-[var(--rvz-bg)] text-[var(--rvz-ink-muted)] hover:border-[var(--rvz-card-border)]'
              )}
            >
              15 Segundos
            </button>
          </div>
        </div>

        {/* Generate Button */}
        <Button
          onClick={handleGenerate}
          className="w-full rounded-2xl bg-[var(--rvz-accent)] py-6 text-[var(--rvz-ink)] hover:bg-[var(--rvz-accent)]/90"
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

        {/* Right side - Result */}
      <div className="flex flex-col items-center justify-center rounded-lg border border-[var(--rvz-card-border)] bg-[var(--rvz-card)] p-8 min-h-[600px]">
        {isGenerating ? (
          <div className="w-full space-y-4">
            <h3 className="text-center text-xl font-semibold text-[var(--rvz-ink)]">
              Generando Clip...
            </h3>
            <ProgressBar progress={progress} />
          </div>
        ) : resultVideo ? (
          <div className="w-full">
            <video src={resultVideo} controls className="w-full rounded-lg" />
            <div className="mt-6 flex gap-4">
              <Button variant="outline" className="flex-1">
                Editar
              </Button>
              <Button variant="outline" className="flex-1">
                Aumentar
              </Button>
              <Button className="flex-1 bg-[var(--rvz-accent)] hover:bg-[var(--rvz-accent)]/90">
                <Download className="mr-2 h-4 w-4" />
                Descargar
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center text-[var(--rvz-ink-muted)]">
            <p>El clip generado aparecerá aquí</p>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
