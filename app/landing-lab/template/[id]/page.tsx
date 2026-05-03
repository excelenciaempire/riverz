'use client';

import { useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  LANDING_TEMPLATES,
  type LandingTemplateKind,
} from '@/lib/landing-templates/registry';
import { SideNav } from '../../_side-nav';

const KIND_LABEL: Record<LandingTemplateKind, string> = {
  landing_page: 'Landing page',
  product_page: 'Product page',
  listicle: 'Listicle',
  advertorial: 'Advertorial',
};

export default function TemplatePreviewPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id || '';

  const template = useMemo(
    () => LANDING_TEMPLATES.find((t) => t.id === id),
    [id],
  );

  if (!template) {
    return (
      <div className="fixed inset-0 z-[9999] flex bg-[#0b0d12] text-white">
        <SideNav />
        <div className="ml-0 flex h-full flex-1 items-center justify-center sm:ml-56">
          <div className="text-center">
            <h2 className="text-2xl font-semibold">Template no encontrado</h2>
            <p className="mt-2 text-sm text-white/55">El template <code>{id}</code> no existe en el registro.</p>
            <button
              onClick={() => router.push('/landing-lab')}
              className="mt-6 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90"
            >
              ← Volver al dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  function useTemplateRaw() {
    if (!template) return;
    // Mints a new project in lab_v5 keyed to this template — the editor
    // boot path turns ?template=<id> into a fresh project on load. The
    // system templates under /public/templates/ are never touched; every
    // user works on their own copy in localStorage.
    router.push(`/landing-lab/edit?template=${encodeURIComponent(template.id)}`);
  }

  function customizeWithAi() {
    if (!template) return;
    // Routes back to the dashboard with this template pre-selected so the
    // user picks a product + prompt and the AI rewrites the copy. The
    // dashboard handles ?template=<id> on first paint.
    router.push(`/landing-lab?template=${encodeURIComponent(template.id)}`);
  }

  return (
    <div className="fixed inset-0 z-[9999] flex bg-[#0b0d12] text-white">
      <SideNav active="inicio" />

      <div className="ml-0 flex h-full flex-1 flex-col sm:ml-56">
        {/* Top bar */}
        <div className="flex items-center justify-between border-b border-white/5 bg-[#0e1015] px-6 py-3">
          <button
            onClick={() => router.push('/landing-lab')}
            className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white"
          >
            <span aria-hidden>←</span> Volver al dashboard
          </button>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-white/[0.06] px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/55">
              {KIND_LABEL[template.kind]}
            </span>
            <span className="text-sm font-semibold">{template.name}</span>
          </div>
          <div style={{ width: 130 }} />
        </div>

        {/* Body: preview + action panel */}
        <div className="flex flex-1 overflow-hidden">
          {/* Live preview iframe */}
          <div className="flex-1 overflow-hidden bg-white">
            <iframe
              src={template.htmlUrl}
              title={`${template.name} preview`}
              className="h-full w-full"
              style={{ border: 0 }}
            />
          </div>

          {/* Right panel: details + actions */}
          <aside className="hidden w-[340px] shrink-0 flex-col gap-5 overflow-y-auto border-l border-white/5 bg-[#0e1015] p-6 lg:flex">
            <div>
              <h1 className="text-2xl font-bold leading-tight">{template.name}</h1>
              <p className="mt-2 text-sm text-white/60">{template.description}</p>
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={useTemplateRaw}
                disabled={template.comingSoon}
                className="rounded-lg bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:bg-white/30"
              >
                Usar esta plantilla →
              </button>
              <p className="text-xs text-white/45">
                Crea una copia del template en tu cuenta. Editás texto, imágenes, secciones libremente.
                El template del sistema nunca se modifica.
              </p>
            </div>

            <div className="my-1 border-t border-white/5" />

            <div className="flex flex-col gap-2">
              <button
                onClick={customizeWithAi}
                disabled={template.comingSoon}
                className="rounded-lg border border-white/15 bg-transparent px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-40"
              >
                ✨ Personalizar con IA →
              </button>
              <p className="text-xs text-white/45">
                Volvé al chat para elegir tu producto y que Riverz reescriba todo el copy adaptado a él.
              </p>
            </div>

            {template.comingSoon && (
              <div className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
                Este template está en desarrollo y todavía no es editable.
              </div>
            )}

            <div className="mt-auto pt-6">
              <p className="text-[11px] text-white/35">
                Tip: arrastrá cualquier sección dentro del editor para reordenarla. Cada cambio se guarda
                automáticamente y podés volver a una versión anterior desde Versiones.
              </p>
            </div>
          </aside>
        </div>

        {/* Mobile actions — only visible when right panel is hidden */}
        <div className="flex gap-2 border-t border-white/5 bg-[#0e1015] p-3 lg:hidden">
          <button
            onClick={customizeWithAi}
            disabled={template.comingSoon}
            className="flex-1 rounded-lg border border-white/15 bg-transparent px-3 py-2.5 text-sm font-semibold text-white hover:bg-white/[0.05] disabled:opacity-40"
          >
            ✨ Con IA
          </button>
          <button
            onClick={useTemplateRaw}
            disabled={template.comingSoon}
            className="flex-1 rounded-lg bg-white px-3 py-2.5 text-sm font-semibold text-black hover:bg-white/90 disabled:bg-white/30"
          >
            Usar plantilla →
          </button>
        </div>
      </div>
    </div>
  );
}
