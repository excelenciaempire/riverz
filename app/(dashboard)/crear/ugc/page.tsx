'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useUser } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dropdown } from '@/components/ui/dropdown';
import { FileUpload } from '@/components/ui/file-upload';
import { Modal } from '@/components/ui/modal';
import { Loading, ProgressBar } from '@/components/ui/loading';
import { toast } from 'sonner';
import { Download, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { Product } from '@/types';

type TabType = 'library' | 'upload' | 'generate';

export default function UGCPage() {
  const { user } = useUser();
  const [activeTab, setActiveTab] = useState<TabType>('library');
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const [uploadedAvatar, setUploadedAvatar] = useState<File | null>(null);
  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [script, setScript] = useState('');
  const [selectedVoice, setSelectedVoice] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [resultVideo, setResultVideo] = useState<string | null>(null);
  const [showScriptModal, setShowScriptModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [salesAngle, setSalesAngle] = useState('');

  const supabase = createClient();

  // Fetch avatars from library
  const { data: avatars, isLoading: loadingAvatars } = useQuery({
    queryKey: ['avatars'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('avatars')
        .select('*')
        .eq('is_active', true);

      if (error) throw error;
      return data;
    },
  });

  // Fetch voices
  const { data: voices } = useQuery({
    queryKey: ['voices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('voices')
        .select('*')
        .eq('is_active', true);

      if (error) throw error;
      return data;
    },
  });

  // Fetch user products
  const { data: products } = useQuery({
    queryKey: ['products', user?.id],
    queryFn: async () => {
      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('clerk_id', user!.id)
        .single();

      if (!userData) return [];

      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('user_id', userData.id);

      if (error) throw error;
      return data as Product[];
    },
    enabled: !!user,
  });

  // Generate script with AI
  const generateScript = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/ugc/generate-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: selectedProduct,
          salesAngle,
        }),
      });

      if (!response.ok) throw new Error('Failed to generate script');
      const data = await response.json();
      return data.script;
    },
    onSuccess: (generatedScript) => {
      setScript(generatedScript);
      setShowScriptModal(false);
      toast.success('Guión generado');
    },
    onError: () => {
      toast.error('Error al generar guión');
    },
  });

  // Generate UGC video
  const generateUGC = async () => {
    if (!script || !selectedVoice) {
      toast.error('Por favor completa todos los campos');
      return;
    }

    let avatarData = null;

    if (activeTab === 'library' && selectedAvatar) {
      avatarData = { type: 'library', avatarId: selectedAvatar };
    } else if (activeTab === 'upload' && uploadedAvatar) {
      avatarData = { type: 'upload', file: uploadedAvatar };
    } else if (activeTab === 'generate' && generatedPrompt) {
      avatarData = { type: 'generate', prompt: generatedPrompt };
    } else {
      toast.error('Por favor selecciona o crea un avatar');
      return;
    }

    setIsGenerating(true);
    setProgress(0);

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress((prev) => Math.min(prev + 5, 90));
      }, 1000);

      const response = await fetch('/api/ugc/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          avatar: avatarData,
          script,
          voiceId: selectedVoice,
        }),
      });

      clearInterval(progressInterval);

      if (!response.ok) throw new Error('Failed to generate UGC');

      const data = await response.json();
      setProgress(100);
      setResultVideo(data.videoUrl);
      toast.success('Video generado');
    } catch (error) {
      toast.error('Error al generar video');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
      {/* Left side - Configuration */}
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-white">UGC CREATOR</h1>

        {/* Avatar Selection Tabs */}
        <div className="flex gap-4 border-b border-gray-700">
          <button
            onClick={() => setActiveTab('library')}
            className={`pb-2 ${
              activeTab === 'library'
                ? 'border-b-2 border-brand-accent text-white'
                : 'text-gray-400'
            }`}
          >
            Biblioteca
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className={`pb-2 ${
              activeTab === 'upload'
                ? 'border-b-2 border-brand-accent text-white'
                : 'text-gray-400'
            }`}
          >
            Subir Imagen
          </button>
          <button
            onClick={() => setActiveTab('generate')}
            className={`pb-2 ${
              activeTab === 'generate'
                ? 'border-b-2 border-brand-accent text-white'
                : 'text-gray-400'
            }`}
          >
            Generar
          </button>
        </div>

        {/* Tab Content */}
        <div className="rounded-lg border border-gray-700 bg-brand-dark-secondary p-6">
          {activeTab === 'library' && (
            <div>
              {loadingAvatars ? (
                <Loading text="Cargando avatares..." />
              ) : (
                <div className="grid grid-cols-3 gap-4">
                  {avatars?.slice(0, 5).map((avatar) => (
                    <div
                      key={avatar.id}
                      onClick={() => setSelectedAvatar(avatar.id)}
                      className={`cursor-pointer rounded-lg border-2 p-2 transition ${
                        selectedAvatar === avatar.id
                          ? 'border-brand-accent'
                          : 'border-transparent hover:border-gray-600'
                      }`}
                    >
                      <img
                        src={avatar.image_url}
                        alt={avatar.name}
                        className="aspect-square rounded object-cover"
                      />
                      <p className="mt-1 text-center text-xs text-white">
                        {avatar.name}
                      </p>
                    </div>
                  ))}
                  {avatars && avatars.length > 5 && (
                    <button className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-600 p-4 text-sm text-gray-400 hover:border-gray-500">
                      Ver {avatars.length - 5} más
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'upload' && (
            <FileUpload
              onFilesSelected={(files) => setUploadedAvatar(files[0])}
              accept={{ 'image/*': ['.jpg', '.jpeg', '.png'] }}
              preview
            />
          )}

          {activeTab === 'generate' && (
            <div>
              <Label>Prompt para generar avatar</Label>
              <Textarea
                value={generatedPrompt}
                onChange={(e) => setGeneratedPrompt(e.target.value)}
                placeholder="Describe el avatar que quieres generar..."
                rows={4}
              />
            </div>
          )}
        </div>

        {/* Edit Image or Add Product Button */}
        <Button
          variant="outline"
          onClick={() => setShowScriptModal(true)}
          className="w-full"
        >
          ✨ Editar Imagen o Agregar Producto
        </Button>

        {/* Script */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <Label>Guión</Label>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowScriptModal(true)}
            >
              Generar con IA
            </Button>
          </div>
          <Textarea
            value={script}
            onChange={(e) => setScript(e.target.value)}
            placeholder="Escribe o genera el guión que dirá el avatar..."
            rows={6}
          />
        </div>

        {/* Voice Selection */}
        <div>
          <Label>Voz</Label>
          <Dropdown
            options={
              voices?.map((v) => ({ value: v.id, label: v.name })) || []
            }
            value={selectedVoice}
            onChange={setSelectedVoice}
            placeholder="Selecciona una voz"
          />
        </div>

        {/* Generate Button */}
        <Button
          onClick={generateUGC}
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
              Generando video UGC...
            </h3>
            <ProgressBar progress={progress} />
          </div>
        ) : resultVideo ? (
          <div className="w-full">
            <video
              src={resultVideo}
              controls
              className="w-full rounded-lg"
            />
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
            <p className="text-4xl font-bold text-yellow-400">UGC</p>
            <p className="mt-4 text-gray-400">
              Configura tu video y haz clic en Generar
            </p>
          </div>
        )}
      </div>

      {/* Script Generation Modal */}
      <Modal
        isOpen={showScriptModal}
        onClose={() => setShowScriptModal(false)}
        title="Generar Guión con IA"
      >
        <div className="space-y-4">
          <div>
            <Label>Selecciona el producto</Label>
            <Dropdown
              options={
                products?.map((p) => ({ value: p.id, label: p.name })) || []
              }
              value={selectedProduct}
              onChange={setSelectedProduct}
              placeholder="Selecciona un producto"
            />
          </div>

          <div>
            <Label>Ángulo de ventas</Label>
            <Input
              value={salesAngle}
              onChange={(e) => setSalesAngle(e.target.value)}
              placeholder="Ej: Beneficios para la salud, estilo de vida..."
            />
          </div>

          <Button
            onClick={() => generateScript.mutate()}
            className="w-full"
            disabled={generateScript.isPending || !selectedProduct}
          >
            {generateScript.isPending ? 'Generando...' : 'Generar Guión'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

