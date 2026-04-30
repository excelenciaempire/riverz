'use client';

import { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Sparkles,
  Trophy,
  ThumbsDown,
  Loader2,
  Copy,
  RefreshCcw,
} from 'lucide-react';
import { Loading } from '@/components/ui/loading';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { AccountsResponse, MetaBrandDna, MetaDnaPatterns } from '@/types/meta';

function DnaContent() {
  const queryClient = useQueryClient();
  const [adAccountId, setAdAccountId] = useState<string>('');

  const accountsQuery = useQuery<AccountsResponse>({
    queryKey: ['meta-accounts'],
    queryFn: async () => {
      const res = await fetch('/api/meta/accounts');
      if (!res.ok) throw new Error('Reconectar Meta');
      return res.json();
    },
    retry: false,
  });

  // Sync with default ad account when accounts load.
  if (!adAccountId && accountsQuery.data?.default_ad_account_id) {
    setAdAccountId(accountsQuery.data.default_ad_account_id);
  }

  const dnaQuery = useQuery<{ dna: MetaBrandDna | null }>({
    queryKey: ['meta-dna', adAccountId],
    queryFn: async () => {
      const r = await fetch(`/api/meta/dna?adAccountId=${encodeURIComponent(adAccountId)}`);
      if (!r.ok) throw new Error('No se pudo cargar DNA');
      return r.json();
    },
    enabled: !!adAccountId,
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/meta/dna?adAccountId=${encodeURIComponent(adAccountId)}`, {
        method: 'POST',
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body?.error || 'Falló la generación');
      return body.dna as MetaBrandDna;
    },
    onSuccess: () => {
      toast.success('DNA actualizado');
      queryClient.invalidateQueries({ queryKey: ['meta-dna', adAccountId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const dna = dnaQuery.data?.dna ?? null;
  const isGenerating = generateMutation.isPending;
  const generatedAtAge = useMemo(() => {
    if (!dna?.generated_at) return null;
    const ms = Date.now() - new Date(dna.generated_at).getTime();
    const h = Math.round(ms / (1000 * 60 * 60));
    if (h < 1) return 'hace minutos';
    if (h < 24) return `hace ${h} h`;
    return `hace ${Math.round(h / 24)} días`;
  }, [dna?.generated_at]);

  return (
    <div className="space-y-5 pb-12">
      <div className="flex items-center gap-3">
        <Link
          href="/campanas/meta"
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Volver a Meta Ads
        </Link>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
            <Sparkles className="h-6 w-6 text-brand-accent" />
            Winner DNA Lab
          </h1>
          <p className="mt-0.5 text-sm text-gray-400">
            Patrones extraídos de tus anuncios marcados. La IA compara qué tienen los winners vs los que no
            funcionan y arma un brief para tu próximo creativo.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          {accountsQuery.data && accountsQuery.data.accounts.length > 1 && (
            <div className="min-w-[180px]">
              <div className="mb-1 text-[10px] uppercase tracking-wide text-gray-500">Cuenta</div>
              <Select value={adAccountId} onValueChange={setAdAccountId}>
                <SelectTrigger className="border-gray-700 bg-[#0a0a0a] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-gray-800 bg-[#141414] text-white">
                  {accountsQuery.data.accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id} className="focus:bg-brand-accent/20 focus:text-white">
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <button
            onClick={() => generateMutation.mutate()}
            disabled={!adAccountId || isGenerating}
            className="inline-flex items-center gap-1.5 rounded-md bg-brand-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : dna ? (
              <RefreshCcw className="h-4 w-4" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {isGenerating ? 'Generando…' : dna ? 'Regenerar DNA' : 'Generar DNA'}
          </button>
        </div>
      </div>

      {!adAccountId ? (
        <div className="rounded-xl border border-gray-800 bg-[#141414] p-8 text-center">
          <p className="text-gray-400">Configura tu cuenta publicitaria primero.</p>
          <Link
            href="/campanas/meta"
            className="mt-3 inline-flex items-center gap-1.5 text-sm text-brand-accent hover:underline"
          >
            Ir a configuración
          </Link>
        </div>
      ) : dnaQuery.isLoading ? (
        <Loading text="Cargando DNA..." />
      ) : !dna ? (
        <EmptyState />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
            <Counter label="Winners" value={dna.winner_count} icon={<Trophy className="h-3 w-3 text-amber-400" />} />
            <Counter
              label="No funcionan"
              value={dna.loser_count}
              icon={<ThumbsDown className="h-3 w-3 text-red-400" />}
            />
            <Counter label="Sin marcar" value={dna.unmarked_count} icon={<span className="h-2 w-2 rounded-full bg-gray-500" />} />
            {generatedAtAge && <span className="ml-auto">Generado {generatedAtAge}</span>}
          </div>

          {/* Brief — la pieza de salida más accionable, va arriba */}
          <BriefCard brief={dna.brief} />

          <div className="grid gap-3 lg:grid-cols-2">
            <PatternCard
              title="Winner Patterns"
              accent="amber"
              icon={<Trophy className="h-4 w-4 text-amber-400" />}
              patterns={dna.dna_data?.winner_patterns}
            />
            <PatternCard
              title="Loser Patterns"
              accent="red"
              icon={<ThumbsDown className="h-4 w-4 text-red-400" />}
              patterns={dna.dna_data?.loser_patterns}
            />
          </div>

          {dna.dna_data?.comparison && (
            <div className="rounded-xl border border-gray-800 bg-[#141414] p-5">
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-400">
                Comparación
              </h3>
              <p className="text-sm leading-relaxed text-white">{dna.dna_data.comparison}</p>
            </div>
          )}

          {dna.dna_data?.comments_themes && dna.dna_data.comments_themes.length > 0 && (
            <div className="rounded-xl border border-gray-800 bg-[#141414] p-5">
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-400">
                Temas en comentarios
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {dna.dna_data.comments_themes.map((t, i) => (
                  <span
                    key={i}
                    className="inline-block rounded border border-gray-700 bg-black/40 px-2 py-1 text-xs text-gray-300"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Counter({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded border border-gray-800 bg-black/30 px-2 py-1">
      {icon}
      <span className="font-medium text-white">{value}</span>
      <span className="text-gray-500">{label}</span>
    </span>
  );
}

function BriefCard({ brief }: { brief: string | null }) {
  if (!brief) return null;
  return (
    <div className="relative overflow-hidden rounded-xl border border-brand-accent/40 bg-gradient-to-br from-brand-accent/10 via-black/40 to-emerald-500/10 p-5">
      <div className="mb-2 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-brand-accent" />
        <h3 className="text-sm font-semibold uppercase tracking-wide text-white">
          Brief para tu próximo anuncio
        </h3>
        <button
          onClick={() => {
            navigator.clipboard.writeText(brief);
            toast.success('Brief copiado');
          }}
          className="ml-auto inline-flex items-center gap-1 rounded p-1 text-gray-400 hover:bg-gray-800 hover:text-white"
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
      </div>
      <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-white">{brief}</pre>
    </div>
  );
}

function PatternCard({
  title,
  accent,
  icon,
  patterns,
}: {
  title: string;
  accent: 'amber' | 'red';
  icon: React.ReactNode;
  patterns: MetaDnaPatterns | null | undefined;
}) {
  const border = accent === 'amber' ? 'border-amber-500/30' : 'border-red-500/30';
  return (
    <div className={`rounded-xl border bg-[#141414] p-5 ${border}`}>
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <h3 className="text-sm font-semibold uppercase tracking-wide text-white">{title}</h3>
      </div>
      {!patterns ? (
        <p className="text-xs text-gray-500">No disponible.</p>
      ) : (
        <div className="space-y-3 text-sm">
          <Bucket label="Hooks" items={patterns.hooks} />
          <Bucket label="Ángulos" items={patterns.angles} />
          <Bucket label="CTAs" items={patterns.ctas} />
          <Bucket label="Frases comunes" items={patterns.common_phrases} />
          {patterns.lengths && (patterns.lengths.median_seconds || patterns.lengths.range) && (
            <p className="text-xs text-gray-400">
              Duración:{' '}
              <span className="font-medium text-white">
                {patterns.lengths.median_seconds ? `${patterns.lengths.median_seconds}s mediana` : '—'}
                {patterns.lengths.range
                  ? ` · rango ${patterns.lengths.range[0]}–${patterns.lengths.range[1]}s`
                  : ''}
              </span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Bucket({ label, items }: { label: string; items?: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <p className="mb-1 text-[10px] uppercase tracking-wide text-gray-500">{label}</p>
      <ul className="list-disc space-y-0.5 pl-4 text-sm text-white">
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-gray-800 bg-[#141414] p-10 text-center">
      <Sparkles className="mx-auto h-10 w-10 text-brand-accent" />
      <h3 className="mt-3 text-lg font-semibold text-white">Aún no generaste el DNA de esta marca</h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-gray-400">
        Asegúrate de que los anuncios estén transcritos (botón "Transcribir N pendientes" en /anuncios) y de
        haber marcado al menos algunos como winner / no funciona. Después aprieta "Generar DNA".
      </p>
    </div>
  );
}

export default function DnaPage() {
  return (
    <Suspense fallback={<Loading />}>
      <DnaContent />
    </Suspense>
  );
}
