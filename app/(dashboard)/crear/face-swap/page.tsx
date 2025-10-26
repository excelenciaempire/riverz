'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dropdown } from '@/components/ui/dropdown';
import { FileUpload } from '@/components/ui/file-upload';
import { ProgressBar } from '@/components/ui/loading';
import { toast } from 'sonner';
import { Download, Loader2, ArrowLeft } from 'lucide-react';

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
  const router = useRouter();
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
    <div className="mx-auto max-w-[1600px]">
      {/* Back Button */}
      <button
        onClick={() => router.push('/crear')}
        className="mb-4 flex items-center gap-2 text-gray-400 transition hover:text-white"
      >
        <ArrowLeft className="h-5 w-5" />
        <span className="text-sm">Volver</span>
      </button>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[440px_1fr]">
        {/* Left side - Configuration */}
        <div className="space-y-4">
        {/* Uploads in grid */}
        <div className="grid grid-cols-2 gap-4">
          {/* Source Video */}
          <div>
            <Label className="mb-1.5 block text-sm">Source Video</Label>
            <div className="aspect-square overflow-hidden rounded-2xl border border-gray-800 bg-[#0a0a0a]">
              {sourceVideo ? (
                <video
                  src={URL.createObjectURL(sourceVideo)}
                  className="h-full w-full object-cover"
                />
              ) : (
                <FileUpload
                  onFilesSelected={(files) => setSourceVideo(files[0])}
                  accept={{ 'video/*': ['.mp4', '.mov', '.avi'] }}
                />
              )}
            </div>
          </div>

          {/* Character Image */}
          <div>
            <Label className="mb-1.5 block text-sm">Character Image</Label>
            <div className="aspect-square overflow-hidden rounded-2xl border border-gray-800 bg-[#0a0a0a]">
              {characterImage ? (
                <img
                  src={URL.createObjectURL(characterImage)}
                  alt="Character"
                  className="h-full w-full object-cover"
                />
              ) : (
                <FileUpload
                  onFilesSelected={(files) => setCharacterImage(files[0])}
                  accept={{ 'image/*': ['.jpg', '.jpeg', '.png'] }}
                  preview
                />
              )}
            </div>
          </div>
        </div>

        {/* Resolution and Format in grid */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="mb-2 block">Resolución</Label>
            <Dropdown
              options={resolutionOptions}
              value={resolution}
              onChange={setResolution}
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
        </div>

        {/* Checkbox */}
        <div className="flex items-start gap-2">
          <input
            type="checkbox"
            id="consent"
            className="mt-1 h-4 w-4 rounded border-gray-600 bg-brand-dark-primary text-brand-accent focus:ring-brand-accent"
          />
          <label htmlFor="consent" className="text-sm text-gray-400">
            I confirm that I have the rights and/or consent to use the source image if it features a real person.
          </label>
        </div>

        {/* Generate Button */}
        <Button
          onClick={handleGenerate}
          className="w-full rounded-2xl bg-brand-accent py-6 text-white hover:bg-brand-accent/90"
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
        <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-800 bg-[#141414] p-8 min-h-[750px]">
          {isGenerating ? (
            <div className="w-full space-y-4">
              <h3 className="text-center text-xl font-semibold text-white">
                Generando Face Swap...
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
            <div className="flex items-center justify-center text-gray-500">
              <p>El video con face swap aparecerá aquí</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
