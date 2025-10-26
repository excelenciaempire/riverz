'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dropdown } from '@/components/ui/dropdown';
import { FileUpload } from '@/components/ui/file-upload';
import { Modal } from '@/components/ui/modal';
import { Loading, ProgressBar } from '@/components/ui/loading';
import { toast } from 'sonner';
import { Download, Loader2, Sparkles, ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { Product } from '@/types';

type TabType = 'library' | 'upload' | 'generate';

export default function UGCPage() {
  const { user } = useUser();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('library');
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const [uploadedAvatar, setUploadedAvatar] = useState<File | null>(null);
  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [previewAvatar, setPreviewAvatar] = useState<string | null>(null);
  const [editedAvatar, setEditedAvatar] = useState<string | null>(null);
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
  const [generatedAvatarImage, setGeneratedAvatarImage] = useState<string | null>(null);
  const [isGeneratingAvatar, setIsGeneratingAvatar] = useState(false);

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
    <div className="mx-auto max-w-[1600px]">
      {/* Back Button */}
      <button
        onClick={() => router.push('/crear')}
        className="mb-4 flex items-center gap-2 text-gray-400 transition hover:text-white"
      >
        <ArrowLeft className="h-5 w-5" />
        <span className="text-sm">Volver</span>
      </button>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_1fr]">
        {/* Left side - Configuration */}
        <div className="space-y-3">
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
        <div className="rounded-2xl border border-gray-800 bg-[#0a0a0a] p-4">
          {activeTab === 'library' && (
            <div>
              {loadingAvatars ? (
                <Loading text="Cargando avatares..." />
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {avatars?.slice(0, 5).map((avatar) => (
                    <button
                      key={avatar.id}
                      onClick={() => {
                        setSelectedAvatar(avatar.id);
                        setPreviewAvatar(avatar.image_url);
                        setEditedAvatar(null);
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
                  {avatars && avatars.length > 5 && (
                    <button
                      onClick={() => setShowAvatarsModal(true)}
                      className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-600 p-4 text-sm text-gray-400 transition hover:border-brand-accent hover:text-brand-accent"
                    >
                      <svg className="mb-2 h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      <span className="text-xs font-medium">Ver más</span>
                      <span className="text-xs font-semibold">{avatars.length} avatares</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'upload' && (
            <FileUpload
              onFilesSelected={(files) => {
                setUploadedAvatar(files[0]);
                setPreviewAvatar(URL.createObjectURL(files[0]));
                setSelectedAvatar(null);
                setEditedAvatar(null);
              }}
              accept={{ 'image/*': ['.jpg', '.jpeg', '.png'] }}
              preview
            />
          )}

          {activeTab === 'generate' && (
            <div className="space-y-4">
              <Textarea
                value={generatedPrompt}
                onChange={(e) => setGeneratedPrompt(e.target.value)}
                placeholder="Describe el avatar que quieres generar..."
                rows={4}
              />
              
              {/* Generate Avatar Button */}
              {!generatedAvatarImage && (
                <Button
                  onClick={async () => {
                    if (!generatedPrompt.trim()) {
                      toast.error('Por favor escribe una descripción');
                      return;
                    }
                    setIsGeneratingAvatar(true);
                    try {
                      // TODO: Call N8N API to generate avatar
                      await new Promise(resolve => setTimeout(resolve, 3000));
                      const mockImage = 'https://via.placeholder.com/400x600/1a1a1a/07A498?text=Avatar+Generado';
                      setGeneratedAvatarImage(mockImage);
                      setPreviewAvatar(mockImage);
                      toast.success('Avatar generado exitosamente');
                    } catch (error) {
                      toast.error('Error al generar avatar');
                    } finally {
                      setIsGeneratingAvatar(false);
                    }
                  }}
                  disabled={isGeneratingAvatar}
                  className="w-full rounded-2xl py-6"
                >
                  {isGeneratingAvatar ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Generando Avatar...
                    </>
                  ) : (
                    'Generar Avatar'
                  )}
                </Button>
              )}

              {/* Generated Avatar Preview */}
              {generatedAvatarImage && (
                <div className="space-y-3">
                  <div className="overflow-hidden rounded-lg border border-gray-700">
                    <img
                      src={generatedAvatarImage}
                      alt="Avatar generado"
                      className="w-full object-cover"
                    />
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <Button
                      onClick={() => setShowEditImageModal(true)}
                      variant="outline"
                      className="flex-1 rounded-lg"
                    >
                      <Sparkles className="mr-2 h-4 w-4" />
                      Editar Imagen
                    </Button>
                    <Button
                      onClick={() => {
                        setGeneratedAvatarImage(null);
                        setGeneratedPrompt('');
                        setPreviewAvatar(null);
                      }}
                      variant="ghost"
                      className="flex-1 rounded-lg"
                    >
                      Generar Otra
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Edit Image or Add Product Button - Only for library and upload tabs */}
        {activeTab !== 'generate' && (
          <Button
            variant="ghost"
            onClick={() => setShowEditImageModal(true)}
            disabled={!previewAvatar}
            className="w-full justify-start gap-2 rounded-2xl border border-gray-800 bg-[#0a0a0a] px-6 py-3 text-gray-400 transition hover:border-gray-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" />
            Editar Imagen o Agregar Producto
          </Button>
        )}

        {/* Script */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <Label className="text-sm">Guión</Label>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowScriptModal(true)}
              className="h-7 text-xs"
            >
              Generar con IA
            </Button>
          </div>
          <Textarea
            value={script}
            onChange={(e) => setScript(e.target.value)}
            placeholder="Escribe o genera el guión que dirá el avatar..."
            rows={4}
            className="text-sm"
          />
        </div>

        {/* Voice Selection */}
        <div>
          <Label className="mb-1.5 block text-sm">Voz</Label>
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
          className="w-full rounded-2xl bg-brand-accent py-4 text-white hover:bg-brand-accent/90"
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
        <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-800 bg-[#141414] p-6 min-h-[600px]">
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
        ) : previewAvatar || editedAvatar ? (
          <div className="w-full max-w-md">
            <div className="aspect-[9/16] overflow-hidden rounded-lg border border-gray-700">
              <img
                src={editedAvatar || previewAvatar || ''}
                alt="Avatar preview"
                className="h-full w-full object-cover"
              />
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center text-gray-500">
            <p>El video UGC generado aparecerá aquí</p>
          </div>
        )}
        </div>
      </div>

      {/* All Avatars Modal */}
      <Modal
        isOpen={showAvatarsModal}
        onClose={() => setShowAvatarsModal(false)}
        title="Biblioteca de Avatares"
      >
        <div className="grid grid-cols-4 gap-4 max-h-[600px] overflow-y-auto p-2">
          {loadingAvatars ? (
            <div className="col-span-4">
              <Loading text="Cargando avatares..." />
            </div>
          ) : avatars && avatars.length > 0 ? (
            avatars.map((avatar) => (
              <button
                key={avatar.id}
                onClick={() => {
                  setSelectedAvatar(avatar.id);
                  setPreviewAvatar(avatar.image_url);
                  setEditedAvatar(null);
                  setShowAvatarsModal(false);
                  toast.success(`Avatar "${avatar.name}" seleccionado`);
                }}
                className={`group relative overflow-hidden rounded-xl border-2 transition ${
                  selectedAvatar === avatar.id
                    ? 'border-brand-accent'
                    : 'border-gray-700 hover:border-brand-accent/50'
                }`}
              >
                <img
                  src={avatar.image_url}
                  alt={avatar.name}
                  className="aspect-square object-cover"
                />
                {/* Overlay with name */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 transition group-hover:opacity-100">
                  <div className="absolute bottom-2 left-2 right-2 text-center">
                    <p className="text-sm font-medium text-white">{avatar.name}</p>
                  </div>
                </div>
                {/* Selected indicator */}
                {selectedAvatar === avatar.id && (
                  <div className="absolute right-2 top-2 rounded-full bg-brand-accent p-1">
                    <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </button>
            ))
          ) : (
            <div className="col-span-4 py-8 text-center text-gray-500">
              No hay avatares disponibles
            </div>
          )}
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
              Edición Mágica
            </button>
            <button
              onClick={() => setEditMode('skin')}
              className={`pb-3 text-base font-medium ${
                editMode === 'skin'
                  ? 'border-b-2 border-brand-accent text-white'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              Mejorar Piel
            </button>
          </div>

          {editMode === 'magic' && (
            <div className="grid grid-cols-2 gap-6">
              {/* Left side - Upload */}
              <div className="space-y-4">
                <div>
                  <Label className="mb-2 block text-sm">
                    Producto <span className="text-gray-500">(opcional)</span>
                  </Label>
                  <p className="mb-3 text-xs text-gray-400">
                    Sube un producto, objeto o persona para mezclar con tu imagen
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
                          Arrastra y suelta fotos
                        </p>
                        <p className="text-sm font-medium text-gray-300">
                          para mezclar
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
                    Edición Mágica
                  </Label>
                  <p className="mb-3 text-xs text-gray-400">
                    Instrucciones para la IA sobre cómo modificar la imagen
                  </p>
                  <Textarea
                    value={magicEditPrompt}
                    onChange={(e) => setMagicEditPrompt(e.target.value)}
                    placeholder="Hazle el cabello azul, cambia el fondo a una playa, agrega lentes de sol..."
                    rows={4}
                    className="text-sm"
                  />
                </div>

                <div>
                  <Label className="mb-2 block text-sm">Variaciones</Label>
                  <p className="mb-3 text-xs text-gray-400">
                    Genera múltiples variaciones a la vez (máximo 4)
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
                    <span className="text-sm text-gray-400">{variations === 1 ? 'Imagen única' : `${variations} imágenes`}</span>
                  </div>
                </div>

                <Button className="w-full bg-brand-accent hover:bg-brand-accent/90">
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generar
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
              Mejorar Piel - Próximamente
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setShowEditImageModal(false)}
            >
              Cancelar
            </Button>
            <Button
              className="bg-brand-accent hover:bg-brand-accent/90"
              onClick={() => {
                // TODO: Apply AI edits here
                setEditedAvatar(previewAvatar);
                setShowEditImageModal(false);
                toast.success('Edición aplicada');
              }}
            >
              Confirmar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
