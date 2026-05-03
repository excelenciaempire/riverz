'use client';

/**
 * Creative Studio — generador de imágenes con IA, especializado en
 * presets ecommerce (lifestyle + product shot). Reusa el endpoint
 * existente kie.ai nano-banana-pro vía /api/landing-lab/create-task.
 *
 * MVP V1: scenes wizard (Lifestyle + Product Shot) + composer.
 * V2: galería Inspiration + Folders.
 */

import { useState } from 'react';
import { Loader2, Send, Upload, Sparkles } from 'lucide-react';
import { SideNav } from '../_side-nav';
import { cn } from '@/lib/utils';

type SceneKind = 'lifestyle' | 'product' | null;

const MODEL_OPTIONS = ['Mujer 20s', 'Mujer 30s', 'Mujer 40s', 'Mujer 50s', 'Hombre 20s', 'Hombre 30s', 'Hombre 40s', 'Hombre 50s'];
const SKIN = ['Light', 'Light Medium', 'Medium', 'Medium Dark', 'Dark', 'Deep'];
const HAIR = ['Rubia', 'Castaño claro', 'Castaño', 'Castaño oscuro', 'Negro', 'Pelirrojo', 'Gris', 'Blanco'];
const SETTING = ['Studio', 'Sala', 'Cocina', 'Baño', 'Habitación', 'Calle urbana', 'Naturaleza', 'Playa', 'Café', 'Gym', 'Oficina'];
const POSE = ['Sostiene producto', 'Usa producto', 'Mira producto', 'Sentada', 'En acción'];
const LIGHTING = ['Soft Studio', 'Dramática', 'Natural', 'Hora dorada', 'Backlit', 'Rim Light'];
const ANGLE = ['Frontal', '45°', 'Cenital', 'Bajo', 'Lateral'];
const FRAMING = ['Cuerpo entero', 'Medio cuerpo', 'Close up', 'Por encima del hombro', 'Candid'];

const PRODUCT_SETTING = ['Mármol', 'Madera', 'Lino', 'Playa', 'Naturaleza', 'Editorial seamless'];
const PRODUCT_LIGHTING = ['Soft Studio', 'Dramática', 'Hora dorada', 'Hard light', 'Backlit'];

export default function CreativeStudioPage() {
  const [scene, setScene] = useState<SceneKind>(null);
  const [config, setConfig] = useState<Record<string, string>>({});
  const [prompt, setPrompt] = useState('');
  const [productImage, setProductImage] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  function pick(key: string, val: string) {
    setConfig((c) => ({ ...c, [key]: val }));
  }

  function buildPrompt(): string {
    const parts: string[] = [];
    if (scene === 'lifestyle') {
      parts.push('Foto lifestyle ecommerce premium.');
      if (config.model) parts.push(config.model);
      if (config.skin) parts.push(`piel ${config.skin}`);
      if (config.hair) parts.push(`cabello ${config.hair}`);
      if (config.setting) parts.push(`ambiente: ${config.setting}`);
      if (config.pose) parts.push(`pose: ${config.pose}`);
      if (config.lighting) parts.push(`iluminación ${config.lighting}`);
      if (config.angle) parts.push(`ángulo ${config.angle}`);
      if (config.framing) parts.push(`framing ${config.framing}`);
    } else if (scene === 'product') {
      parts.push('Product shot estudio ecommerce.');
      if (config.setting) parts.push(`fondo: ${config.setting}`);
      if (config.lighting) parts.push(`iluminación ${config.lighting}`);
    }
    if (prompt.trim()) parts.push(prompt.trim());
    return parts.join('. ');
  }

  async function handleGenerate() {
    setGenerating(true);
    setResultUrl(null);
    try {
      const res = await fetch('/api/landing-lab/create-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: buildPrompt(),
          input_image: productImage || undefined,
          aspect_ratio: '1:1',
          resolution: '1K',
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'create failed');
      // Poll
      const taskId = j.taskId || j.task_id;
      if (!taskId) throw new Error('no taskId returned');
      for (let i = 0; i < 60; i++) {
        await new Promise((r) => setTimeout(r, 3000));
        const sr = await fetch(`/api/landing-lab/task-status?taskId=${taskId}`);
        const sj = await sr.json();
        if (sj.status === 'completed' && sj.url) {
          setResultUrl(sj.url);
          break;
        }
        if (sj.status === 'failed') throw new Error(sj.error || 'task failed');
      }
    } catch (e: any) {
      alert(e?.message ?? 'error');
    } finally {
      setGenerating(false);
    }
  }

  function handleProductUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setProductImage(reader.result as string);
    reader.readAsDataURL(file);
  }

  return (
    <div className="flex min-h-screen bg-[#0a0a0a] text-white">
      <SideNav active="creative-studio" />
      <main className="ml-56 flex-1">
        <div className="grid h-screen grid-cols-2 gap-0">
          {/* Left: scene picker / configurator */}
          <div className="overflow-y-auto border-r border-gray-900 p-6">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-[#07A498]" />
              <h1 className="text-xl font-bold">Creative Studio</h1>
            </div>
            <p className="mt-1 text-xs text-gray-400">Genera imágenes con IA específicas para ecommerce.</p>

            {!scene && (
              <div className="mt-8 grid gap-4">
                <SceneCard
                  title="Lifestyle scene"
                  body="Persona usando o sosteniendo el producto, en un entorno realista."
                  onClick={() => setScene('lifestyle')}
                />
                <SceneCard
                  title="Product shot scene"
                  body="Producto solo, fondo/iluminación de estudio."
                  onClick={() => setScene('product')}
                />
              </div>
            )}

            {scene === 'lifestyle' && (
              <div className="mt-6 space-y-5">
                <BackBtn onClick={() => { setScene(null); setConfig({}); }} />
                <PickerGroup label="Modelo" options={MODEL_OPTIONS} value={config.model} onChange={(v) => pick('model', v)} required />
                <PickerGroup label="Tono de piel" options={SKIN} value={config.skin} onChange={(v) => pick('skin', v)} />
                <PickerGroup label="Color de pelo" options={HAIR} value={config.hair} onChange={(v) => pick('hair', v)} />
                <PickerGroup label="Ambiente" options={SETTING} value={config.setting} onChange={(v) => pick('setting', v)} />
                <PickerGroup label="Pose" options={POSE} value={config.pose} onChange={(v) => pick('pose', v)} />
                <PickerGroup label="Iluminación" options={LIGHTING} value={config.lighting} onChange={(v) => pick('lighting', v)} />
                <PickerGroup label="Ángulo" options={ANGLE} value={config.angle} onChange={(v) => pick('angle', v)} />
                <PickerGroup label="Framing" options={FRAMING} value={config.framing} onChange={(v) => pick('framing', v)} />
              </div>
            )}

            {scene === 'product' && (
              <div className="mt-6 space-y-5">
                <BackBtn onClick={() => { setScene(null); setConfig({}); }} />
                <PickerGroup label="Fondo" options={PRODUCT_SETTING} value={config.setting} onChange={(v) => pick('setting', v)} />
                <PickerGroup label="Iluminación" options={PRODUCT_LIGHTING} value={config.lighting} onChange={(v) => pick('lighting', v)} />
              </div>
            )}
          </div>

          {/* Right: composer + result */}
          <div className="flex h-screen flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-2 gap-4">
                <UploadSlot
                  label="Imagen de producto"
                  hint="Sube tu producto"
                  image={productImage}
                  onUpload={handleProductUpload}
                />
                <div className="aspect-square rounded-lg border border-dashed border-gray-800 p-3 text-xs text-gray-600">
                  Referencia (próximamente)
                </div>
              </div>

              {resultUrl && (
                <div className="mt-6">
                  <div className="text-xs font-semibold uppercase tracking-wider text-gray-400">Resultado</div>
                  <img src={resultUrl} alt="" className="mt-2 w-full rounded-lg border border-gray-800" />
                </div>
              )}
            </div>

            {/* Composer bar */}
            <div className="border-t border-gray-900 bg-[#0d0d0d] p-4">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={3}
                placeholder="Describe lo que quieres generar (opcional, los chips arriba ya construyen la base)…"
                className="w-full rounded-md border border-gray-800 bg-black px-3 py-2 text-xs placeholder:text-gray-600 focus:border-[#07A498] focus:outline-none"
              />
              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-[10px] text-gray-500">
                  <span className="rounded border border-gray-800 px-2 py-0.5">Nano Banana Pro</span>
                  <span className="rounded border border-gray-800 px-2 py-0.5">1:1</span>
                  <span className="rounded border border-gray-800 px-2 py-0.5">1K</span>
                </div>
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="flex items-center gap-1.5 rounded-md bg-[#07A498] px-4 py-2 text-xs font-semibold text-white hover:bg-[#06958a] disabled:opacity-50"
                >
                  {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  Generar
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function SceneCard({ title, body, onClick }: { title: string; body: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group rounded-xl border border-gray-800 bg-[#0d0d0d] p-5 text-left transition-colors hover:border-[#07A498]"
    >
      <div className="aspect-video rounded-lg bg-gradient-to-br from-[#07A498]/20 to-purple-500/20" />
      <h3 className="mt-3 font-semibold">{title}</h3>
      <p className="mt-1 text-xs text-gray-400">{body}</p>
    </button>
  );
}

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="text-xs text-gray-400 hover:text-white">
      ← Volver a escenas
    </button>
  );
}

function PickerGroup({
  label,
  options,
  value,
  onChange,
  required,
}: {
  label: string;
  options: string[];
  value?: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-1 text-xs font-semibold">
        <span>{label}</span>
        {!required && <span className="text-[10px] text-gray-500">(opcional)</span>}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={cn(
              'rounded-full border px-2.5 py-1 text-[11px] transition-colors',
              value === opt
                ? 'border-[#07A498] bg-[#07A498]/15 text-[#07A498]'
                : 'border-gray-800 text-gray-400 hover:border-gray-700 hover:text-white',
            )}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

function UploadSlot({
  label,
  hint,
  image,
  onUpload,
}: {
  label: string;
  hint: string;
  image: string | null;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label className="block aspect-square cursor-pointer overflow-hidden rounded-lg border border-dashed border-gray-800 hover:border-[#07A498]">
      {image ? (
        <img src={image} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full flex-col items-center justify-center text-center">
          <Upload className="h-6 w-6 text-gray-600" />
          <div className="mt-2 text-xs font-medium">{label}</div>
          <div className="text-[10px] text-gray-500">{hint}</div>
        </div>
      )}
      <input type="file" accept="image/*" onChange={onUpload} className="hidden" />
    </label>
  );
}
