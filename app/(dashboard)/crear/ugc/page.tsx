'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useUser } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dropdown } from '@/components/ui/dropdown';
import { FileUpload } from '@/components/ui/file-upload';
import { Modal } from '@/components/ui/modal';
import { Loading, ProgressBar } from '@/components/ui/loading';
import { toast } from 'sonner';
import { Download, Loader2, Sparkles } from 'lucide-react';
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
  const [showAvatarsModal, setShowAvatarsModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [salesAngle, setSalesAngle] = useState('');
  const [showEditImageModal, setShowEditImageModal] = useState(false);
  const [editMode, setEditMode] = useState<'magic' | 'skin'>('magic');
  const [productImage, setProductImage] = useState<File | null>(null);
  const [magicEditPrompt, setMagicEditPrompt] = useState('');
  const [variations, setVariations] = useState(1);

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
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[420px_1fr]">
      {/* Left side - Configuration */}
      <div className="space-y-4">
        {/* Avatar Selection Tabs */}
        <div className="flex gap-6 border-b border-gray-800">
          <button
            onClick={() => setActiveTab('library')}
            className={`pb-2 text-sm ${
              activeTab === 'library'
                ? 'border-b-2 border-brand-accent font-medium text-white'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            Biblioteca
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className={`pb-2 text-sm ${
              activeTab === 'upload'
                ? 'border-b-2 border-brand-accent font-medium text-white'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            Subir Imagen
          </button>
          <button
            onClick={() => setActiveTab('generate')}
            className={`pb-2 text-sm ${
              activeTab === 'generate'
                ? 'border-b-2 border-brand-accent font-medium text-white'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            Generar
          </button>
        </div>

        {/* Tab Content */}
        <div className="rounded-lg bg-[#141414] border border-gray-800 p-4">
          {activeTab === 'library' && (
            <div>
              {loadingAvatars ? (
                <Loading text="Cargando avatares..." />
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {avatars?.slice(0, 5).map((avatar) => (
                    <button
                      key={avatar.id}
                      onClick={() => setSelectedAvatar(avatar.id)}
                      className={`overflow-hidden rounded-lg border-2 transition ${
                        selectedAvatar === avatar.id
                          ? 'border-brand-accent'
                          : 'border-transparent hover:border-gray-600'
                      }`}
                    >
                      <img
                        src={avatar.image_url}
                        alt={avatar.name}
                        className="aspect-square object-cover"
                      />
                    </button>
                  ))}
                  {avatars && avatars.length > 5 && (
                    <button
                      onClick={() => setShowAvatarsModal(true)}
                      className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-600 p-4 text-sm text-gray-400 hover:border-gray-500"
                    >
                      <span className="text-xs">Show</span>
                      <span className="font-semibold">{avatars.length - 5} actors</span>
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
          variant="ghost"
          onClick={() => setShowEditImageModal(true)}
          className="w-full justify-start gap-2 border border-gray-700 text-gray-400 hover:text-white"
        >
          <Sparkles className="h-4 w-4" />
          Editar Imagen o Agregar Producto
        </Button>

        {/* Script */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <Label className="text-base">Guión</Label>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowScriptModal(true)}
              className="text-xs"
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
          <Label className="mb-2 block text-base">Voz</Label>
          <Dropdown
            options={
              voices?.map((v) => ({ value: v.id, label: v.name })) || []
            }
            value={selectedVoice}
            onChange={setSelectedVoice}
            placeholder="Seleccionar"
          />
        </div>

        {/* Generate Button */}
        <Button
          onClick={generateUGC}
          className="w-full bg-brand-accent text-white hover:bg-brand-accent/90"
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
      <div className="flex flex-col items-center justify-center rounded-lg border border-gray-800 bg-[#141414] p-6 min-h-[700px]">
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
            <h2 className="text-8xl font-bold text-white">UGC</h2>
          </div>
        )}
      </div>

      {/* All Avatars Modal */}
      <Modal
        isOpen={showAvatarsModal}
        onClose={() => setShowAvatarsModal(false)}
        title="Todos los Avatares"
      >
        <div className="grid grid-cols-4 gap-4 max-h-96 overflow-y-auto">
          {avatars?.map((avatar) => (
            <button
              key={avatar.id}
              onClick={() => {
                setSelectedAvatar(avatar.id);
                setShowAvatarsModal(false);
              }}
              className={`overflow-hidden rounded-lg border-2 transition ${
                selectedAvatar === avatar.id
                  ? 'border-brand-accent'
                  : 'border-transparent hover:border-gray-600'
              }`}
            >
              <img
                src={avatar.image_url}
                alt={avatar.name}
                className="aspect-square object-cover"
              />
            </button>
          ))}
        </div>
      </Modal>

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
            <Textarea
              value={salesAngle}
              onChange={(e) => setSalesAngle(e.target.value)}
              placeholder="Ej: Beneficios para la salud, estilo de vida..."
              rows={3}
            />
          </div>

          <Button
            onClick={() => generateScript.mutate()}
            className="w-full bg-brand-accent hover:bg-brand-accent/90"
            disabled={generateScript.isPending || !selectedProduct}
          >
            {generateScript.isPending ? 'Generando...' : 'Generar Guión'}
          </Button>
        </div>
      </Modal>

      {/* Edit Image or Add Product Modal */}
      <Modal
        isOpen={showEditImageModal}
        onClose={() => setShowEditImageModal(false)}
        title=""
      >
        <div className="space-y-6">
          {/* Tabs */}
          <div className="flex gap-4 border-b border-gray-700">
            <button
              onClick={() => setEditMode('magic')}
              className={`pb-3 text-base font-medium ${
                editMode === 'magic'
                  ? 'border-b-2 border-brand-accent text-white'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              Magic Edit
            </button>
            <button
              onClick={() => setEditMode('skin')}
              className={`pb-3 text-base font-medium ${
                editMode === 'skin'
                  ? 'border-b-2 border-brand-accent text-white'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              Skin Enhancer
            </button>
          </div>

          {editMode === 'magic' && (
            <div className="grid grid-cols-2 gap-6">
              {/* Left side - Upload */}
              <div className="space-y-4">
                <div>
                  <Label className="mb-2 block text-sm">
                    Product <span className="text-gray-500">(optional)</span>
                  </Label>
                  <p className="mb-3 text-xs text-gray-400">
                    Upload a product, object, or person to mix your image with
                  </p>
                  <div className="rounded-lg border-2 border-dashed border-gray-600 bg-[#1a1a1a] p-8 text-center">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        if (e.target.files?.[0]) {
                          setProductImage(e.target.files[0]);
                        }
                      }}
                      className="hidden"
                      id="product-upload"
                    />
                    <label
                      htmlFor="product-upload"
                      className="flex cursor-pointer flex-col items-center gap-3"
                    >
                      <svg
                        className="h-10 w-10 text-gray-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                        />
                      </svg>
                      <div>
                        <p className="text-sm font-medium text-gray-300">
                          Drag and drop photos
                        </p>
                        <p className="text-sm font-medium text-gray-300">
                          to mashup
                        </p>
                      </div>
                    </label>
                    {productImage && (
                      <div className="mt-4">
                        <img
                          src={URL.createObjectURL(productImage)}
                          alt="Product preview"
                          className="mx-auto h-32 w-32 rounded-lg object-cover"
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <Label className="mb-2 flex items-center gap-2 text-sm">
                    <Sparkles className="h-4 w-4" />
                    Magic Edit
                  </Label>
                  <p className="mb-3 text-xs text-gray-400">
                    Give our AI instructions to modify the image
                  </p>
                  <Textarea
                    value={magicEditPrompt}
                    onChange={(e) => setMagicEditPrompt(e.target.value)}
                    placeholder="Make her hair blue, change the background to a beach, add sunglasses..."
                    rows={4}
                    className="text-sm"
                  />
                </div>

                <div>
                  <Label className="mb-2 block text-sm">Variations</Label>
                  <p className="mb-3 text-xs text-gray-400">
                    Generate multiple variations at once (max 4)
                  </p>
                  <div className="flex items-center gap-4">
                    <input
                      type="number"
                      min="1"
                      max="4"
                      value={variations}
                      onChange={(e) => setVariations(parseInt(e.target.value) || 1)}
                      className="w-20 rounded-lg border border-gray-700 bg-[#1a1a1a] px-3 py-2 text-sm text-white"
                    />
                    <span className="text-sm text-gray-400">Single image</span>
                  </div>
                </div>

                <Button className="w-full bg-brand-accent hover:bg-brand-accent/90">
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate
                </Button>
              </div>

              {/* Right side - Preview */}
              <div className="flex items-center justify-center rounded-lg border border-gray-700 bg-[#141414] p-6">
                {selectedAvatar ? (
                  <img
                    src={
                      activeTab === 'library'
                        ? avatars?.find((a) => a.id === selectedAvatar)
                            ?.image_url || ''
                        : uploadedAvatar
                        ? URL.createObjectURL(uploadedAvatar)
                        : ''
                    }
                    alt="Preview"
                    className="max-h-96 rounded-lg object-contain"
                  />
                ) : (
                  <div className="text-center text-gray-500">
                    Selecciona un avatar primero
                  </div>
                )}
              </div>
            </div>
          )}

          {editMode === 'skin' && (
            <div className="text-center text-gray-500 py-8">
              Skin Enhancer - Próximamente
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setShowEditImageModal(false)}
            >
              Cancel
            </Button>
            <Button
              className="bg-brand-accent hover:bg-brand-accent/90"
              onClick={() => {
                // Apply edits and close
                setShowEditImageModal(false);
                toast.success('Edición aplicada');
              }}
            >
              Confirm
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
