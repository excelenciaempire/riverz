'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SideNav } from '../_side-nav';

type Project = { id: string; name: string; angle?: string; templateId?: string };

const PROJECTS_KEY = 'lab_v5';

export default function MisPaginasPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pendingDelete, setPendingDelete] = useState(false);

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

  const selectedCount = selected.size;
  const allSelected = useMemo(
    () => projects.length > 0 && projects.every((p) => selected.has(p.id)),
    [projects, selected],
  );

  function openProject(id: string) {
    if (editMode) {
      toggleSelect(id);
      return;
    }
    router.push(`/landing-lab/edit?p=${encodeURIComponent(id)}`);
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(projects.map((p) => p.id)));
    }
  }

  function exitEditMode() {
    setEditMode(false);
    setSelected(new Set());
  }

  function deleteSelected() {
    if (selectedCount === 0) return;
    const ids = selected;
    const remaining = projects.filter((p) => !ids.has(p.id));

    // Persist: read full JSON, drop selected projects (preserving any extra
    // fields like texts/images that we don't surface on this page), and
    // pick a new activeId if the current one was deleted.
    try {
      const raw = localStorage.getItem(PROJECTS_KEY);
      const parsed = raw ? JSON.parse(raw) : { projects: [], activeId: null };
      const fullList: any[] = Array.isArray(parsed.projects) ? parsed.projects : [];
      const kept = fullList.filter((p: any) => !ids.has(p.id));
      let newActive = parsed.activeId;
      if (newActive && ids.has(newActive)) {
        newActive = kept[0]?.id ?? null;
      }
      localStorage.setItem(
        PROJECTS_KEY,
        JSON.stringify({ ...parsed, projects: kept, activeId: newActive }),
      );
      setProjects(remaining);
      setActiveId(newActive);
    } catch {
      setProjects(remaining);
    }

    setSelected(new Set());
    setEditMode(false);
    setPendingDelete(false);
  }

  return (
    <div className="app-v2 fixed inset-0 z-[9999]">
      <SideNav active="mis-paginas" />
      <div className="ml-0 h-full overflow-y-auto sm:ml-56">
        <main className="mx-auto max-w-[960px] px-6 pt-10 pb-24 sm:px-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="app-v2-eyebrow">Landing Lab</p>
              <h1 className="app-v2-page-h1 mt-2">Mis páginas</h1>
              <p className="mt-3 text-[14px] text-[var(--rvz-ink-muted)]">
                {editMode
                  ? `${selectedCount} seleccionada${selectedCount === 1 ? '' : 's'}.`
                  : 'Continuá donde lo dejaste.'}
              </p>
            </div>
            {loaded && projects.length > 0 && (
              <div className="flex shrink-0 items-center gap-2">
                {editMode ? (
                  <>
                    <button
                      onClick={toggleSelectAll}
                      className="rounded-lg border border-[var(--rvz-card-border)] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--rvz-ink-muted)] transition hover:border-[var(--rvz-card-hover-border)] hover:text-[var(--rvz-ink)]"
                    >
                      {allSelected ? 'Quitar todas' : 'Seleccionar todas'}
                    </button>
                    <button
                      onClick={() => setPendingDelete(true)}
                      disabled={selectedCount === 0}
                      className="rounded-lg bg-red-500 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:bg-red-500/40"
                    >
                      Eliminar{selectedCount ? ` (${selectedCount})` : ''}
                    </button>
                    <button
                      onClick={exitEditMode}
                      className="rounded-lg border border-[var(--rvz-card-border)] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--rvz-ink-muted)] transition hover:border-[var(--rvz-card-hover-border)] hover:text-[var(--rvz-ink)]"
                    >
                      Listo
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setEditMode(true)}
                    className="rounded-lg border border-[var(--rvz-card-border)] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--rvz-ink-muted)] transition hover:border-[var(--rvz-card-hover-border)] hover:text-[var(--rvz-ink)]"
                  >
                    Seleccionar
                  </button>
                )}
              </div>
            )}
          </div>

          {loaded && projects.length === 0 && (
            <div className="card-cream mt-10 p-12 text-center text-[var(--rvz-ink-muted)]">
              Todavía no creaste ninguna página.{' '}
              <a
                href="/landing-lab"
                className="font-semibold text-[var(--rvz-ink)] underline underline-offset-2 hover:text-[var(--rvz-ink)]"
              >
                Empezá una desde el inicio
              </a>
              .
            </div>
          )}

          {loaded && projects.length > 0 && (
            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((p) => {
                const isSelected = selected.has(p.id);
                return (
                  <div
                    key={p.id}
                    className={`card-cream group relative cursor-pointer p-5 transition ${
                      isSelected
                        ? 'border-[var(--rvz-ink)] ring-2 ring-[var(--rvz-accent)]/50'
                        : 'hover:-translate-y-0.5 hover:border-[var(--rvz-card-hover-border)]'
                    }`}
                    onClick={() => openProject(p.id)}
                  >
                    {editMode && (
                      <div
                        className={`absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded border-2 transition ${
                          isSelected
                            ? 'border-[var(--rvz-ink)] bg-[var(--rvz-accent)] text-[var(--rvz-accent-fg)]'
                            : 'border-[var(--rvz-card-border)] bg-transparent'
                        }`}
                      >
                        {isSelected && (
                          <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="2 6.5 5 9 10 3.5" />
                          </svg>
                        )}
                      </div>
                    )}
                    <div className="flex items-start justify-between gap-3 pr-6">
                      <div className="min-w-0">
                        <div className="truncate text-[15px] font-medium tracking-tight text-[var(--rvz-ink)]">
                          {p.name}
                        </div>
                        {p.angle && (
                          <div className="mt-1 line-clamp-2 text-[13px] text-[var(--rvz-ink-muted)]">
                            {p.angle}
                          </div>
                        )}
                      </div>
                      {!editMode && activeId === p.id && (
                        <span className="shrink-0 rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
                          Activo
                        </span>
                      )}
                    </div>
                    {!editMode && (
                      <div className="mt-4 flex items-center gap-2 text-[11px] uppercase tracking-[0.06em] text-[var(--rvz-ink-faint)] group-hover:text-[var(--rvz-ink)]">
                        Editar <span aria-hidden>→</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {pendingDelete && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 p-4"
          onClick={() => setPendingDelete(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-[var(--rvz-card-border)] bg-[var(--rvz-card)] p-6 text-[var(--rvz-ink)] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-[18px] font-medium tracking-tight">
              ¿Eliminar {selectedCount} {selectedCount === 1 ? 'página' : 'páginas'}?
            </h2>
            <p className="mt-2 text-[13px] text-[var(--rvz-ink-muted)]">
              Esto borra los proyectos de tu navegador. Las páginas ya publicadas en Shopify
              no se ven afectadas.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setPendingDelete(false)}
                className="rounded-lg border border-[var(--rvz-card-border)] px-3 py-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--rvz-ink-muted)] transition hover:border-[var(--rvz-card-hover-border)] hover:text-[var(--rvz-ink)]"
              >
                Cancelar
              </button>
              <button
                onClick={deleteSelected}
                className="rounded-lg bg-red-500 px-3 py-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-white hover:bg-red-600"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
