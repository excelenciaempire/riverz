'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { ArrowLeft, Sparkles, Plus, Upload, X, FileText, Loader2 } from 'lucide-react';
import { ResearchProgress } from '@/components/products/research-progress';
import type { Product } from '@/types';

// Extended product type with research fields
interface ProductWithResearch extends Product {
  research_data?: any;
  research_status?: 'pending' | 'processing' | 'completed' | 'failed' | null;
}

// Helper to count research items from various formats
function countResearchItems(data: any) {
  if (!data) return { emociones: 0, miedos: 0, keywords: 0 };
  
  // Count emotions
  let emociones = 0;
  if (data.top_5_emociones?.length) emociones = data.top_5_emociones.length;
  else if (data.problema_central?.emociones?.length) emociones = data.problema_central.emociones.length;
  
  // Count fears
  let miedos = 0;
  if (data.miedos_oscuros) {
    const m = data.miedos_oscuros;
    if (m.miedos?.length) miedos = m.miedos.length;
    else miedos = [m.miedo_1, m.miedo_2, m.miedo_3, m.miedo_4, m.miedo_5].filter(x => x?.miedo).length;
  }
  
  // Count keywords
  let keywords = 0;
  if (data.lenguaje_del_mercado?.frases_que_usan?.length) keywords = data.lenguaje_del_mercado.frases_que_usan.length;
  else if (data.lenguaje?.palabras_clave?.length) keywords = data.lenguaje.palabras_clave.length;
  
  return { emociones, miedos, keywords };
}

export default function ProductClient({ product }: { product: ProductWithResearch }) {
  const router = useRouter();
  const [localResearchData, setLocalResearchData] = useState(product.research_data);
  const [localResearchStatus, setLocalResearchStatus] = useState(product.research_status);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadText, setUploadText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Deep Research Mutation
  const deepResearch = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: product.id }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Error en el research');
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast.success('Deep Research completado');
      setLocalResearchData(data.researchData);
      setLocalResearchStatus('completed');
      router.refresh();
    },
    onError: (err: any) => {
      toast.error(err.message || 'Error al realizar el research');
      setLocalResearchStatus('failed');
    },
  });

  // Upload-research mutation: takes raw text and ships it through Gemini
  // for normalization into the same schema /api/research produces.
  const uploadResearch = useMutation({
    mutationFn: async (rawText: string) => {
      const response = await fetch('/api/products/upload-research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: product.id, rawText }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Error procesando el research');
      }
      return data;
    },
    onSuccess: (data) => {
      if (data.parseError) {
        toast.warning('Se subió, pero Gemini no logró estructurarlo. Revisa el research crudo.');
      } else {
        toast.success('Research subido y estructurado correctamente');
      }
      setLocalResearchData(data.researchData);
      setLocalResearchStatus(data.parseError ? 'failed' : 'completed');
      setUploadOpen(false);
      setUploadText('');
      router.refresh();
    },
    onError: (err: any) => {
      toast.error(err.message || 'Error al subir el research');
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Allow .txt, .md, .markdown — anything that's plain text. We don't parse
    // PDF/DOCX in MVP; users with those should copy-paste the content.
    const okExt = /\.(txt|md|markdown)$/i.test(file.name);
    const okMime = file.type === 'text/plain' || file.type === 'text/markdown' || file.type === '';
    if (!okExt && !okMime) {
      toast.error('Sube un archivo .txt o .md (para PDF/DOCX por ahora copia y pega el contenido)');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Archivo demasiado grande (>2 MB). Reduce el contenido.');
      return;
    }

    try {
      const text = await file.text();
      setUploadText(text);
      toast.success(`${file.name} cargado (${(file.size / 1024).toFixed(1)} KB)`);
    } catch (err: any) {
      toast.error(`No se pudo leer el archivo: ${err.message}`);
    }
  };

  const handleSubmitUpload = () => {
    const trimmed = uploadText.trim();
    if (trimmed.length < 50) {
      toast.error('El research está muy corto — pega al menos un párrafo con contenido real');
      return;
    }
    uploadResearch.mutate(trimmed);
  };

  const handleStartResearch = () => {
    setLocalResearchStatus('processing');
    deepResearch.mutate();
  };

  const handleViewResearch = () => {
    router.push(`/marcas/${product.id}/research`);
  };

  if (!product) return <div className="p-8 text-center text-red-500">Producto no encontrado</div>;

  const hasResearch = !!(localResearchData || product.research_data);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <Button variant="ghost" onClick={() => router.push('/marcas')} className="text-gray-400 hover:text-white">
          <ArrowLeft className="mr-2 h-4 w-4" /> Volver
        </Button>
        
        <Button onClick={() => router.push('/marcas')} variant="outline" className="border-brand-accent text-brand-accent hover:bg-brand-accent/10">
          <Plus className="mr-2 h-4 w-4" /> Agregar otro producto
        </Button>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Images */}
        <div className="space-y-4">
          <div className="aspect-square overflow-hidden rounded-2xl border border-gray-800 bg-[#141414]">
             {product.images && product.images[0] && (
               <img src={product.images[0]} alt={product.name} className="h-full w-full object-cover" />
             )}
          </div>
          {product.images && product.images.length > 1 && (
            <div className="grid grid-cols-4 gap-2">
              {product.images.slice(1).map((img, i) => (
                <div key={i} className="aspect-square overflow-hidden rounded-lg border border-gray-800 bg-[#141414]">
                  <img src={img} alt="" className="h-full w-full object-cover" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-white">{product.name}</h1>
            <p className="mt-2 text-2xl text-brand-accent">${product.price}</p>
          </div>

          <div className="rounded-xl border border-gray-800 bg-[#141414] p-6">
            <h3 className="mb-3 font-semibold text-white">Información</h3>
            <div className="space-y-3 text-gray-400">
              <p><span className="text-gray-500">Web:</span> {product.website || 'N/A'}</p>
              <p><span className="text-gray-500">Beneficios:</span> {product.benefits}</p>
            </div>
          </div>

          {/* Deep Research Section */}
          <div className="rounded-xl border border-brand-accent/20 bg-brand-accent/5 p-6">
            <h3 className="mb-4 flex items-center font-semibold text-white">
              <Sparkles className="mr-2 h-5 w-5 text-brand-accent" />
              Deep Research de Mercado
            </h3>

            <p className="mb-4 text-sm text-gray-400">
              {hasResearch
                ? 'El research profundo está listo. Úsalo para crear ads que conecten emocionalmente con tu audiencia.'
                : 'La IA analizará Reddit, reseñas y redes sociales para descubrir los verdaderos motivadores emocionales de compra de tu público objetivo.'
              }
            </p>

            <ResearchProgress
              productId={product.id}
              initialStatus={localResearchStatus || product.research_status || null}
              hasResearch={hasResearch}
              onStartResearch={handleStartResearch}
              onViewResearch={handleViewResearch}
              isStarting={deepResearch.isPending}
            />

            {/* Quick stats if research exists */}
            {hasResearch && (localResearchData || product.research_data) && (() => {
              const stats = countResearchItems(localResearchData || product.research_data);
              return (
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-black/30 p-2">
                    <p className="text-lg font-bold text-brand-accent">{stats.emociones}</p>
                    <p className="text-xs text-gray-500">Emociones</p>
                  </div>
                  <div className="rounded-lg bg-black/30 p-2">
                    <p className="text-lg font-bold text-brand-accent">{stats.miedos}</p>
                    <p className="text-xs text-gray-500">Miedos</p>
                  </div>
                  <div className="rounded-lg bg-black/30 p-2">
                    <p className="text-lg font-bold text-brand-accent">{stats.keywords}</p>
                    <p className="text-xs text-gray-500">Keywords</p>
                  </div>
                </div>
              );
            })()}

            {/* Divider + upload-your-own-research entry point. The user can
                bring an external research doc (Notion / Google Doc / Reddit
                dump / call transcript) and Gemini normalizes it into the same
                schema /api/research generates. */}
            <div className="mt-5 border-t border-brand-accent/20 pt-4">
              {!uploadOpen ? (
                <button
                  type="button"
                  onClick={() => setUploadOpen(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-gray-700 bg-black/20 px-4 py-3 text-sm text-gray-300 transition hover:border-brand-accent hover:text-white"
                >
                  <Upload className="h-4 w-4" />
                  Subir mi propio research
                </button>
              ) : (
                <div className="space-y-3 rounded-lg border border-gray-800 bg-black/40 p-4">
                  <div className="flex items-center justify-between">
                    <h4 className="flex items-center gap-2 text-sm font-semibold text-white">
                      <Upload className="h-4 w-4 text-brand-accent" />
                      Subir research propio
                    </h4>
                    <button
                      type="button"
                      onClick={() => {
                        setUploadOpen(false);
                        setUploadText('');
                      }}
                      className="text-gray-500 hover:text-white"
                      aria-label="Cerrar"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <p className="text-xs text-gray-400">
                    Pega el contenido de tu research (Notion, Google Doc, transcripción de llamadas,
                    posts de Reddit, etc.) o sube un archivo <code className="rounded bg-black px-1">.txt</code> /
                    <code className="rounded bg-black px-1">.md</code>. Gemini lo estructurará en el
                    mismo formato que el Deep Research automático.
                  </p>

                  <div className="flex items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".txt,.md,.markdown,text/plain,text/markdown"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      className="border-gray-700 text-gray-300 hover:bg-gray-800"
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      Cargar archivo .txt / .md
                    </Button>
                    <span className="text-[11px] text-gray-500">
                      o pega el texto abajo
                    </span>
                  </div>

                  <Textarea
                    value={uploadText}
                    onChange={(e) => setUploadText(e.target.value)}
                    placeholder="Pega aquí tu research completo. Cuanto más contexto, mejor: testimonios, dolores, miedos, lenguaje del cliente, soluciones que probaron antes, etc."
                    className="min-h-[180px] border-gray-700 bg-black/60 text-sm text-white"
                    disabled={uploadResearch.isPending}
                  />

                  <div className="flex items-center justify-between text-[11px] text-gray-500">
                    <span>{uploadText.length.toLocaleString()} caracteres</span>
                    {uploadText.length > 0 && uploadText.length < 50 && (
                      <span className="text-yellow-500">Mínimo 50 caracteres</span>
                    )}
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setUploadOpen(false);
                        setUploadText('');
                      }}
                      disabled={uploadResearch.isPending}
                      className="border-gray-700 text-gray-300 hover:bg-gray-800"
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleSubmitUpload}
                      disabled={uploadResearch.isPending || uploadText.trim().length < 50}
                      className="bg-brand-accent text-white hover:bg-brand-accent/80"
                    >
                      {uploadResearch.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Estructurando con Gemini...
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-2 h-4 w-4" />
                          Procesar research
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
