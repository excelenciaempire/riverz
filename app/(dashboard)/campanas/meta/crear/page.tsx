'use client';

import { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Rocket, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Loading } from '@/components/ui/loading';
import { AdGridEditor, type AdGridRow } from '@/components/meta-ads/ad-grid-editor';
import { AssetPickerModal } from '@/components/meta-ads/asset-picker-modal';
import type { Generation } from '@/types';
import type {
  AccountsResponse,
  AdSetTarget,
  BulkUploadResponse,
  CampaignTarget,
  LaunchRequest,
  LaunchResponse,
  MetaAdMetadata,
  UploadStatusResponse,
} from '@/types/meta';

type Phase = 'idle' | 'launching' | 'done';

function defaultMetadata(): MetaAdMetadata {
  return { cta: 'SHOP_NOW' };
}
function defaultCampaign(): CampaignTarget {
  return { kind: 'new', spec: { name: 'Nueva campaña', objective: 'OUTCOME_SALES' } };
}
function defaultAdSet(): AdSetTarget {
  return {
    kind: 'new',
    spec: {
      name: 'Ad set',
      daily_budget_cents: 2000,
      countries: ['US'],
      age_min: 18,
      age_max: 65,
    },
  };
}

function CrearContent() {
  const [rows, setRows] = useState<AdGridRow[]>([]);
  const [phase, setPhase] = useState<Phase>('idle');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [uploadIds, setUploadIds] = useState<string[]>([]);
  const [launchResult, setLaunchResult] = useState<LaunchResponse | null>(null);

  const accountsQuery = useQuery<AccountsResponse>({
    queryKey: ['meta-accounts'],
    queryFn: async () => {
      const res = await fetch('/api/meta/accounts');
      if (!res.ok) throw new Error('Reconectar Meta');
      return res.json();
    },
    retry: false,
  });

  const adAccountId = accountsQuery.data?.default_ad_account_id ?? null;
  const defaultIdentity = useMemo(
    () => ({
      page_id: accountsQuery.data?.default_page_id ?? undefined,
      instagram_actor_id: accountsQuery.data?.default_instagram_id ?? undefined,
    }),
    [accountsQuery.data],
  );

  // Subir assets a Meta cuando se importan generaciones nuevas
  const uploadMutation = useMutation({
    mutationFn: async (gens: Generation[]): Promise<BulkUploadResponse> => {
      if (!adAccountId) throw new Error('Configura tu cuenta publicitaria');
      const res = await fetch('/api/meta/upload/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          generationIds: gens.map((g) => g.id),
          adAccountId,
          metadata: {},
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || 'Falló la subida');
      return body;
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleImport = async (picked: Generation[]) => {
    if (picked.length === 0) return;
    if (!adAccountId) {
      toast.error('Configura tu cuenta publicitaria en /campanas/meta');
      return;
    }
    try {
      const result = await uploadMutation.mutateAsync(picked);
      const newRows: AdGridRow[] = result.uploads.map((u) => {
        const gen = picked.find((g) => g.id === u.generation_id);
        return {
          rowId: crypto.randomUUID(),
          uploadId: u.id,
          generationId: u.generation_id,
          metadata: defaultMetadata(),
          campaign: defaultCampaign(),
          adset: defaultAdSet(),
          resultUrl: gen?.result_url ?? undefined,
          generationType: gen?.type,
        };
      });
      setRows((prev) => [...prev, ...newRows]);
      setUploadIds((prev) => [...prev, ...newRows.map((r) => r.uploadId)]);
      toast.success(`${newRows.length} asset(s) subiendo a Meta…`);
    } catch (err: any) {
      // toast handled by onError
    }
  };

  // Polling de estado de uploads
  const statusQuery = useQuery<UploadStatusResponse>({
    queryKey: ['ad-grid-upload-status', uploadIds.join(',')],
    queryFn: async () => {
      const res = await fetch(`/api/meta/upload/status?ids=${uploadIds.join(',')}`);
      if (!res.ok) throw new Error('Falló el polling');
      return res.json();
    },
    enabled: uploadIds.length > 0,
    refetchInterval: (query) => (query.state.data?.allDone ? false : 3000),
  });

  const uploadStatusByid = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of statusQuery.data?.uploads ?? []) map.set(u.id, u.status);
    return map;
  }, [statusQuery.data]);

  const notReadyCount = rows.filter((r) => {
    const s = uploadStatusByid.get(r.uploadId);
    return s !== undefined && s !== 'ready';
  }).length;
  const failedCount = rows.filter((r) => uploadStatusByid.get(r.uploadId) === 'failed').length;

  // Lanzamiento
  const launchMutation = useMutation({
    mutationFn: async (): Promise<LaunchResponse> => {
      if (!adAccountId) throw new Error('Sin cuenta publicitaria');
      const payload: LaunchRequest = {
        adAccountId,
        rows: rows.map((r) => ({
          rowId: r.rowId,
          uploadId: r.uploadId,
          metadata: r.metadata,
          campaign: r.campaign,
          adset: r.adset,
          identity: r.identity,
        })),
      };
      const res = await fetch('/api/meta/launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || 'No se pudo lanzar');
      return body as LaunchResponse;
    },
    onSuccess: (data) => {
      setLaunchResult(data);
      setPhase('done');
      const okCount = data.rows.filter((r) => r.adId).length;
      toast.success(`${okCount} ad(s) creados en pausa`);
    },
    onError: (err: Error) => {
      setPhase('idle');
      toast.error(err.message);
    },
  });

  const handleLaunch = () => {
    if (!adAccountId) {
      toast.error('Configura tu cuenta publicitaria en /campanas/meta');
      return;
    }
    if (!accountsQuery.data?.default_page_id) {
      toast.error('Configura tu Fan Page primero en /campanas/meta');
      return;
    }
    if (rows.length === 0) {
      toast.error('Añade al menos un anuncio');
      return;
    }
    if (notReadyCount > 0) {
      toast.error(`${notReadyCount} asset(s) aún no están listos en Meta`);
      return;
    }
    setPhase('launching');
    launchMutation.mutate();
  };

  const summary = useMemo(() => {
    const newCampaigns = new Set<string>();
    const existingCampaigns = new Set<string>();
    const newAdSets = new Set<string>();
    const existingAdSets = new Set<string>();
    for (const r of rows) {
      if (r.campaign.kind === 'new') newCampaigns.add(r.campaign.spec.name);
      else existingCampaigns.add(r.campaign.id);
      if (r.adset.kind === 'new') newAdSets.add(`${r.adset.spec.name}@@${
        r.campaign.kind === 'new' ? r.campaign.spec.name : r.campaign.id
      }`);
      else existingAdSets.add(r.adset.id);
    }
    return { newCampaigns, existingCampaigns, newAdSets, existingAdSets };
  }, [rows]);

  if (accountsQuery.isLoading) return <Loading text="Conectando con Meta..." />;
  if (accountsQuery.isError) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-red-400">No se pudo cargar tu cuenta de Meta.</p>
        <Link href="/campanas/meta" className="text-sm text-brand-accent hover:underline">
          Reconectar
        </Link>
      </div>
    );
  }
  if (!adAccountId) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-6 text-sm text-amber-300">
        Configura tu cuenta publicitaria primero en{' '}
        <Link href="/campanas/meta" className="underline">
          /campanas/meta
        </Link>
        .
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-12">
      <div className="flex items-center gap-3">
        <Link
          href="/campanas/meta"
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Volver
        </Link>
      </div>

      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Nueva campaña</h1>
          <p className="mt-0.5 text-sm text-gray-400">
            Importa assets, edítalos en grilla, asígnalos a campañas/ad sets y lanza todo en pausa.
          </p>
        </div>
        <div className="text-right text-xs text-gray-500">
          <div>
            <span className="text-white">{rows.length}</span> ads
          </div>
          {notReadyCount > 0 && (
            <div className="text-amber-400">
              {notReadyCount} subiendo a Meta…
            </div>
          )}
          {failedCount > 0 && <div className="text-red-400">{failedCount} fallaron</div>}
        </div>
      </div>

      {phase === 'done' && launchResult ? (
        <LaunchSummary result={launchResult} onReset={() => {
          setRows([]);
          setUploadIds([]);
          setLaunchResult(null);
          setPhase('idle');
        }} />
      ) : (
        <AdGridEditor
          rows={rows}
          onChange={setRows}
          adAccountId={adAccountId}
          defaultIdentity={defaultIdentity}
          onImportAssets={() => setPickerOpen(true)}
        />
      )}

      {phase !== 'done' && rows.length > 0 && (
        <div className="sticky bottom-0 z-20 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-800 bg-[#141414] px-4 py-3 shadow-lg">
          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
            <span>
              <span className="text-white">{summary.existingCampaigns.size + summary.newCampaigns.size}</span>{' '}
              campañas ({summary.newCampaigns.size} nuevas)
            </span>
            <span>·</span>
            <span>
              <span className="text-white">{summary.existingAdSets.size + summary.newAdSets.size}</span>{' '}
              ad sets ({summary.newAdSets.size} nuevos)
            </span>
            <span>·</span>
            <span>
              <span className="text-white">{rows.length}</span> ads
            </span>
            {notReadyCount > 0 && (
              <span className="flex items-center gap-1 text-amber-400">
                <AlertTriangle className="h-3 w-3" />
                {notReadyCount} aún subiendo
              </span>
            )}
          </div>
          <Button
            onClick={handleLaunch}
            disabled={
              phase === 'launching' ||
              notReadyCount > 0 ||
              uploadMutation.isPending ||
              rows.length === 0
            }
          >
            <Rocket className="mr-1.5 h-4 w-4" />
            {phase === 'launching' ? 'Lanzando…' : `Lanzar ${rows.length} ad${rows.length === 1 ? '' : 's'}`}
          </Button>
        </div>
      )}

      <AssetPickerModal
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handleImport}
        alreadyPickedIds={rows.map((r) => r.generationId)}
      />
    </div>
  );
}

function LaunchSummary({
  result,
  onReset,
}: {
  result: LaunchResponse;
  onReset: () => void;
}) {
  const okRows = result.rows.filter((r) => r.adId);
  const errorRows = result.rows.filter((r) => r.error);
  return (
    <div className="space-y-4 rounded-xl border border-gray-800 bg-[#141414] p-6">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-5 w-5 text-emerald-400" />
        <h2 className="text-lg font-semibold text-white">
          {okRows.length} ad{okRows.length === 1 ? '' : 's'} creado
          {okRows.length === 1 ? '' : 's'} en pausa
        </h2>
      </div>
      <p className="text-sm text-gray-400">
        Activa los anuncios desde Ads Manager cuando estés listo. Las campañas y ad sets nuevos
        también quedaron en PAUSA.
      </p>
      {result.created.campaigns.length > 0 && (
        <div className="rounded border border-gray-800 bg-black/30 p-3 text-xs">
          <p className="mb-1 text-[10px] uppercase text-gray-500">Campañas creadas</p>
          <ul className="space-y-0.5 text-gray-300">
            {result.created.campaigns.map((c) => (
              <li key={c.id}>
                <span className="font-mono text-[11px] text-gray-500">{c.id}</span> · {c.name}
              </li>
            ))}
          </ul>
        </div>
      )}
      {result.created.adsets.length > 0 && (
        <div className="rounded border border-gray-800 bg-black/30 p-3 text-xs">
          <p className="mb-1 text-[10px] uppercase text-gray-500">Ad sets creados</p>
          <ul className="space-y-0.5 text-gray-300">
            {result.created.adsets.map((a) => (
              <li key={a.id}>
                <span className="font-mono text-[11px] text-gray-500">{a.id}</span> · {a.name}
              </li>
            ))}
          </ul>
        </div>
      )}
      {errorRows.length > 0 && (
        <div className="rounded border border-red-500/30 bg-red-500/5 p-3 text-xs">
          <p className="mb-1 text-[10px] uppercase text-red-300">
            {errorRows.length} fila{errorRows.length === 1 ? '' : 's'} con error
          </p>
          <ul className="space-y-0.5 text-red-300/80">
            {errorRows.map((r) => (
              <li key={r.rowId}>· {r.error}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex gap-2">
        <Button onClick={onReset} variant="outline">
          Crear otra campaña
        </Button>
        <Link href="/campanas/meta">
          <Button>Ver campañas</Button>
        </Link>
      </div>
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
