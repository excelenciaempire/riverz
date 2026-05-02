'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Rocket,
  AlertTriangle,
  CheckCircle2,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Loading } from '@/components/ui/loading';
import {
  AdGridEditor,
  makeEmptyRow,
  type AdGridRow,
} from '@/components/meta-ads/ad-grid-editor';
import { AssetPickerModal } from '@/components/meta-ads/asset-picker-modal';
import type { Generation } from '@/types';
import type {
  AccountsResponse,
  BulkUploadResponse,
  LaunchAdRow,
  LaunchRequest,
  LaunchResponse,
  UploadStatusResponse,
} from '@/types/meta';

type Phase = 'idle' | 'uploading' | 'launching' | 'done';

const DRAFT_KEY = 'rvz_meta_crear_draft';
const DRAFT_TTL_MS = 60_000; // 1 minuto, según pidió el usuario

interface PersistedDraft {
  rows: AdGridRow[];
  savedAt: number;
}

function loadDraft(): AdGridRow[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedDraft;
    if (!parsed.savedAt || Date.now() - parsed.savedAt > DRAFT_TTL_MS) {
      localStorage.removeItem(DRAFT_KEY);
      return null;
    }
    return parsed.rows;
  } catch {
    return null;
  }
}

function saveDraft(rows: AdGridRow[]) {
  if (typeof window === 'undefined') return;
  try {
    if (rows.length === 0) {
      localStorage.removeItem(DRAFT_KEY);
      return;
    }
    const draft: PersistedDraft = { rows, savedAt: Date.now() };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* ignore quota / private mode */
  }
}

function clearDraft() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

function CrearContent() {
  const [rows, setRows] = useState<AdGridRow[]>([]);
  const [phase, setPhase] = useState<Phase>('idle');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [launchProgress, setLaunchProgress] = useState<{ ready: number; total: number } | null>(
    null,
  );
  const [launchResult, setLaunchResult] = useState<LaunchResponse | null>(null);
  const draftRestoredRef = useRef(false);

  // Restaurar draft al montar (TTL 60s)
  useEffect(() => {
    if (draftRestoredRef.current) return;
    const draft = loadDraft();
    if (draft && draft.length > 0) {
      setRows(draft);
      toast.info(`Restauramos tu draft (${draft.length} ad${draft.length === 1 ? '' : 's'})`);
    }
    draftRestoredRef.current = true;
  }, []);

  // Auto-guardar draft (debounced) — sólo si hay filas
  useEffect(() => {
    if (!draftRestoredRef.current) return;
    const t = setTimeout(() => saveDraft(rows), 800);
    return () => clearTimeout(t);
  }, [rows]);

  // Limpiar el draft al salir si está vacío o cuando se completó el lanzamiento
  useEffect(() => {
    if (phase === 'done') clearDraft();
  }, [phase]);

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

  // Importar assets = sólo añadir filas a la grilla, sin tocar Meta todavía.
  const handleImport = (picked: Generation[]) => {
    if (picked.length === 0) return;
    const newRows: AdGridRow[] = picked.map((g) =>
      makeEmptyRow(g.id, {
        resultUrl: g.result_url ?? undefined,
        generationType: g.type,
      }),
    );
    setRows((prev) => [...prev, ...newRows]);
    toast.success(`${newRows.length} asset(s) añadidos a la grilla`);
  };

  const handleReset = () => {
    if (rows.length === 0) return;
    const ok = window.confirm(
      '¿Empezar de cero? Vas a perder los ' +
        rows.length +
        ' ads que tienes en la grilla.',
    );
    if (!ok) return;
    setRows([]);
    setLaunchResult(null);
    setPhase('idle');
    clearDraft();
  };

  // Lanzar = subir a Meta + crear ads en una sola acción del usuario
  const launch = async () => {
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
    // Validación mínima por fila
    const missing: string[] = [];
    for (const r of rows) {
      if (!r.metadata.link_url) missing.push('destination URL');
      if (!r.campaign.id) missing.push('campaña');
      if (!r.adset.id) missing.push('ad set');
      if (
        !r.metadata.headline &&
        !(r.metadata.headlines && r.metadata.headlines.length)
      )
        missing.push('headline');
    }
    if (missing.length > 0) {
      toast.error('Completa los campos obligatorios en cada fila antes de lanzar');
      return;
    }

    try {
      // 1. Subir todas las generaciones a Meta. /api/meta/upload/bulk es
      //    idempotente por (generation_id, ad_account_id), si ya existe
      //    devuelve el upload existente.
      setPhase('uploading');
      const generationIds = Array.from(new Set(rows.map((r) => r.generationId)));
      const upRes = await fetch('/api/meta/upload/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          generationIds,
          adAccountId,
          metadata: {},
        }),
      });
      const upBody = (await upRes.json()) as BulkUploadResponse & { error?: string };
      if (!upRes.ok) throw new Error(upBody?.error || 'Falló la subida a Meta');

      // Mapear generation_id → upload_id
      const uploadByGenId = new Map<string, string>();
      for (const u of upBody.uploads) uploadByGenId.set(u.generation_id, u.id);
      const uploadIds = upBody.uploads.map((u) => u.id);

      // 2. Polling hasta que todos estén ready
      const totalUploads = uploadIds.length;
      setLaunchProgress({ ready: 0, total: totalUploads });
      for (let attempt = 0; attempt < 60; attempt++) {
        const stRes = await fetch(`/api/meta/upload/status?ids=${uploadIds.join(',')}`);
        if (!stRes.ok) throw new Error('Falló el polling de estado');
        const stBody = (await stRes.json()) as UploadStatusResponse;
        const ready = stBody.uploads.filter((u) => u.status === 'ready').length;
        const failed = stBody.uploads.filter((u) => u.status === 'failed');
        setLaunchProgress({ ready, total: totalUploads });
        if (failed.length > 0) {
          throw new Error(
            `${failed.length} asset(s) fallaron al subir: ${failed
              .map((f) => f.error_message)
              .filter(Boolean)
              .join('; ')}`,
          );
        }
        if (stBody.allDone) break;
        await new Promise((r) => setTimeout(r, 3000));
      }

      // 3. Llamar al launch
      setPhase('launching');
      const launchRows: LaunchAdRow[] = rows.map((r) => {
        const uploadId = uploadByGenId.get(r.generationId);
        if (!uploadId) throw new Error(`No se encontró upload para fila ${r.rowId}`);
        return {
          rowId: r.rowId,
          uploadId,
          metadata: r.metadata,
          campaign: r.campaign,
          adset: r.adset,
          identity: r.identity,
        };
      });
      const payload: LaunchRequest = { adAccountId, rows: launchRows };
      const lRes = await fetch('/api/meta/launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const lBody = await lRes.json();
      if (!lRes.ok) throw new Error(lBody?.error || 'No se pudo lanzar');
      const result = lBody as LaunchResponse;
      setLaunchResult(result);
      setPhase('done');
      const okCount = result.rows.filter((r) => r.adId).length;
      toast.success(`${okCount} ad(s) creados en pausa`);
    } catch (err: any) {
      setPhase('idle');
      setLaunchProgress(null);
      toast.error(err?.message || 'Falló el lanzamiento');
    }
  };

  const summary = useMemo(() => {
    const campaigns = new Set<string>();
    const adsets = new Set<string>();
    for (const r of rows) {
      if (r.campaign.id) campaigns.add(r.campaign.id);
      if (r.adset.id) adsets.add(r.adset.id);
    }
    return { campaigns, adsets };
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
    <div className="space-y-5 pb-24">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/campanas/meta"
          className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-sm text-gray-300 hover:bg-gray-800 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Volver
        </Link>
        {rows.length > 0 && phase !== 'done' && (
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs text-gray-400 hover:bg-red-500/10 hover:text-red-400"
            title="Borra todas las filas y empieza de cero"
          >
            <Trash2 className="h-3.5 w-3.5" /> Empezar de cero
          </button>
        )}
      </div>

      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Nueva campaña</h1>
          <p className="mt-0.5 text-sm text-gray-400">
            Importa assets, edítalos en grilla, asígnalos a campañas/ad sets de tu cuenta y lanza
            todo en pausa. Nada se sube a Meta hasta que pulses Lanzar.
          </p>
        </div>
        <div className="text-right text-xs text-gray-500">
          <div>
            <span className="text-white">{rows.length}</span> ads
          </div>
        </div>
      </div>

      {phase === 'done' && launchResult ? (
        <LaunchSummary
          result={launchResult}
          onReset={() => {
            setRows([]);
            setLaunchResult(null);
            setLaunchProgress(null);
            setPhase('idle');
            clearDraft();
          }}
        />
      ) : (
        <AdGridEditor
          rows={rows}
          onChange={setRows}
          adAccountId={adAccountId}
          onImportAssets={() => setPickerOpen(true)}
        />
      )}

      {phase !== 'done' && rows.length > 0 && (
        <div className="sticky bottom-0 z-20 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-800 bg-[#141414] px-4 py-3 shadow-lg">
          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
            <span>
              <span className="text-white">{summary.campaigns.size}</span> campañas
            </span>
            <span>·</span>
            <span>
              <span className="text-white">{summary.adsets.size}</span> ad sets
            </span>
            <span>·</span>
            <span>
              <span className="text-white">{rows.length}</span> ads
            </span>
            {phase === 'uploading' && launchProgress && (
              <span className="flex items-center gap-1 text-amber-400">
                <AlertTriangle className="h-3 w-3" />
                Subiendo a Meta {launchProgress.ready}/{launchProgress.total}
              </span>
            )}
            {phase === 'launching' && (
              <span className="flex items-center gap-1 text-brand-accent">
                Creando anuncios…
              </span>
            )}
          </div>
          <Button
            onClick={launch}
            disabled={phase === 'uploading' || phase === 'launching' || rows.length === 0}
          >
            <Rocket className="mr-1.5 h-4 w-4" />
            {phase === 'uploading'
              ? 'Subiendo…'
              : phase === 'launching'
                ? 'Lanzando…'
                : `Lanzar ${rows.length} ad${rows.length === 1 ? '' : 's'}`}
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
        Activa los anuncios desde Ads Manager cuando estés listo.
      </p>
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
