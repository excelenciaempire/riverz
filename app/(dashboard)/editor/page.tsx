'use client';

import Link from 'next/link';
import { FileEdit, Plus } from 'lucide-react';

export default function EditorPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-[var(--rvz-ink)]">Editor</h1>
        <p className="mt-2 text-[var(--rvz-ink-muted)]">
          Edita y mejora tu contenido generado
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-6 md:grid-cols-2">
        <Link
          href="/historial"
          className="group rounded-lg border border-[var(--rvz-card-border)] bg-[var(--rvz-card)] p-8 transition-all hover:border-[var(--rvz-ink)] hover:shadow-lg hover:shadow-brand-accent/20"
        >
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-[var(--rvz-card)] group-hover:bg-[var(--rvz-accent)]/20">
            <FileEdit className="h-8 w-8 text-[var(--rvz-ink)]" />
          </div>
          <h3 className="mb-2 text-xl font-semibold text-[var(--rvz-ink)]">
            Editar desde Historial
          </h3>
          <p className="text-sm text-[var(--rvz-ink-muted)]">
            Selecciona contenido previamente generado para editar
          </p>
        </Link>

        <Link
          href="/crear/editar-foto"
          className="group rounded-lg border border-[var(--rvz-card-border)] bg-[var(--rvz-card)] p-8 transition-all hover:border-[var(--rvz-ink)] hover:shadow-lg hover:shadow-brand-accent/20"
        >
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-[var(--rvz-card)] group-hover:bg-[var(--rvz-accent)]/20">
            <Plus className="h-8 w-8 text-[var(--rvz-ink)]" />
          </div>
          <h3 className="mb-2 text-xl font-semibold text-[var(--rvz-ink)]">
            Nueva Edición
          </h3>
          <p className="text-sm text-[var(--rvz-ink-muted)]">
            Comienza una nueva edición desde cero
          </p>
        </Link>
      </div>

      {/* Recent Edits */}
      <div className="rounded-lg border border-[var(--rvz-card-border)] bg-[var(--rvz-card)] p-6">
        <h2 className="mb-4 text-xl font-semibold text-[var(--rvz-ink)]">
          Ediciones Recientes
        </h2>
        <div className="text-center py-12">
          <p className="text-[var(--rvz-ink-muted)]">
            Tus ediciones recientes aparecerán aquí
          </p>
          <Link
            href="/historial"
            className="mt-4 inline-block text-[var(--rvz-ink)] hover:underline"
          >
            Ver todo el historial →
          </Link>
        </div>
      </div>
    </div>
  );
}

