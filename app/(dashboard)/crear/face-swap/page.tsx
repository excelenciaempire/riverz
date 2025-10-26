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
import { startPolling, handleCreditsError } from '@/lib/polling-helper';

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
  const [consent, setConsent] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [resultVideo, setResultVideo] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!sourceVideo || !characterImage) {
      toast.error('Por favor sube ambos archivos');
      return;
    }

    if (!consent) {
      toast.error('Debes confirmar que tienes los derechos de uso de las imágenes');
      return;
    }

    setIsGenerating(true);
    setProgress(0);

    try {
      const formData = new FormData();
      formData.append('sourceVideo', sourceVideo);
      formData.append('characterImage', characterImage);
      formData.append('resolution', resolution);
      formData.append('format', format);

      const response = await fetch('/api/face-swap/generate', {
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
        
        throw new Error(errorData.error || 'Failed to generate face swap');
      }

      const data = await response.json();
      const { jobId } = data;

      // Iniciar polling
      startPolling({
        jobId,
        statusEndpoint: '/api/face-swap/status',
        onProgress: (progress) => setProgress(progress),
        onComplete: (resultUrl) => {
          setResultVideo(resultUrl);
          toast.success('Face swap completado exitosamente');
          setIsGenerating(false);
        },
        onError: (error) => {
          toast.error(error);
          setIsGenerating(false);
        },
      });

    } catch (error: any) {
      console.error('Generation error:', error);
      toast.error(error.message || 'Error al generar face swap');
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
            <Label className="mb-1.5 block text-center text-sm">Video de Origen</Label>
            <div className="aspect-square overflow-hidden rounded-2xl border-2 border-gray-800 bg-[#0a0a0a] p-3">
              {sourceVideo ? (
                <video
                  src={URL.createObjectURL(sourceVideo)}
                  className="h-full w-full rounded-lg object-cover"
                />
              ) : (
                <>
                  <input
                    type="file"
                    accept="video/*"
                    onChange={(e) => e.target.files && setSourceVideo(e.target.files[0])}
                    className="hidden"
                    id="source-video"
                  />
                  <label htmlFor="source-video" className="flex h-full cursor-pointer flex-col items-center justify-center transition hover:bg-[#1a1a1a]">
                    <svg className="mb-2 h-8 w-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <span className="text-center text-xs text-gray-400">Haz clic aquí</span>
                    <p className="mt-1 text-[10px] text-gray-600">Máx: 100MB</p>
                  </label>
                </>
              )}
            </div>
          </div>

          {/* Character Image */}
          <div>
            <Label className="mb-1.5 block text-center text-sm">Imagen del Personaje</Label>
            <div className="aspect-square overflow-hidden rounded-2xl border-2 border-gray-800 bg-[#0a0a0a] p-3">
              {characterImage ? (
                <img
                  src={URL.createObjectURL(characterImage)}
                  alt="Character"
                  className="h-full w-full rounded-lg object-cover"
                />
              ) : (
                <>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => e.target.files && setCharacterImage(e.target.files[0])}
                    className="hidden"
                    id="character-image"
                  />
                  <label htmlFor="character-image" className="flex h-full cursor-pointer flex-col items-center justify-center transition hover:bg-[#1a1a1a]">
                    <svg className="mb-2 h-8 w-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <span className="text-center text-xs text-gray-400">Haz clic aquí</span>
                    <p className="mt-1 text-[10px] text-gray-600">Máx: 10MB</p>
                  </label>
                </>
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
        <div className="flex items-start gap-3 rounded-lg border border-gray-800 bg-[#0a0a0a] p-4">
          <input
            type="checkbox"
            id="consent"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5 h-4 w-4 cursor-pointer rounded border-gray-600 bg-transparent text-brand-accent focus:ring-1 focus:ring-brand-accent"
          />
          <label htmlFor="consent" className="cursor-pointer text-sm text-gray-300 leading-relaxed">
            Confirmo que tengo los derechos y/o consentimiento para usar las imágenes/videos si contienen personas reales.
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
