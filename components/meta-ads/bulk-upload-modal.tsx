'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ExternalLink, Image as ImageIcon, Video, ChevronRight } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Loading } from '@/components/ui/loading';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { UploadStatusRow } from '@/components/meta-ads/upload-status-row';
import { BulkMetadataEditor } from '@/components/meta-ads/bulk-metadata-editor';
import type {
  AccountsResponse,
  BulkUploadResponse,
  UploadStatusResponse,
  MetaAdMetadata,
} from '@/types/meta';
import type { Generation } from '@/types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  selectedGenerations: Generation[];
}

type Step = 'connectionCheck' | 'selectAccount' | 'metadata' | 'review' | 'uploading' | 'done';

const VIDEO_TYPES = new Set(['ugc', 'face_swap', 'clips', 'mejorar_calidad_video']);

export function BulkUploadModal({ isOpen, onClose, selectedGenerations }: Props) {
  const [step, setStep] = useState<Step>('connectionCheck');
  const [adAccountId, setAdAccountId] = useState<string>('');
  const [uploadIds, setUploadIds] = useState<string[]>([]);
  const [metadata, setMetadata] = useState<Record<string, MetaAdMetadata>>({});

  useEffect(() => {
    if (!isOpen) return;
    setStep('connectionCheck');
    setUploadIds([]);
    setMetadata({});
  }, [isOpen]);

  const accountsQuery = useQuery<AccountsResponse, Error & { requiresReconnect?: boolean }>({
    queryKey: ['meta-accounts'],
    queryFn: async () => {
      const res = await fetch('/api/meta/accounts');
      if (res.status === 401) {
        const body = await res.json().catch(() => ({}));
        const err = new Error(body?.error || 'Reconectar') as Error & { requiresReconnect?: boolean };
        err.requiresReconnect = true;
        throw err;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || 'No se pudieron cargar las cuentas');
      }
      return res.json();
    },
    enabled: isOpen && step === 'connectionCheck',
    retry: false,
  });

  useEffect(() => {
    if (accountsQuery.isSuccess && step === 'connectionCheck') {
      const def = accountsQuery.data.default_ad_account_id || accountsQuery.data.accounts[0]?.id || '';
      setAdAccountId(def);
      setStep('selectAccount');
    }
  }, [accountsQuery.isSuccess, accountsQuery.data, step]);

  const counts = useMemo(() => {
    let images = 0;
    let videos = 0;
    for (const g of selectedGenerations) {
      if (VIDEO_TYPES.has(g.type) || g.type.includes('video')) videos += 1;
      else images += 1;
    }
    return { images, videos };
  }, [selectedGenerations]);

  const uploadMutation = useMutation({
    mutationFn: async (): Promise<BulkUploadResponse> => {
      const res = await fetch('/api/meta/upload/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          generationIds: selectedGenerations.map((g) => g.id),
          adAccountId,
          metadata,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || 'Falló la subida');
      return body;
    },
    onSuccess: (data) => {
      setUploadIds(data.uploads.map((u) => u.id));
      setStep('uploading');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const statusQuery = useQuery<UploadStatusResponse>({
    queryKey: ['meta-upload-status', uploadIds.join(',')],
    queryFn: async () => {
      const res = await fetch(`/api/meta/upload/status?ids=${uploadIds.join(',')}`);
      if (!res.ok) throw new Error('Falló el polling');
      return res.json();
    },
    enabled: step === 'uploading' && uploadIds.length > 0,
    refetchInterval: (query) => (query.state.data?.allDone ? false : 4000),
  });

  useEffect(() => {
    if (step === 'uploading' && statusQuery.data?.allDone) {
      const success = statusQuery.data.uploads.filter((u) => u.status === 'ready').length;
      const failed = statusQuery.data.uploads.filter((u) => u.status === 'failed').length;
      if (failed === 0) {
        toast.success(`${success} asset${success === 1 ? '' : 's'} subido${success === 1 ? '' : 's'} a Meta`);
      } else {
        toast.warning(`${success} subidos · ${failed} fallidos`);
      }
      setStep('done');
    }
  }, [statusQuery.data, step]);

  const generationById = useMemo(
    () => new Map(selectedGenerations.map((g) => [g.id, g])),
    [selectedGenerations],
  );

  const renderConnectionCheck = () => {
    if (accountsQuery.isLoading) return <Loading text="Verificando conexión con Meta..." />;
    if (accountsQuery.error) {
      const requiresReconnect = (accountsQuery.error as any)?.requiresReconnect;
      return (
        <div className="space-y-4 py-4 text-center">
          <p className="text-[var(--rvz-ink-muted)]">
            {requiresReconnect
              ? 'Necesitas conectar tu cuenta de Meta antes de subir assets.'
              : `Error: ${accountsQuery.error.message}`}
          </p>
          <a
            href="/api/meta/auth/start"
            className="inline-flex items-center gap-2 rounded-md bg-[var(--rvz-accent)] px-4 py-2 text-sm font-medium text-[var(--rvz-ink)] hover:bg-[var(--rvz-accent)]/90"
          >
            <ExternalLink className="h-4 w-4" />
            Conectar con Meta
          </a>
        </div>
      );
    }
    return null;
  };

  const renderSelectAccount = () => {
    const accounts = accountsQuery.data?.accounts ?? [];
    if (accounts.length === 0) {
      return (
        <div className="space-y-3 py-4 text-center">
          <p className="text-[var(--rvz-ink-muted)]">No encontramos cuentas de anuncios en tu Meta Business.</p>
          <p className="text-xs text-[var(--rvz-ink-muted)]">
            Asegúrate de tener acceso a una ad account y de haber autorizado los permisos solicitados.
          </p>
        </div>
      );
    }
    return (
      <div className="space-y-4">
        <p className="text-sm text-[var(--rvz-ink-muted)]">
          Conectado como <span className="font-semibold text-[var(--rvz-ink)]">{accountsQuery.data?.fb_user_name}</span>.
          Elige la cuenta de anuncios destino.
        </p>
        <Select value={adAccountId} onValueChange={setAdAccountId}>
          <SelectTrigger className="border-[var(--rvz-card-border)] bg-[var(--rvz-bg)] text-[var(--rvz-ink)]">
            <SelectValue placeholder="Cuenta de anuncios" />
          </SelectTrigger>
          <SelectContent className="border-[var(--rvz-card-border)] bg-[var(--rvz-card)] text-[var(--rvz-ink)]">
            {accounts.map((acc) => (
              <SelectItem key={acc.id} value={acc.id} className="focus:bg-[var(--rvz-accent)]/20 focus:text-[var(--rvz-ink)]">
                {acc.name}
                {acc.business_name ? ` · ${acc.business_name}` : ''}
                {acc.currency ? ` · ${acc.currency}` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => setStep('metadata')} disabled={!adAccountId}>
            Continuar
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  };

  const renderMetadata = () => (
    <div className="space-y-4">
      <BulkMetadataEditor
        generations={selectedGenerations}
        metadata={metadata}
        onChange={setMetadata}
      />
      <div className="flex justify-between gap-2 border-t border-[var(--rvz-card-border)] pt-4">
        <Button variant="ghost" onClick={() => setStep('selectAccount')}>
          Atrás
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setStep('review')}>
            Saltar (subir solo media)
          </Button>
          <Button onClick={() => setStep('review')}>
            Revisar
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  const renderReview = () => {
    const accountName = accountsQuery.data?.accounts.find((a) => a.id === adAccountId)?.name || adAccountId;
    const withMeta = Object.keys(metadata).filter((id) => {
      const m = metadata[id];
      return m && (m.primary_text || m.headline || m.link_url);
    }).length;
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-[var(--rvz-card-border)] bg-black/40 p-4">
          <p className="text-sm text-[var(--rvz-ink-muted)]">Cuenta de anuncios</p>
          <p className="text-base font-semibold text-[var(--rvz-ink)]">{accountName}</p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-[var(--rvz-card-border)] bg-black/40 p-4 text-center">
            <ImageIcon className="mx-auto h-5 w-5 text-[var(--rvz-ink)]" />
            <p className="mt-1 text-2xl font-bold text-[var(--rvz-ink)]">{counts.images}</p>
            <p className="text-xs text-[var(--rvz-ink-muted)]">Imágenes</p>
          </div>
          <div className="rounded-lg border border-[var(--rvz-card-border)] bg-black/40 p-4 text-center">
            <Video className="mx-auto h-5 w-5 text-[var(--rvz-ink)]" />
            <p className="mt-1 text-2xl font-bold text-[var(--rvz-ink)]">{counts.videos}</p>
            <p className="text-xs text-[var(--rvz-ink-muted)]">Videos</p>
          </div>
          <div className="rounded-lg border border-[var(--rvz-card-border)] bg-black/40 p-4 text-center">
            <p className="mt-1 text-2xl font-bold text-emerald-400">{withMeta}</p>
            <p className="text-xs text-[var(--rvz-ink-muted)]">Con copy</p>
          </div>
        </div>
        <div className="grid max-h-64 grid-cols-4 gap-2 overflow-y-auto rounded-lg border border-[var(--rvz-card-border)] bg-black/30 p-2">
          {selectedGenerations.map((g) => (
            <div key={g.id} className="aspect-square overflow-hidden rounded-md bg-[var(--rvz-card)]">
              {g.result_url ? (
                VIDEO_TYPES.has(g.type) || g.type.includes('video') ? (
                  <video src={g.result_url} className="h-full w-full object-cover" muted />
                ) : (
                  <img src={g.result_url} alt="" className="h-full w-full object-cover" />
                )
              ) : null}
            </div>
          ))}
        </div>
        <p className="text-xs text-[var(--rvz-ink-muted)]">
          Las imágenes se suben directo a la biblioteca de medios. Los videos quedan procesándose en Meta y aparecerán como
          "Listo" cuando estén disponibles. El copy se guarda con cada asset y se reutiliza cuando creas la campaña.
        </p>
        <div className="flex justify-between gap-2">
          <Button variant="ghost" onClick={() => setStep('metadata')}>
            Atrás
          </Button>
          <Button onClick={() => uploadMutation.mutate()} disabled={uploadMutation.isPending}>
            {uploadMutation.isPending ? 'Subiendo...' : `Subir ${selectedGenerations.length} a Meta Ads`}
          </Button>
        </div>
      </div>
    );
  };

  const renderUploading = () => {
    const rows = statusQuery.data?.uploads || [];
    return (
      <div className="space-y-3">
        <p className="text-sm text-[var(--rvz-ink-muted)]">
          Procesando {rows.length} asset{rows.length === 1 ? '' : 's'} en Meta. Puedes cerrar esta ventana — el progreso se
          guarda en la sección Meta Ads.
        </p>
        <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
          {rows.length === 0 && <Loading text="Iniciando..." />}
          {rows.map((row) => {
            const gen = generationById.get(row.generation_id);
            return (
              <UploadStatusRow
                key={row.id}
                upload={row}
                thumbnailUrl={gen?.result_url}
                label={gen?.type.replace(/_/g, ' ')}
              />
            );
          })}
        </div>
      </div>
    );
  };

  const renderDone = () => {
    const rows = statusQuery.data?.uploads || [];
    const success = rows.filter((r) => r.status === 'ready').length;
    const failed = rows.filter((r) => r.status === 'failed').length;
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-[var(--rvz-card-border)] bg-black/40 p-4 text-center">
          <p className="text-sm text-[var(--rvz-ink-muted)]">Resultado</p>
          <p className="mt-1 text-lg font-semibold text-[var(--rvz-ink)]">
            {success} listos · {failed} con error
          </p>
        </div>
        <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
          {rows.map((row) => {
            const gen = generationById.get(row.generation_id);
            return (
              <UploadStatusRow
                key={row.id}
                upload={row}
                thumbnailUrl={gen?.result_url}
                label={gen?.type.replace(/_/g, ' ')}
              />
            );
          })}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => (window.location.href = '/campanas/meta/crear')}>
            Crear campaña con esto
          </Button>
          <Button onClick={onClose}>Cerrar</Button>
        </div>
      </div>
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={
      step === 'metadata' ? 'Editar copy en bulk' : 'Subir a Meta Ads'
    } className={step === 'metadata' ? 'max-w-5xl' : undefined}>
      {step === 'connectionCheck' && renderConnectionCheck()}
      {step === 'selectAccount' && renderSelectAccount()}
      {step === 'metadata' && renderMetadata()}
      {step === 'review' && renderReview()}
      {step === 'uploading' && renderUploading()}
      {step === 'done' && renderDone()}
    </Modal>
  );
}
