'use client';

import Link from 'next/link';
import { FileEdit, Plus } from 'lucide-react';

export default function EditorPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Editor</h1>
        <p className="mt-2 text-gray-400">
          Edita y mejora tu contenido generado
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-6 md:grid-cols-2">
        <Link
          href="/historial"
          className="group rounded-lg border border-gray-700 bg-brand-dark-secondary p-8 transition-all hover:border-brand-accent hover:shadow-lg hover:shadow-brand-accent/20"
        >
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-gray-800 group-hover:bg-brand-accent/20">
            <FileEdit className="h-8 w-8 text-brand-accent" />
          </div>
          <h3 className="mb-2 text-xl font-semibold text-white">
            Editar desde Historial
          </h3>
          <p className="text-sm text-gray-400">
            Selecciona contenido previamente generado para editar
          </p>
        </Link>

        <Link
          href="/crear/editar-foto"
          className="group rounded-lg border border-gray-700 bg-brand-dark-secondary p-8 transition-all hover:border-brand-accent hover:shadow-lg hover:shadow-brand-accent/20"
        >
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-gray-800 group-hover:bg-brand-accent/20">
            <Plus className="h-8 w-8 text-brand-accent" />
          </div>
          <h3 className="mb-2 text-xl font-semibold text-white">
            Nueva Edición
          </h3>
          <p className="text-sm text-gray-400">
            Comienza una nueva edición desde cero
          </p>
        </Link>
      </div>

      {/* Recent Edits */}
      <div className="rounded-lg border border-gray-700 bg-brand-dark-secondary p-6">
        <h2 className="mb-4 text-xl font-semibold text-white">
          Ediciones Recientes
        </h2>
        <div className="text-center py-12">
          <p className="text-gray-400">
            Tus ediciones recientes aparecerán aquí
          </p>
          <Link
            href="/historial"
            className="mt-4 inline-block text-brand-accent hover:underline"
          >
            Ver todo el historial →
          </Link>
        </div>
      </div>
    </div>
  );
}

