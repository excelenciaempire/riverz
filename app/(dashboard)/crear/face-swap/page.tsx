'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dropdown } from '@/components/ui/dropdown';
import { FileUpload } from '@/components/ui/file-upload';
import { ProgressBar } from '@/components/ui/loading';
import { toast } from 'sonner';
import { Download, Loader2 } from 'lucide-react';

const resolutionOptions = [
  { value: '720p', label: '720p' },
  { value: '1080p', label: '1080p' },
  { value: '4k', label: '4K' },
];

const formatOptions = [
  { value: '9:16', label: 'Vertical 9:16' },
  { value: '16:9', label: 'Horizontal 16:9' },
  { value: '1:1', label: 'Cuadrado 1:1' },
];

export default function FaceSwapPage() {
  const [sourceVideo, setSourceVideo] = useState<File | null>(null);
  const [characterImage, setCharacterImage] = useState<File | null>(null);
  const [resolution, setResolution] = useState('720p');
  const [format, setFormat] = useState('9:16');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [resultVideo, setResultVideo] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!sourceVideo || !characterImage) {
      toast.error('Por favor sube ambos archivos');
      return;
    }

    setIsGenerating(true);
    setProgress(0);

    try {
      const progressInterval = setInterval(() => {
        setProgress((prev) => Math.min(prev + 5, 90));
      }, 1000);

      const formData = new FormData();
      formData.append('sourceVideo', sourceVideo);
      formData.append('characterImage', characterImage);
      formData.append('resolution', resolution);
      formData.append('format', format);

      const response = await fetch('/api/face-swap/generate', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);

      if (!response.ok) throw new Error('Failed to generate face swap');

      const data = await response.json();
      setProgress(100);
      setResultVideo(data.videoUrl);
      toast.success('Face swap completado');
    } catch (error) {
      toast.error('Error al generar face swap');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
      {/* Left side - Configuration */}
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-white">FACE SWAP</h1>

        {/* Source Video */}
        <div>
          <Label>Source Video</Label>
          <FileUpload
            onFilesSelected={(files) => setSourceVideo(files[0])}
            accept={{ 'video/*': ['.mp4', '.mov', '.avi'] }}
          />
        </div>

        {/* Character Image */}
        <div>
          <Label>Character Image</Label>
          <FileUpload
            onFilesSelected={(files) => setCharacterImage(files[0])}
            accept={{ 'image/*': ['.jpg', '.jpeg', '.png'] }}
            preview
          />
        </div>

        {/* Resolution */}
        <div>
          <Label>Resolución</Label>
          <Dropdown
            options={resolutionOptions}
            value={resolution}
            onChange={setResolution}
          />
        </div>

        {/* Format */}
        <div>
          <Label>Formato</Label>
          <Dropdown
            options={formatOptions}
            value={format}
            onChange={setFormat}
          />
        </div>

        {/* Consent Checkbox */}
        <div className="flex items-start gap-2">
          <input
            type="checkbox"
            id="consent"
            className="mt-1"
            defaultChecked
          />
          <label htmlFor="consent" className="text-sm text-gray-400">
            Confirmo que tengo los derechos y/o consentimiento para usar la imagen fuente si presenta una persona real.
          </label>
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
              Procesando Face Swap...
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
            <p className="text-4xl font-bold text-yellow-400">
              FACE SWAP SCREEN
            </p>
            <p className="mt-4 text-gray-400">
              Sube tus archivos y configura las opciones
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

