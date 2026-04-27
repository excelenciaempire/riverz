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
import type {
  AccountsResponse,
  BulkUploadResponse,
  UploadStatusResponse,
} from '@/types/meta';
import type { Generation } from '@/types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  selectedGenerations: Generation[];
}

type Step = 'connectionCheck' | 'selectAccount' | 'review' | 'uploading' | 'done';

const VIDEO_TYPES = new Set(['ugc', 'face_swap', 'clips', 'mejorar_calidad_video']);

export function BulkUploadModal({ isOpen, onClose, selectedGenerations }: Props) {
  const [step, setStep] = useState<Step>('connectionCheck');
  const [adAccountId, setAdAccountId] = useState<string>('');
  const [uploadIds, setUploadIds] = useState<string[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    setStep('connectionCheck');
    setUploadIds([]);
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
          <p className="text-gray-300">
            {requiresReconnect
              ? 'Necesitas conectar tu cuenta de Meta antes de subir assets.'
              : `Error: ${accountsQuery.error.message}`}
          </p>
          <a
            href="/api/meta/auth/start"
            className="inline-flex items-center gap-2 rounded-md bg-brand-accent px-4 py-2 text-sm font-medium text-white hover:bg-brand-accent/90"
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
          <p className="text-gray-300">No encontramos cuentas de anuncios en tu Meta Business.</p>
          <p className="text-xs text-gray-500">
            Asegúrate de tener acceso a una ad account y de haber autorizado los permisos `ads_management` y `business_management`.
          </p>
        </div>
      );
    }
    return (
      <div className="space-y-4">
        <p className="text-sm text-gray-300">
          Conectado como <span className="font-semibold text-white">{accountsQuery.data?.fb_user_name}</span>.
          Elige la cuenta de anuncios destino.
        </p>
        <Select value={adAccountId} onValueChange={setAdAccountId}>
          <SelectTrigger className="border-gray-700 bg-[#0a0a0a] text-white">
            <SelectValue placeholder="Cuenta de anuncios" />
          </SelectTrigger>
          <SelectContent className="border-gray-800 bg-[#141414] text-white">
            {accounts.map((acc) => (
              <SelectItem key={acc.id} value={acc.id} className="focus:bg-brand-accent/20 focus:text-white">
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
          <Button onClick={() => setStep('review')} disabled={!adAccountId}>
            Continuar
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  };

  const renderReview = () => {
    const accountName = accountsQuery.data?.accounts.find((a) => a.id === adAccountId)?.name || adAccountId;
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-gray-800 bg-black/40 p-4">
          <p className="text-sm text-gray-400">Cuenta de anuncios</p>
          <p className="text-base font-semibold text-white">{accountName}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-gray-800 bg-black/40 p-4 text-center">
            <ImageIcon className="mx-auto h-5 w-5 text-brand-accent" />
            <p className="mt-1 text-2xl font-bold text-white">{counts.images}</p>
            <p className="text-xs text-gray-400">Imágenes</p>
          </div>
          <div className="rounded-lg border border-gray-800 bg-black/40 p-4 text-center">
            <Video className="mx-auto h-5 w-5 text-brand-accent" />
            <p className="mt-1 text-2xl font-bold text-white">{counts.videos}</p>
            <p className="text-xs text-gray-400">Videos</p>
          </div>
        </div>
        <div className="grid max-h-64 grid-cols-4 gap-2 overflow-y-auto rounded-lg border border-gray-800 bg-black/30 p-2">
          {selectedGenerations.map((g) => (
            <div key={g.id} className="aspect-square overflow-hidden rounded-md bg-gray-900">
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
        <p className="text-xs text-gray-500">
          Las imágenes se suben directo a la biblioteca de medios. Los videos quedan procesándose en Meta y aparecerán como
          "Listo" cuando estén disponibles.
        </p>
        <div className="flex justify-between gap-2">
          <Button variant="ghost" onClick={() => setStep('selectAccount')}>
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
        <p className="text-sm text-gray-300">
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
        <div className="rounded-lg border border-gray-800 bg-black/40 p-4 text-center">
          <p className="text-sm text-gray-400">Resultado</p>
          <p className="mt-1 text-lg font-semibold text-white">
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
        <div className="flex justify-end">
          <Button onClick={onClose}>Cerrar</Button>
        </div>
      </div>
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Subir a Meta Ads">
      {step === 'connectionCheck' && renderConnectionCheck()}
      {step === 'selectAccount' && renderSelectAccount()}
      {step === 'review' && renderReview()}
      {step === 'uploading' && renderUploading()}
      {step === 'done' && renderDone()}
    </Modal>
  );
}
