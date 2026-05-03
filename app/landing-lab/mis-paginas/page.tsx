'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SideNav } from '../_side-nav';

type Project = { id: string; name: string; angle?: string; templateId?: string };

const PROJECTS_KEY = 'lab_v5';

export default function MisPaginasPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PROJECTS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const list: Project[] = Array.isArray(parsed?.projects)
          ? parsed.projects.map((p: any) => ({
              id: p.id, name: p.name, angle: p.angle, templateId: p.templateId,
            }))
          : [];
        setProjects(list);
        setActiveId(parsed?.activeId || null);
      }
    } catch {/* corrupt or first visit */}
    setLoaded(true);
  }, []);

  function openProject(id: string) {
    router.push(`/landing-lab/edit?p=${encodeURIComponent(id)}`);
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-[#0b0d12] text-white">
      <SideNav active="mis-paginas" />
      <div className="ml-0 h-full overflow-y-auto sm:ml-56">
        <main className="mx-auto max-w-[960px] px-6 pt-10 pb-24 sm:px-8">
          <h1 className="text-3xl font-bold">Mis páginas</h1>
          <p className="mt-1 text-sm text-white/55">Continuá donde lo dejaste.</p>

          {loaded && projects.length === 0 && (
            <div className="mt-10 rounded-xl border border-dashed border-white/10 bg-[#15181f] p-8 text-center text-white/55">
              Todavía no creaste ninguna página.{' '}
              <a href="/landing-lab" className="font-semibold text-purple-300 hover:text-purple-200">
                Empezá una desde el inicio
              </a>.
            </div>
          )}

          {loaded && projects.length > 0 && (
            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
          )}
        </main>
      </div>
    </div>
  );
}
