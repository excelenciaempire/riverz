'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FileUpload } from '@/components/ui/file-upload';
import { ProgressBar } from '@/components/ui/loading';
import { toast } from 'sonner';
import { Download, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ClipsPage() {
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
      const progressInterval = setInterval(() => {
        setProgress((prev) => Math.min(prev + 5, 90));
      }, 1000);

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

      clearInterval(progressInterval);

      if (!response.ok) throw new Error('Failed to generate clip');

      const data = await response.json();
      setProgress(100);
      setResultVideo(data.videoUrl);
      toast.success('Clip generado');
    } catch (error) {
      toast.error('Error al generar clip');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1600px]">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white">Clips</h1>
        <p className="mt-2 text-gray-400">Genera videos cortos con IA</p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[440px_1fr]">
        {/* Left side - Configuration */}
        <div className="space-y-4">
        {/* Optional Image */}
        <div>
          <Label className="mb-1.5 block text-sm">Subir Imagen (Opcional)</Label>
          <div className="rounded-lg border-2 border-gray-700 bg-[#1a2332] p-4">
            <FileUpload
              onFilesSelected={(files) => setImage(files[0])}
              accept={{ 'image/*': ['.jpg', '.jpeg', '.png'] }}
              preview
            />
          </div>
        </div>

        {/* Prompt */}
        <div>
          <Label className="mb-1.5 block text-sm">Prompt</Label>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe el video que quieres crear..."
            rows={5}
            className="bg-[#1a2332]"
          />
        </div>

        {/* Modelo */}
        <div>
          <Label className="mb-2 block text-sm">Modelo</Label>
          <div className="flex gap-3">
            <button
              onClick={() => setModel('sora-2')}
              className={cn(
                'flex-1 rounded-lg border-2 px-6 py-3 text-sm font-medium transition',
                model === 'sora-2'
                  ? 'border-brand-accent bg-brand-accent/10 text-white'
                  : 'border-gray-700 bg-[#1a2332] text-gray-400 hover:border-gray-600'
              )}
            >
              Sora 2
            </button>
            <button
              onClick={() => setModel('sora-2-pro')}
              className={cn(
                'flex-1 rounded-lg border-2 px-6 py-3 text-sm font-medium transition',
                model === 'sora-2-pro'
                  ? 'border-brand-accent bg-brand-accent/10 text-white'
                  : 'border-gray-700 bg-[#1a2332] text-gray-400 hover:border-gray-600'
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
                'flex-1 rounded-lg border-2 px-6 py-3 text-sm font-medium transition',
                format === '9:16'
                  ? 'border-brand-accent bg-brand-accent/10 text-white'
                  : 'border-gray-700 bg-[#1a2332] text-gray-400 hover:border-gray-600'
              )}
            >
              Vertical 9:16
            </button>
            <button
              onClick={() => setFormat('16:9')}
              className={cn(
                'flex-1 rounded-lg border-2 px-6 py-3 text-sm font-medium transition',
                format === '16:9'
                  ? 'border-brand-accent bg-brand-accent/10 text-white'
                  : 'border-gray-700 bg-[#1a2332] text-gray-400 hover:border-gray-600'
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
                'flex-1 rounded-lg border-2 px-6 py-3 text-sm font-medium transition',
                duration === '10'
                  ? 'border-brand-accent bg-brand-accent/10 text-white'
                  : 'border-gray-700 bg-[#1a2332] text-gray-400 hover:border-gray-600'
              )}
            >
              10 Segundos
            </button>
            <button
              onClick={() => setDuration('15')}
              className={cn(
                'flex-1 rounded-lg border-2 px-6 py-3 text-sm font-medium transition',
                duration === '15'
                  ? 'border-brand-accent bg-brand-accent/10 text-white'
                  : 'border-gray-700 bg-[#1a2332] text-gray-400 hover:border-gray-600'
              )}
            >
              15 Segundos
            </button>
          </div>
        </div>

        {/* Generate Button */}
        <Button
          onClick={handleGenerate}
          className="w-full bg-brand-accent text-white hover:bg-brand-accent/90"
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
      <div className="flex flex-col items-center justify-center rounded-lg border border-gray-700 bg-brand-dark-secondary p-8 min-h-[600px]">
        {isGenerating ? (
          <div className="w-full space-y-4">
            <h3 className="text-center text-xl font-semibold text-white">
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
              <Button className="flex-1 bg-brand-accent hover:bg-brand-accent/90">
                <Download className="mr-2 h-4 w-4" />
                Descargar
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center">
            <h2 className="text-8xl font-bold text-white">CLIPS SCREEN</h2>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
