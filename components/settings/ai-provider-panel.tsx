'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sparkles, Check, KeyRound, ShieldCheck, AlertTriangle } from 'lucide-react';

interface UserSettings {
  ai_provider_primary: 'kie' | 'gemini';
  ai_provider_fallback_enabled: boolean;
  has_gemini_key: boolean;
  gemini_api_key_last4: string | null;
  gemini_api_key_validated_at: string | null;
}

export function AiProviderPanel() {
  const qc = useQueryClient();
  const [keyInput, setKeyInput] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['user'],
    queryFn: async () => {
      const res = await fetch('/api/user');
      if (!res.ok) throw new Error('No se pudo cargar la configuración');
      return (await res.json()) as UserSettings;
    },
  });

  const [primary, setPrimary] = useState<'kie' | 'gemini'>('kie');
  const [fallback, setFallback] = useState(true);

  useEffect(() => {
    if (data) {
      setPrimary(data.ai_provider_primary);
      setFallback(data.ai_provider_fallback_enabled);
    }
  }, [data]);

  const saveKey = useMutation({
    mutationFn: async (apiKey: string) => {
      const res = await fetch('/api/user/gemini-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey }),
      });
      const json = await res.json();
      if (!res.ok || json.ok === false) {
        throw new Error(json.error || 'No se pudo validar la API key');
      }
      return json;
    },
    onSuccess: () => {
      setKeyInput('');
      qc.invalidateQueries({ queryKey: ['user'] });
      toast.success('API key de Gemini validada y guardada');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteKey = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/user/gemini-key', { method: 'DELETE' });
      if (!res.ok) throw new Error('No se pudo eliminar la API key');
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user'] });
      toast.success('API key eliminada. Volviste a kie.ai como canal principal.');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const savePref = useMutation({
    mutationFn: async (vars: { primary: 'kie' | 'gemini'; fallback_enabled: boolean }) => {
      const res = await fetch('/api/user/ai-provider-preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vars),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || 'No se pudo guardar la preferencia');
      return json;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user'] });
      toast.success('Preferencia guardada');
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) return null;

  const hasKey = !!data?.has_gemini_key;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-brand-accent" />
        <h2 className="text-xl font-semibold text-white">Proveedor de IA · Static Ads</h2>
      </div>
      <p className="text-sm text-gray-400">
        Elige qué motor genera tus creativos estáticos. Puedes conectar ambos canales y usar uno como
        principal y el otro como fallback automático.
      </p>

      {/* kie.ai card */}
      <div className="rounded-lg border border-gray-700 bg-black/30 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-white">kie.ai</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-green-900/30 px-2 py-0.5 text-xs text-green-400">
                <Check className="h-3 w-3" /> Conectado
              </span>
            </div>
            <p className="mt-1 text-xs text-gray-400">
              Provisionado por Riverz · 14 créditos por imagen.
            </p>
          </div>
        </div>
      </div>

      {/* Gemini card */}
      <div className="rounded-lg border border-gray-700 bg-black/30 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-white">Gemini directo</span>
              {hasKey ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-900/30 px-2 py-0.5 text-xs text-green-400">
                  <ShieldCheck className="h-3 w-3" /> Validada · termina en …{data?.gemini_api_key_last4}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-gray-800 px-2 py-0.5 text-xs text-gray-400">
                  <KeyRound className="h-3 w-3" /> Sin key
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-gray-400">
              Pega tu API key de{' '}
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-white"
              >
                Google AI Studio
              </a>
              . Tú pagas a Google directamente — Riverz cobra 0 créditos por imagen mientras esté en
              preview.
            </p>

            {!hasKey && (
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Input
                  type="password"
                  placeholder="AIzaSy..."
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  className="bg-gray-800"
                />
                <Button
                  onClick={() => saveKey.mutate(keyInput.trim())}
                  disabled={saveKey.isPending || keyInput.trim().length < 20}
                >
                  {saveKey.isPending ? 'Validando…' : 'Probar y guardar'}
                </Button>
              </div>
            )}

            {hasKey && (
              <div className="mt-3 flex items-center gap-2">
                <span className="text-xs text-gray-500">
                  Validada el{' '}
                  {data?.gemini_api_key_validated_at
                    ? new Date(data.gemini_api_key_validated_at).toLocaleString()
                    : '—'}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => deleteKey.mutate()}
                  disabled={deleteKey.isPending}
                  className="ml-auto"
                >
                  Eliminar key
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Primary / fallback selector */}
      <div className="rounded-lg border border-gray-700 bg-black/30 p-4">
        <Label className="text-white">Canal principal</Label>
        <div className="mt-3 space-y-2">
          <label className="flex cursor-pointer items-center gap-3 rounded-md border border-gray-800 bg-black/40 p-3 hover:border-gray-600">
            <input
              type="radio"
              checked={primary === 'kie'}
              onChange={() => setPrimary('kie')}
              className="h-4 w-4 accent-brand-accent"
            />
            <div className="flex-1">
              <div className="font-medium text-white">kie.ai (default)</div>
              <div className="text-xs text-gray-400">14 créditos por imagen, gestionado por Riverz.</div>
            </div>
          </label>
          <label
            className={`flex items-center gap-3 rounded-md border p-3 ${
              hasKey
                ? 'cursor-pointer border-gray-800 bg-black/40 hover:border-gray-600'
                : 'cursor-not-allowed border-gray-900 bg-black/20 opacity-50'
            }`}
          >
            <input
              type="radio"
              checked={primary === 'gemini'}
              onChange={() => hasKey && setPrimary('gemini')}
              disabled={!hasKey}
              className="h-4 w-4 accent-brand-accent"
            />
            <div className="flex-1">
              <div className="font-medium text-white">Gemini directo</div>
              <div className="text-xs text-gray-400">
                {hasKey
                  ? '0 créditos en Riverz, pagas a Google. Llamada multimodal directa, sin polling.'
                  : 'Conecta primero una API key de Gemini válida.'}
              </div>
            </div>
          </label>
        </div>

        <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-gray-300">
          <input
            type="checkbox"
            checked={fallback}
            onChange={(e) => setFallback(e.target.checked)}
            className="h-4 w-4 accent-brand-accent"
          />
          Usar el otro proveedor como fallback automático si el principal falla
        </label>

        {primary === 'gemini' && !hasKey && (
          <div className="mt-3 flex items-start gap-2 rounded-md border border-yellow-900/50 bg-yellow-950/30 p-2 text-xs text-yellow-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            Conecta una API key de Gemini antes de elegirlo como canal principal.
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <Button
            onClick={() => savePref.mutate({ primary, fallback_enabled: fallback })}
            disabled={
              savePref.isPending ||
              (primary === 'gemini' && !hasKey) ||
              (primary === data?.ai_provider_primary && fallback === data?.ai_provider_fallback_enabled)
            }
          >
            {savePref.isPending ? 'Guardando…' : 'Guardar preferencia'}
          </Button>
        </div>
      </div>
    </div>
  );
}
