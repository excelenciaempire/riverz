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
  History,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Loading } from '@/components/ui/loading';
import {
  AdGridEditor,
  makeEmptyRow,
  type AdGridRow,
} from '@/components/meta-ads/ad-grid-editor';
import { AssetPickerModal } from '@/components/meta-ads/asset-picker-modal';
import { CreativeDefaultsPanel } from '@/components/meta-ads/creative-defaults-panel';
import type { Generation } from '@/types';
import type {
  AccountsResponse,
  AdDraft,
  BulkUploadResponse,
  LaunchAdRow,
  LaunchRequest,
  LaunchResponse,
  MetaAiFeatures,
  UploadStatusResponse,
} from '@/types/meta';
import { cn } from '@/lib/utils';

type Phase = 'idle' | 'uploading' | 'launching' | 'done';

const DRAFT_KEY = 'rvz_meta_crear_draft';
const DRAFT_TTL_MS = 60_000;
const CREATIVE_DEFAULTS_KEY = 'rvz_meta_creative_defaults';

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
    /* ignore */
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

function loadCreativeDefaults(): MetaAiFeatures {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(CREATIVE_DEFAULTS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as MetaAiFeatures;
  } catch {
    return {};
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
  const [creativeDefaults, setCreativeDefaults] = useState<MetaAiFeatures>({});
  const [recentOpen, setRecentOpen] = useState<string | null>(null);
  const draftRestoredRef = useRef(false);

  // Restaurar draft + defaults al montar
  useEffect(() => {
    if (draftRestoredRef.current) return;
    const draft = loadDraft();
    if (draft && draft.length > 0) {
      setRows(draft);
      toast.info(`Restauramos tu draft (${draft.length} ad${draft.length === 1 ? '' : 's'})`);
    }
    setCreativeDefaults(loadCreativeDefaults());
    draftRestoredRef.current = true;
  }, []);

  useEffect(() => {
    if (!draftRestoredRef.current) return;
    const t = setTimeout(() => saveDraft(rows), 800);
    return () => clearTimeout(t);
  }, [rows]);

  useEffect(() => {
    if (!draftRestoredRef.current) return;
    try {
      localStorage.setItem(CREATIVE_DEFAULTS_KEY, JSON.stringify(creativeDefaults));
    } catch {
      /* ignore */
    }
  }, [creativeDefaults]);

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

  // Subidas recientes (status='launched')
  const recentQuery = useQuery<{ drafts: AdDraft[] }>({
    queryKey: ['meta-recent-launches', adAccountId],
    queryFn: async () => {
      const res = await fetch(`/api/meta/drafts?adAccountId=${adAccountId}`);
      if (!res.ok) throw new Error('No se pudieron cargar subidas recientes');
      return res.json();
    },
    enabled: !!adAccountId,
    staleTime: 30_000,
  });

  const recentLaunches = useMemo(
    () => (recentQuery.data?.drafts || []).filter((d) => d.status === 'launched'),
    [recentQuery.data],
  );

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
      `¿Empezar de cero? Vas a perder los ${rows.length} anuncio${rows.length === 1 ? '' : 's'} de la grilla.`,
    );
    if (!ok) return;
    setRows([]);
    setLaunchResult(null);
    setPhase('idle');
    clearDraft();
  };

  const persistLaunchAsDraft = async (launchedRows: AdGridRow[], result: LaunchResponse) => {
    try {
      const stamp = new Date().toLocaleString('es', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
      await fetch('/api/meta/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Subida ${stamp}`,
          ad_account_id: adAccountId,
          rows: launchedRows.map((r) => ({
            rowId: r.rowId,
            generationId: r.generationId,
            metadata: r.metadata,
            campaign: r.campaign,
            adset: r.adset,
            identity: r.identity,
            // Adjuntos UI para poder re-renderizar la grilla read-only
            __resultUrl: r.resultUrl,
            __generationType: r.generationType,
          })),
        }),
      }).then(async (res) => {
        if (!res.ok) return;
        const body = await res.json();
        const id = body?.draft?.id;
        if (!id) return;
        // Inmediatamente PATCH para marcar como launched + adjuntar result
        await fetch(`/api/meta/drafts/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'launched',
            launched_at: new Date().toISOString(),
            result,
          }),
        });
      });
      recentQuery.refetch();
    } catch (err) {
      console.error('[crear] persist launch failed', err);
    }
  };

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
    const missing: string[] = [];
    for (const r of rows) {
      if (!r.metadata.link_url) missing.push('URL destino');
      if (!r.campaign.id) missing.push('campaña');
      if (!r.adset.id) missing.push('conjunto');
      if (!r.metadata.headline && !(r.metadata.headlines && r.metadata.headlines.length))
        missing.push('título');
    }
    if (missing.length > 0) {
      toast.error('Completa los campos obligatorios en cada fila antes de lanzar');
      return;
    }

    try {
      setPhase('uploading');
      const generationIds = Array.from(new Set(rows.map((r) => r.generationId)));
      const upRes = await fetch('/api/meta/upload/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ generationIds, adAccountId, metadata: {} }),
      });
      const upBody = (await upRes.json()) as BulkUploadResponse & { error?: string };
      if (!upRes.ok) throw new Error(upBody?.error || 'Falló la subida a Meta');

      const uploadByGenId = new Map<string, string>();
      for (const u of upBody.uploads) uploadByGenId.set(u.generation_id, u.id);
      const uploadIds = upBody.uploads.map((u) => u.id);

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
      const payload: LaunchRequest = {
        adAccountId,
        rows: launchRows,
        creativeDefaults,
      };
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
      toast.success(`${okCount} anuncio${okCount === 1 ? '' : 's'} creado${okCount === 1 ? '' : 's'} en pausa`);
      // Guardar subida para historial read-only
      persistLaunchAsDraft(rows, result);
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
        <Link href="/campanas/meta" className="text-sm text-[var(--rvz-ink)] hover:underline">
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
          className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-sm text-[var(--rvz-ink-muted)] hover:bg-[var(--rvz-card)] hover:text-[var(--rvz-ink)]"
        >
          <ArrowLeft className="h-4 w-4" /> Volver
        </Link>
        {rows.length > 0 && phase !== 'done' && (
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs text-[var(--rvz-ink-muted)] hover:bg-red-500/10 hover:text-red-400"
            title="Borra todas las filas y empieza de cero"
          >
            <Trash2 className="h-3.5 w-3.5" /> Empezar de cero
          </button>
        )}
      </div>

      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--rvz-ink)]">Nueva campaña</h1>
          <p className="mt-0.5 text-sm text-[var(--rvz-ink-muted)]">
            Importa assets, edítalos en grilla, asígnalos a campañas/conjuntos de tu cuenta y
            lanza todo en pausa. Nada se sube a Meta hasta que pulses Lanzar.
          </p>
        </div>
        <div className="text-right text-xs text-[var(--rvz-ink-muted)]">
          <div>
            <span className="text-[var(--rvz-ink)]">{rows.length}</span> anuncios
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
        <>
          <CreativeDefaultsPanel value={creativeDefaults} onChange={setCreativeDefaults} />
          <AdGridEditor
            rows={rows}
            onChange={setRows}
            adAccountId={adAccountId}
            onImportAssets={() => setPickerOpen(true)}
          />
        </>
      )}

      {phase !== 'done' && rows.length > 0 && (
        <div className="sticky bottom-0 z-20 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--rvz-card-border)] bg-[var(--rvz-card)] px-4 py-3 shadow-lg">
          <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--rvz-ink-muted)]">
            <span>
              <span className="text-[var(--rvz-ink)]">{summary.campaigns.size}</span> campañas
            </span>
            <span>·</span>
            <span>
              <span className="text-[var(--rvz-ink)]">{summary.adsets.size}</span> conjuntos
            </span>
            <span>·</span>
            <span>
              <span className="text-[var(--rvz-ink)]">{rows.length}</span> anuncios
            </span>
            {phase === 'uploading' && launchProgress && (
              <span className="flex items-center gap-1 text-amber-400">
                <AlertTriangle className="h-3 w-3" />
                Subiendo a Meta {launchProgress.ready}/{launchProgress.total}
              </span>
            )}
            {phase === 'launching' && (
              <span className="flex items-center gap-1 text-[var(--rvz-ink)]">
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
                : `Lanzar ${rows.length} anuncio${rows.length === 1 ? '' : 's'}`}
          </Button>
        </div>
      )}

      {recentLaunches.length > 0 && (
        <RecentLaunches
          launches={recentLaunches}
          adAccountId={adAccountId}
          openId={recentOpen}
          onOpen={setRecentOpen}
        />
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

// ---------------------------------------------------------------------------
// Subidas recientes
// ---------------------------------------------------------------------------

function RecentLaunches({
  launches,
  adAccountId,
  openId,
  onOpen,
}: {
  launches: AdDraft[];
  adAccountId: string;
  openId: string | null;
  onOpen: (id: string | null) => void;
}) {
  return (
    <section className="space-y-3 pt-6">
      <div className="flex items-center gap-2 border-b border-[var(--rvz-card-border)] pb-2">
        <History className="h-4 w-4 text-[var(--rvz-ink-muted)]" />
        <h2 className="text-sm font-semibold text-[var(--rvz-ink)]">Subidas recientes</h2>
        <span className="text-xs text-[var(--rvz-ink-muted)]">
          ({launches.length} subida{launches.length === 1 ? '' : 's'})
        </span>
      </div>

      <div className="space-y-2">
        {launches.map((l) => {
          const isOpen = openId === l.id;
          const okCount = (l.result?.rows || []).filter((r) => r.adId).length;
          const errCount = (l.result?.rows || []).filter((r) => r.error).length;
          const total = l.rows?.length || 0;
          return (
            <div key={l.id} className="rounded-lg border border-[var(--rvz-card-border)] bg-[var(--rvz-bg)]">
              <button
                onClick={() => onOpen(isOpen ? null : l.id)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
              >
                <div className="flex items-center gap-3">
                  <ChevronRight
                    className={cn(
                      'h-4 w-4 text-[var(--rvz-ink-muted)] transition-transform',
                      isOpen && 'rotate-90',
                    )}
                  />
                  <div>
                    <p className="text-sm text-[var(--rvz-ink)]">{l.name}</p>
                    <p className="text-[11px] text-[var(--rvz-ink-muted)]">
                      {l.launched_at
                        ? new Date(l.launched_at).toLocaleString('es', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="rounded-full border border-emerald-500/30 bg-emerald-500/5 px-2 py-0.5 text-emerald-300">
                    {okCount}/{total} ok
                  </span>
                  {errCount > 0 && (
                    <span className="rounded-full border border-red-500/30 bg-red-500/5 px-2 py-0.5 text-red-300">
                      {errCount} con error
                    </span>
                  )}
                  <span className="rounded-full border border-[var(--rvz-card-border)] bg-[var(--rvz-card)]/40 px-2 py-0.5 text-[var(--rvz-ink-muted)]">
                    Solo lectura
                  </span>
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-[var(--rvz-card-border)] p-3">
                  <AdGridEditor
                    rows={(l.rows as any[]).map((r) => ({
                      rowId: r.rowId,
                      generationId: r.generationId,
                      metadata: r.metadata || {},
                      campaign: r.campaign || { id: '' },
                      adset: r.adset || { id: '' },
                      identity: r.identity,
                      resultUrl: r.__resultUrl,
                      generationType: r.__generationType,
                    }))}
                    onChange={() => {
                      /* no-op en read-only */
                    }}
                    adAccountId={adAccountId}
                    onImportAssets={() => {
                      /* no-op en read-only */
                    }}
                    readOnly
                  />
                  {l.result && l.result.rows && (
                    <div className="mt-3 grid gap-2 text-xs md:grid-cols-2">
                      {l.result.rows.map((r) => (
                        <div
                          key={r.rowId}
                          className={cn(
                            'rounded border px-3 py-2',
                            r.adId
                              ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-300'
                              : 'border-red-500/30 bg-red-500/5 text-red-300',
                          )}
                        >
                          <span className="font-mono text-[10px] text-[var(--rvz-ink-muted)]">
                            {r.rowId.slice(-6)}
                          </span>{' '}
                          {r.adId ? (
                            <>
                              ✓ Ad creado{' '}
                              <span className="font-mono text-[10px] text-[var(--rvz-ink-muted)]">
                                {r.adId}
                              </span>
                            </>
                          ) : (
                            <>✗ {r.error}</>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
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
    <div className="space-y-4 rounded-xl border border-[var(--rvz-card-border)] bg-[var(--rvz-card)] p-6">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-5 w-5 text-emerald-400" />
        <h2 className="text-lg font-semibold text-[var(--rvz-ink)]">
          {okRows.length} anuncio{okRows.length === 1 ? '' : 's'} creado
          {okRows.length === 1 ? '' : 's'} en pausa
        </h2>
      </div>
      <p className="text-sm text-[var(--rvz-ink-muted)]">
        Activa los anuncios desde Ads Manager cuando estés listo. La subida quedó guardada en
        "Subidas recientes" abajo.
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
