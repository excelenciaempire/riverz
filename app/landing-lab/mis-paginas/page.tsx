'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SideNav } from '../_side-nav';

type LegacyProject = { id: string; name: string; angle?: string; templateId?: string };
type V2Page = {
  id: string;
  name: string;
  kind: string;
  status: 'draft' | 'published';
  updated_at: string;
};

const PROJECTS_KEY = 'lab_v5';

export default function MisPaginasPage() {
  const router = useRouter();
  // Legacy: proyectos en localStorage del editor v1.
  const [projects, setProjects] = useState<LegacyProject[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  // V2: páginas persistidas en Supabase desde el nuevo editor.
  const [v2Pages, setV2Pages] = useState<V2Page[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Legacy
    try {
      const raw = localStorage.getItem(PROJECTS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const list: LegacyProject[] = Array.isArray(parsed?.projects)
          ? parsed.projects.map((p: any) => ({
              id: p.id, name: p.name, angle: p.angle, templateId: p.templateId,
            }))
          : [];
        setProjects(list);
        setActiveId(parsed?.activeId || null);
      }
    } catch {/* corrupt or first visit */}

    // V2
    fetch('/api/landing-pages')
      .then((r) => r.json())
      .then((j) => setV2Pages(j.pages ?? []))
      .catch(() => null)
      .finally(() => setLoaded(true));
  }, []);

  function openProject(id: string) {
    router.push(`/landing-lab/edit?p=${encodeURIComponent(id)}`);
  }
  function openV2(id: string) {
    router.push(`/landing-lab/edit/${id}`);
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-[#0b0d12] text-white">
      <SideNav active="mis-paginas" />
      <div className="ml-0 h-full overflow-y-auto sm:ml-56">
        <main className="mx-auto max-w-[960px] px-6 pt-10 pb-24 sm:px-8">
          <h1 className="text-3xl font-bold">Mis páginas</h1>
          <p className="mt-1 text-sm text-white/55">Continuá donde lo dejaste.</p>

          {loaded && v2Pages.length === 0 && projects.length === 0 && (
            <div className="mt-10 rounded-xl border border-dashed border-white/10 bg-[#15181f] p-8 text-center text-white/55">
              Todavía no creaste ninguna página.{' '}
              <a href="/landing-lab" className="font-semibold text-purple-300 hover:text-purple-200">
                Empezá una desde el inicio
              </a>.
            </div>
          )}

          {/* V2 — editor React */}
          {loaded && v2Pages.length > 0 && (
            <section className="mt-6">
              <div className="mb-3 flex items-center gap-2">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-white/60">
                  Editor V2
                </h2>
                <span className="rounded-full bg-[#07A498]/20 px-2 py-[1px] text-[10px] font-semibold uppercase tracking-wider text-[#07A498]">
                  Nuevo
                </span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {v2Pages.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => openV2(p.id)}
                    className="group rounded-xl border border-white/10 bg-[#15181f] p-4 text-left transition hover:border-[#07A498] hover:bg-[#1a1e27]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-base font-semibold">{p.name}</div>
                        <div className="mt-1 text-[11px] uppercase tracking-wider text-white/50">{p.kind.replace('_', ' ')}</div>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                          p.status === 'published'
                            ? 'bg-emerald-400/15 text-emerald-300'
                            : 'bg-blue-400/15 text-blue-300'
                        }`}
                      >
                        {p.status === 'published' ? 'Publicada' : 'Borrador'}
                      </span>
                    </div>
                    <div className="mt-4 flex items-center justify-between text-xs text-white/40 group-hover:text-white/70">
                      <span>Modificada {new Date(p.updated_at).toLocaleDateString()}</span>
                      <span aria-hidden>→</span>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Legacy — editor HTML iframe */}
          {loaded && projects.length > 0 && (
            <section className="mt-10">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-white/60">
                Proyectos legacy (editor v1)
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {projects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => openProject(p.id)}
                    className="group rounded-xl border border-white/10 bg-[#15181f] p-4 text-left transition hover:border-white/25 hover:bg-[#1a1e27]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-base font-semibold">{p.name}</div>
                        {p.angle && (
                          <div className="mt-1 line-clamp-2 text-sm text-white/50">{p.angle}</div>
                        )}
                      </div>
                      {activeId === p.id && (
                        <span className="shrink-0 rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
                          Activo
                        </span>
                      )}
                    </div>
                    <div className="mt-4 flex items-center gap-2 text-xs text-white/40 group-hover:text-white/70">
                      Editar <span aria-hidden>→</span>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
