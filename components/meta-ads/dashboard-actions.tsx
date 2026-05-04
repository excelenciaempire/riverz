'use client';

import Link from 'next/link';
import { Plus, Eye, Sparkles, BarChart3, Atom } from 'lucide-react';
import type { AccountsResponse } from '@/types/meta';

interface Props {
  accounts: AccountsResponse;
  totalUploads: number;
}

export function DashboardActions({ accounts, totalUploads }: Props) {
  const ready = !!accounts.default_ad_account_id && !!accounts.default_page_id;
  const adAccountQs = accounts.default_ad_account_id
    ? `?adAccountId=${encodeURIComponent(accounts.default_ad_account_id)}`
    : '';

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Link
        href={`/campanas/meta/anuncios${adAccountQs}`}
        className={`group relative overflow-hidden rounded-2xl border bg-gradient-to-br from-[#161616] via-[#141414] to-[#0d0d0d] p-6 transition ${
          ready ? 'border-[var(--rvz-card-border)] hover:border-[var(--rvz-ink)]' : 'border-[var(--rvz-card-border)] opacity-60'
        }`}
      >
        <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-[var(--rvz-accent)]/10 blur-3xl transition group-hover:bg-[var(--rvz-accent)]/20" />
        <div className="relative">
          <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--rvz-accent)]/20 text-[var(--rvz-ink)]">
            <Eye className="h-5 w-5" />
          </div>
          <h3 className="text-lg font-semibold text-[var(--rvz-ink)]">Ver mis anuncios</h3>
          <p className="mt-1 text-sm text-[var(--rvz-ink-muted)]">
            Reproduce videos, lee copys, transcribe y marca winners para alimentar tu IA.
          </p>
          <div className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--rvz-ink)]">
            <BarChart3 className="h-3.5 w-3.5" />
            Spend, CTR, ROAS por anuncio
          </div>
        </div>
      </Link>

      <Link
        href={`/campanas/meta/crear${adAccountQs}`}
        className={`group relative overflow-hidden rounded-2xl border bg-gradient-to-br from-[#161616] via-[#141414] to-[#0d0d0d] p-6 transition ${
          ready ? 'border-[var(--rvz-card-border)] hover:border-[var(--rvz-ink)]' : 'border-[var(--rvz-card-border)] opacity-60 pointer-events-none'
        }`}
      >
        <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-emerald-500/10 blur-3xl transition group-hover:bg-emerald-500/20" />
        <div className="relative">
          <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
            <Plus className="h-5 w-5" />
          </div>
          <h3 className="text-lg font-semibold text-[var(--rvz-ink)]">Crear nueva campaña</h3>
          <p className="mt-1 text-sm text-[var(--rvz-ink-muted)]">
            Selecciona assets de tu historial, edita en bulk al estilo Kitchn y lanza la campaña en pausa.
          </p>
          <div className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400">
            <Sparkles className="h-3.5 w-3.5" />
            {totalUploads > 0 ? `${totalUploads} assets disponibles` : 'Sube assets desde Historial'}
          </div>
        </div>
      </Link>

      <Link
        href={`/campanas/meta/dna${adAccountQs}`}
        className={`group relative overflow-hidden rounded-2xl border bg-gradient-to-br from-[#161616] via-[#141414] to-[#0d0d0d] p-6 transition ${
          ready ? 'border-[var(--rvz-card-border)] hover:border-[var(--rvz-ink)]' : 'border-[var(--rvz-card-border)] opacity-60 pointer-events-none'
        }`}
      >
        <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-violet-500/10 blur-3xl transition group-hover:bg-violet-500/20" />
        <div className="relative">
          <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/20 text-violet-300">
            <Atom className="h-5 w-5" />
          </div>
          <h3 className="text-lg font-semibold text-[var(--rvz-ink)]">Winner DNA Lab</h3>
          <p className="mt-1 text-sm text-[var(--rvz-ink-muted)]">
            Patrones extraídos de tus winners vs los que no funcionan + brief listo para tu próximo creativo.
          </p>
          <div className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-violet-300">
            <Sparkles className="h-3.5 w-3.5" />
            Aprende de tu propia data
          </div>
        </div>
      </Link>
    </div>
  );
}
