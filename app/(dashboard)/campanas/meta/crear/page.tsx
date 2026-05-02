'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useUser } from '@clerk/nextjs';
import { toast } from 'sonner';
import { ArrowLeft, Check, ChevronRight, Sparkles, Image as ImageIcon, Video, ExternalLink } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Loading } from '@/components/ui/loading';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BulkMetadataEditor } from '@/components/meta-ads/bulk-metadata-editor';
import type { Generation } from '@/types';
import type {
  AccountsResponse,
  BulkUploadResponse,
  UploadStatusResponse,
  MetaAdMetadata,
  CreateCampaignResponse,
} from '@/types/meta';
import { cn } from '@/lib/utils';

type Step = 'pick' | 'edit' | 'campaign' | 'launching' | 'done';

const VIDEO_TYPES = new Set(['ugc', 'face_swap', 'clips', 'mejorar_calidad_video']);

const OBJECTIVES: Array<{ value: string; label: string; hint: string }> = [
  { value: 'OUTCOME_SALES', label: 'Ventas', hint: 'Optimiza por compras (necesita pixel + evento)' },
  { value: 'OUTCOME_TRAFFIC', label: 'Tráfico', hint: 'Clicks al sitio web' },
  { value: 'OUTCOME_ENGAGEMENT', label: 'Interacción', hint: 'Likes, comentarios, mensajes' },
  { value: 'OUTCOME_LEADS', label: 'Leads', hint: 'Formularios instantáneos' },
  { value: 'OUTCOME_AWARENESS', label: 'Awareness', hint: 'Reach + impresiones' },
];

const COUNTRY_OPTIONS = [
  { code: 'US', label: 'Estados Unidos' },
  { code: 'MX', label: 'México' },
  { code: 'CO', label: 'Colombia' },
  { code: 'AR', label: 'Argentina' },
  { code: 'ES', label: 'España' },
  { code: 'CL', label: 'Chile' },
  { code: 'PE', label: 'Perú' },
  { code: 'BR', label: 'Brasil' },
];

function CrearContent() {
  const { user } = useUser();
  const router = useRouter();
  const supabase = createClient();
  const [step, setStep] = useState<Step>('pick');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [metadata, setMetadata] = useState<Record<string, MetaAdMetadata>>({});
  const [filter, setFilter] = useState<'all' | 'videos' | 'images'>('all');

  // Campaign form
  const [campaignName, setCampaignName] = useState('');
  const [objective, setObjective] = useState('OUTCOME_SALES');
  const [dailyBudget, setDailyBudget] = useState('20');
  const [country, setCountry] = useState('US');
  const [link, setLink] = useState('');
  const [cta, setCta] = useState('SHOP_NOW');
  const [ageMin, setAgeMin] = useState('18');
  const [ageMax, setAgeMax] = useState('65');

  // Result
  const [uploadIds, setUploadIds] = useState<string[]>([]);
  const [createdCampaign, setCreatedCampaign] = useState<CreateCampaignResponse | null>(null);

  const accountsQuery = useQuery<AccountsResponse>({
    queryKey: ['meta-accounts'],
    queryFn: async () => {
      const res = await fetch('/api/meta/accounts');
      if (!res.ok) throw new Error('Reconectar Meta');
      return res.json();
    },
    retry: false,
  });

  const generationsQuery = useQuery({
    queryKey: ['generations-for-campaign', user?.id, filter],
    queryFn: async () => {
      let q = supabase
        .from('generations')
        .select('*')
        .eq('clerk_user_id', user!.id)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(60);
      if (filter === 'videos') {
        q = q.in('type', Array.from(VIDEO_TYPES));
      } else if (filter === 'images') {
        q = q.in('type', [
          'editar_foto_crear',
          'editar_foto_editar',
          'editar_foto_combinar',
          'editar_foto_clonar',
          'mejorar_calidad_imagen',
          'static_ad_generation',
        ]);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data as Generation[];
    },
    enabled: !!user?.id,
  });

  const selectedGenerations = useMemo(() => {
    return (generationsQuery.data || []).filter((g) => selectedIds.has(g.id));
  }, [generationsQuery.data, selectedIds]);

  const toggleId = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 10) next.add(id);
      else toast.error('Máximo 10 anuncios por campaña');
      return next;
    });
  };

  // Step transitions
  const goToEdit = () => {
    if (selectedIds.size === 0) {
      toast.error('Selecciona al menos un asset');
      return;
    }
    setStep('edit');
  };

  // Upload + status flow
  const uploadMutation = useMutation({
    mutationFn: async (): Promise<BulkUploadResponse> => {
      const res = await fetch('/api/meta/upload/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          generationIds: selectedGenerations.map((g) => g.id),
          adAccountId: accountsQuery.data!.default_ad_account_id,
          metadata,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || 'Falló la subida');
      return body;
    },
    onSuccess: (data) => {
      setUploadIds(data.uploads.map((u) => u.id));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const statusQuery = useQuery<UploadStatusResponse>({
    queryKey: ['campaign-upload-status', uploadIds.join(',')],
    queryFn: async () => {
      const res = await fetch(`/api/meta/upload/status?ids=${uploadIds.join(',')}`);
      if (!res.ok) throw new Error('Falló el polling');
      return res.json();
    },
    enabled: step === 'launching' && uploadIds.length > 0 && !createdCampaign,
    refetchInterval: (query) => (query.state.data?.allDone ? false : 3000),
  });

  const createCampaignMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/meta/campaigns/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adAccountId: accountsQuery.data!.default_ad_account_id,
          pageId: accountsQuery.data!.default_page_id,
          instagramId: accountsQuery.data!.default_instagram_id,
          campaignName,
          objective,
          dailyBudgetCents: Math.round(Number(dailyBudget) * 100),
          link,
          cta,
          uploadIds,
          countries: [country],
          targetingAgeMin: Number(ageMin),
          targetingAgeMax: Number(ageMax),
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || 'No se pudo crear la campaña');
      return body as CreateCampaignResponse;
    },
    onSuccess: (data) => {
      setCreatedCampaign(data);
      setStep('done');
      toast.success(`Campaña creada con ${data.ad_ids.length} ads (en pausa)`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Auto-trigger campaign creation when uploads are ready.
  useEffect(() => {
    if (step !== 'launching' || createdCampaign || createCampaignMutation.isPending) return;
    if (statusQuery.data?.allDone && statusQuery.data.uploads.every((u) => u.status === 'ready')) {
      createCampaignMutation.mutate();
    } else if (statusQuery.data?.allDone) {
      const failed = statusQuery.data.uploads.filter((u) => u.status === 'failed');
      if (failed.length > 0) toast.error(`${failed.length} asset(s) fallaron — revisa /campanas/meta`);
    }
  }, [statusQuery.data, step, createdCampaign, createCampaignMutation]);

  const launch = () => {
    if (!accountsQuery.data?.default_ad_account_id) {
      toast.error('Configura tu cuenta publicitaria en /campanas/meta');
      return;
    }
    if (!accountsQuery.data?.default_page_id) {
      toast.error('Configura tu Fan Page primero en /campanas/meta');
      return;
    }
    if (!campaignName || !link) {
      toast.error('Completa nombre y URL destino');
      return;
    }
    setStep('launching');
    uploadMutation.mutate();
  };

  return (
    <div className="space-y-5 pb-12">
      <div className="flex items-center gap-3">
        <Link href="/campanas/meta" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Volver
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-white">Nueva campaña</h1>
        <p className="mt-0.5 text-sm text-gray-400">
          Selecciona assets de tu historial → edita el copy en bulk → lanza la campaña en pausa.
        </p>
      </div>

      <Stepper step={step} />

      {/* STEP 1: PICK */}
      {step === 'pick' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              {(['all', 'videos', 'images'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-xs font-medium transition',
                    filter === f
                      ? 'bg-brand-accent text-white'
                      : 'bg-brand-dark-secondary text-gray-400 hover:text-white',
                  )}
                >
                  {f === 'all' ? 'Todos' : f === 'videos' ? 'Videos' : 'Imágenes'}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500">
              <span className="text-white">{selectedIds.size}</span>/10 seleccionados
            </p>
          </div>

          {!user || generationsQuery.isLoading || generationsQuery.isPending ? (
            <Loading />
          ) : (generationsQuery.data || []).length === 0 ? (
            <div className="rounded-xl border border-gray-800 bg-[#141414] p-8 text-center">
              <p className="text-gray-400">No tienes generaciones completadas todavía.</p>
              <Link href="/crear" className="mt-2 inline-block text-sm text-brand-accent hover:underline">
                Crear contenido
              </Link>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
              {(generationsQuery.data || []).map((g) => {
                const selected = selectedIds.has(g.id);
                const isVideo = VIDEO_TYPES.has(g.type) || g.type.includes('video');
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => toggleId(g.id)}
                    className={cn(
                      'group relative aspect-square overflow-hidden rounded-lg border bg-gray-900 transition',
                      selected
                        ? 'border-brand-accent ring-2 ring-brand-accent/40'
                        : 'border-gray-800 hover:border-brand-accent',
                    )}
                  >
                    {g.result_url &&
                      (isVideo ? (
                        <video src={g.result_url} className="h-full w-full object-cover" muted />
                      ) : (
                        <img src={g.result_url} className="h-full w-full object-cover" alt="" />
                      ))}
                    <div className="absolute left-1.5 top-1.5">
                      <div
                        className={cn(
                          'flex h-6 w-6 items-center justify-center rounded border transition',
                          selected
                            ? 'border-brand-accent bg-brand-accent text-white'
                            : 'border-gray-500 bg-black/60 text-transparent group-hover:text-white',
                        )}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </div>
                    </div>
                    <div className="absolute right-1.5 top-1.5 rounded-md bg-black/70 px-1.5 py-0.5 text-[9px] uppercase text-white">
                      {isVideo ? <Video className="inline h-3 w-3" /> : <ImageIcon className="inline h-3 w-3" />}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={goToEdit} disabled={selectedIds.size === 0}>
              Continuar con {selectedIds.size}
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* STEP 2: EDIT */}
      {step === 'edit' && (
        <div className="space-y-4">
          <BulkMetadataEditor
            generations={selectedGenerations}
            metadata={metadata}
            onChange={setMetadata}
          />
          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setStep('pick')}>
              Atrás
            </Button>
            <Button onClick={() => setStep('campaign')}>
              Configurar campaña
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* STEP 3: CAMPAIGN */}
      {step === 'campaign' && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Card>
              <CardHeader>Campaña</CardHeader>
              <Field label="Nombre">
                <input
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  placeholder="Ej: Q2 - Lanzamiento producto X"
                  className="w-full rounded border border-gray-700 bg-[#0a0a0a] px-3 py-2 text-sm text-white"
                />
              </Field>
              <Field label="Objetivo">
                <Select value={objective} onValueChange={setObjective}>
                  <SelectTrigger className="border-gray-700 bg-[#0a0a0a] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-gray-800 bg-[#141414] text-white">
                    {OBJECTIVES.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                        <span className="ml-2 text-xs text-gray-500">— {o.hint}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="URL destino">
                <input
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  placeholder="https://shop.example.com/producto"
                  className="w-full rounded border border-gray-700 bg-[#0a0a0a] px-3 py-2 text-sm text-white"
                />
              </Field>
            </Card>

            <Card>
              <CardHeader>Ad set</CardHeader>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Presupuesto diario (USD)">
                  <input
                    type="number"
                    min="1"
                    value={dailyBudget}
                    onChange={(e) => setDailyBudget(e.target.value)}
                    className="w-full rounded border border-gray-700 bg-[#0a0a0a] px-3 py-2 text-sm text-white"
                  />
                </Field>
                <Field label="País">
                  <Select value={country} onValueChange={setCountry}>
                    <SelectTrigger className="border-gray-700 bg-[#0a0a0a] text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-gray-800 bg-[#141414] text-white">
                      {COUNTRY_OPTIONS.map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Edad mínima">
                  <input
                    type="number"
                    min="13"
                    max="65"
                    value={ageMin}
                    onChange={(e) => setAgeMin(e.target.value)}
                    className="w-full rounded border border-gray-700 bg-[#0a0a0a] px-3 py-2 text-sm text-white"
                  />
                </Field>
                <Field label="Edad máxima">
                  <input
                    type="number"
                    min="18"
                    max="65"
                    value={ageMax}
                    onChange={(e) => setAgeMax(e.target.value)}
                    className="w-full rounded border border-gray-700 bg-[#0a0a0a] px-3 py-2 text-sm text-white"
                  />
                </Field>
              </div>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader>Resumen</CardHeader>
              <Summary
                accounts={accountsQuery.data}
                count={selectedIds.size}
                budget={dailyBudget}
                country={country}
              />
            </Card>
            <div className="flex flex-col gap-2">
              <Button onClick={launch} disabled={!accountsQuery.data?.default_page_id}>
                <Sparkles className="mr-1.5 h-4 w-4" />
                Lanzar campaña en PAUSA
              </Button>
              <Button variant="ghost" onClick={() => setStep('edit')}>
                Atrás
              </Button>
              {!accountsQuery.data?.default_page_id && (
                <p className="text-xs text-amber-400">
                  Selecciona una Fan Page en{' '}
                  <Link href="/campanas/meta" className="underline">
                    /campanas/meta
                  </Link>{' '}
                  primero.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* STEP 4: LAUNCHING */}
      {step === 'launching' && (
        <div className="rounded-xl border border-gray-800 bg-[#141414] p-8 text-center">
          {!createdCampaign ? (
            <>
              <Loading text="Subiendo assets a Meta y creando la campaña..." />
              {statusQuery.data && (
                <p className="mt-3 text-xs text-gray-500">
                  {statusQuery.data.uploads.filter((u) => u.status === 'ready').length}/{statusQuery.data.uploads.length} assets listos
                </p>
              )}
            </>
          ) : (
            <Loading text="Creando campaña..." />
          )}
        </div>
      )}

      {/* STEP 5: DONE */}
      {step === 'done' && createdCampaign && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-6">
          <div className="mb-2 flex items-center gap-2 text-emerald-400">
            <Check className="h-5 w-5" />
            <h3 className="text-lg font-semibold">Campaña creada en pausa</h3>
          </div>
          <p className="mb-4 text-sm text-gray-300">
            {createdCampaign.ad_ids.length} ad(s) creados. Revisa, ajusta y activa desde Meta Ads Manager.
          </p>
          <div className="grid gap-2 text-xs text-gray-400">
            <p>Campaign ID: <span className="font-mono text-white">{createdCampaign.campaign_id}</span></p>
            <p>Ad set ID: <span className="font-mono text-white">{createdCampaign.adset_id}</span></p>
            <p>Ad IDs: <span className="font-mono text-white">{createdCampaign.ad_ids.join(', ')}</span></p>
          </div>
          {createdCampaign.warnings.length > 0 && (
            <div className="mt-4 rounded border border-amber-500/40 bg-amber-500/10 p-3">
              <p className="mb-1 text-xs font-semibold text-amber-300">Warnings:</p>
              <ul className="list-disc pl-4 text-xs text-amber-200">
                {createdCampaign.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="mt-5 flex gap-2">
            <a
              href={`https://www.facebook.com/adsmanager/manage/campaigns?selected_campaign_ids=${createdCampaign.campaign_id}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md bg-brand-accent px-4 py-2 text-sm font-medium text-white hover:bg-brand-accent/90"
            >
              <ExternalLink className="h-4 w-4" />
              Abrir en Ads Manager
            </a>
            <Button variant="outline" onClick={() => router.push('/campanas/meta/anuncios')}>
              Ver mis anuncios
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Stepper({ step }: { step: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: 'pick', label: '1. Seleccionar' },
    { key: 'edit', label: '2. Editar copy' },
    { key: 'campaign', label: '3. Campaña' },
    { key: 'launching', label: '4. Lanzar' },
  ];
  const idx = steps.findIndex((s) => s.key === step);
  const current = step === 'done' ? steps.length - 1 : idx;
  return (
    <div className="flex items-center gap-2 text-xs">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center gap-2">
          <span
            className={cn(
              'rounded-full px-2 py-1',
              i <= current ? 'bg-brand-accent text-white' : 'bg-gray-800 text-gray-500',
            )}
          >
            {s.label}
          </span>
          {i < steps.length - 1 && <ChevronRight className="h-3 w-3 text-gray-600" />}
        </div>
      ))}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="space-y-3 rounded-xl border border-gray-800 bg-[#141414] p-5">{children}</div>;
}

function CardHeader({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-400">{children}</h3>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] uppercase tracking-wide text-gray-500">{label}</label>
      {children}
    </div>
  );
}

function Summary({
  accounts,
  count,
  budget,
  country,
}: {
  accounts: AccountsResponse | undefined;
  count: number;
  budget: string;
  country: string;
}) {
  return (
    <div className="space-y-2 text-xs text-gray-400">
      <Row label="Cuenta" value={accounts?.accounts.find((a) => a.id === accounts.default_ad_account_id)?.name || '—'} />
      <Row label="Página" value={accounts?.default_page_name || '—'} />
      <Row label="Instagram" value={accounts?.default_instagram_username ? `@${accounts.default_instagram_username}` : 'Solo Facebook'} />
      <Row label="Anuncios" value={`${count}`} />
      <Row label="Budget" value={`$${budget}/día`} />
      <Row label="País" value={country} />
      <p className="mt-2 rounded border border-amber-500/30 bg-amber-500/10 p-2 text-[11px] text-amber-300">
        La campaña se crea en PAUSA — debes activarla manualmente desde Ads Manager.
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-gray-500">{label}</span>
      <span className="truncate text-right text-white">{value}</span>
    </div>
  );
}

export default function CrearPage() {
  return (
    <Suspense fallback={<Loading />}>
      <CrearContent />
    </Suspense>
  );
}
