'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dropdown } from '@/components/ui/dropdown';
import { FileUpload } from '@/components/ui/file-upload';
import { ProgressBar } from '@/components/ui/loading';
import { toast } from 'sonner';
import { Download, Loader2 } from 'lucide-react';

const modelOptions = [
  { value: 'sora-2', label: 'Sora 2' },
  { value: 'sora-2-pro', label: 'Sora 2 Pro' },
];

const formatOptions = [
  { value: '9:16', label: 'Vertical 9:16' },
  { value: '16:9', label: 'Horizontal 16:9' },
  { value: '1:1', label: 'Cuadrado 1:1' },
];

const durationOptions = [
  { value: '10', label: '10 Segundos' },
  { value: '15', label: '15 Segundos' },
];

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
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
      {/* Left side - Configuration */}
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-white">CLIPS</h1>

        {/* Optional Image */}
        <div>
          <Label>Subir Imagen (Opcional)</Label>
          <FileUpload
            onFilesSelected={(files) => setImage(files[0])}
            accept={{ 'image/*': ['.jpg', '.jpeg', '.png'] }}
            preview
          />
        </div>

        {/* Prompt */}
        <div>
          <Label>Prompt</Label>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe el video que quieres generar..."
            rows={4}
          />
        </div>

        {/* Model */}
        <div>
          <Label>Modelo</Label>
          <div className="grid grid-cols-2 gap-4">
            {modelOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setModel(option.value)}
                className={`rounded-lg border-2 p-4 transition ${
                  model === option.value
                    ? 'border-brand-accent bg-brand-accent/10'
                    : 'border-gray-700 hover:border-gray-600'
                }`}
              >
                <p className="text-white">{option.label}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Format */}
        <div>
          <Label>Formato</Label>
          <div className="grid grid-cols-3 gap-4">
            {formatOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setFormat(option.value)}
                className={`rounded-lg border-2 p-4 transition ${
                  format === option.value
                    ? 'border-brand-accent bg-brand-accent/10'
                    : 'border-gray-700 hover:border-gray-600'
                }`}
              >
                <p className="text-sm text-white">{option.label}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Duration */}
        <div>
          <Label>Duración</Label>
          <div className="grid grid-cols-2 gap-4">
            {durationOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setDuration(option.value)}
                className={`rounded-lg border-2 p-4 transition ${
                  duration === option.value
                    ? 'border-brand-accent bg-brand-accent/10'
                    : 'border-gray-700 hover:border-gray-600'
                }`}
              >
                <p className="text-white">{option.label}</p>
              </button>
            ))}
          </div>
        </div>

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
              Generando clip...
            </h3>
            <ProgressBar progress={progress} />
          </div>
        ) : resultVideo ? (
          <div className="w-full">
            <video src={resultVideo} controls className="w-full rounded-lg" />
            <div className="mt-4 flex gap-4">
              <Button variant="outline" className="flex-1">
                Editar
              </Button>
              <Button variant="outline" className="flex-1">
                Aumentar
              </Button>
              <Button className="flex-1">
                <Download className="mr-2 h-4 w-4" />
                Descargar
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-4xl font-bold text-yellow-400">CLIPS SCREEN</p>
            <p className="mt-4 text-gray-400">
              Configura tu clip y haz clic en Generar
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

