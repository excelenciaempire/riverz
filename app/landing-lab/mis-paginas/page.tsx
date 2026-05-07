'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SideNav } from '../_side-nav';

type Project = {
  id: string;
  name: string;
  angle?: string;
  templateId?: string;
  updatedAt?: string;
};

const PROJECTS_KEY = 'lab_v5';

export default function MisPaginasPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pendingDelete, setPendingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Show whatever's in the local cache instantly so navigating between
    // pages feels snappy. The fetch below replaces it with the server's
    // truth as soon as it lands.
    try {
      const raw = localStorage.getItem(PROJECTS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const list: Project[] = Array.isArray(parsed?.projects)
          ? parsed.projects.map((p: any) => ({
              id: p.id,
              name: p.name,
              angle: p.angle,
              templateId: p.templateId,
            }))
          : [];
        if (!cancelled && list.length > 0) setProjects(list);
      }
    } catch {/* corrupt or first visit */}

    fetch('/api/landing-lab/projects', { credentials: 'same-origin' })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data?.error || `HTTP ${r.status}`);
        return data;
      })
      .then((data) => {
        if (cancelled) return;
        const list: Project[] = Array.isArray(data?.projects)
          ? data.projects.map((p: any) => ({
              id: p.id,
              name: p.name,
              angle: p.angle,
              templateId: p.templateId,
              updatedAt: p.updatedAt,
            }))
          : [];
        setProjects(list);
        setLoadError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('[mis-paginas] list failed:', err);
        setLoadError(err?.message || 'No se pudo cargar la lista');
      })
      .finally(() => { if (!cancelled) setLoaded(true); });

    return () => { cancelled = true; };
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

  async function deleteSelected() {
    if (selectedCount === 0) return;
    setDeleting(true);
    const ids = Array.from(selected);

    // Fire DELETEs in parallel — each call is independent and the API is
    // idempotent (404 treated as success). Surface a single error if any
    // fail; the ones that succeeded still come out of the visible list.
    const results = await Promise.allSettled(
      ids.map((id) =>
        fetch(`/api/landing-lab/projects/${encodeURIComponent(id)}`, {
          method: 'DELETE',
          credentials: 'same-origin',
        }).then(async (r) => {
          if (!r.ok) {
            const data = await r.json().catch(() => ({}));
            throw new Error(data?.error || `HTTP ${r.status}`);
          }
          return id;
        }),
      ),
    );

    const failed = results.filter((r) => r.status === 'rejected');
    const succeededIds = new Set(
      results.flatMap((r) => (r.status === 'fulfilled' ? [r.value as string] : [])),
    );

    setProjects((prev) => prev.filter((p) => !succeededIds.has(p.id)));

    // Keep the local cache in sync so the editor doesn't resurrect the
    // deleted project on its next loadAll() pass.
    try {
      const raw = localStorage.getItem(PROJECTS_KEY);
      const parsed = raw ? JSON.parse(raw) : { projects: [], activeId: null };
      const fullList: any[] = Array.isArray(parsed.projects) ? parsed.projects : [];
      const kept = fullList.filter((p: any) => !succeededIds.has(p.id));
      let newActive = parsed.activeId;
      if (newActive && succeededIds.has(newActive)) {
        newActive = kept[0]?.id ?? null;
      }
      localStorage.setItem(
        PROJECTS_KEY,
        JSON.stringify({ ...parsed, projects: kept, activeId: newActive }),
      );
    } catch {/* cache drift is non-fatal */}

    setSelected(new Set());
    setEditMode(false);
    setPendingDelete(false);
    setDeleting(false);

    if (failed.length > 0) {
      const msg = (failed[0] as PromiseRejectedResult).reason?.message || 'Algunas eliminaciones fallaron';
      setLoadError(`No se pudieron eliminar ${failed.length} proyecto(s): ${msg}`);
    }
  }

  // Read a .riverz.json bundle from the user's disk and POST it as a
  // new project. The export-side serialiser lives in the editor
  // (exportProjectJSON in landing-lab.html) and emits the same shape
  // the projects POST endpoint already accepts (name, angle, cta_url,
  // template_id, project_data {...}). After the create succeeds we
  // route into the editor on the new id so the user sees their import
  // immediately, just like a fresh template clone.
  function pickImportFile() {
    setImportError(null);
    importInputRef.current?.click();
  }

  async function handleImportFile(file: File) {
    setImportError(null);
    if (!file) return;
    if (!/\.json$/i.test(file.name) && !/^application\/json/.test(file.type)) {
      setImportError('El archivo debe ser un .json (.riverz.json) exportado del editor.');
      return;
    }
    setImporting(true);
    try {
      const text = await file.text();
      let bundle: any;
      try { bundle = JSON.parse(text); }
      catch { throw new Error('JSON inválido — el archivo está corrupto o no es un export de Riverz.'); }
      // Accept either the v1 wrapped shape ({ project: {...} }) or the
      // raw project object — whichever the user dropped in.
      const p = bundle?.project || bundle;
      if (!p || typeof p !== 'object') throw new Error('El archivo no contiene un proyecto válido.');
      // Build the create payload. POST /api/landing-lab/projects mints
      // a fresh id automatically when we don't pass one — that's what
      // we want here so the import doesn't clobber an existing project.
      const body = {
        name: (p.name || 'Importado') + ' (importado)',
        angle: p.angle || '',
        cta_url: p.ctaUrl || p.cta_url || '',
        template_id: p.templateId || p.template_id || null,
        project_data: {
          texts: p.texts || {},
          images: p.images || {},
          videos: p.videos || {},
          imageSizes: p.imageSizes || {},
          imageShapes: p.imageShapes || {},
          imageStyles: p.imageStyles || {},
          videoSizes: p.videoSizes || {},
          videoAspect: p.videoAspect || {},
          layoutOrder: p.layoutOrder || null,
          globalFont: typeof p.globalFont === 'string' ? p.globalFont : '',
          html: typeof p.html === 'string' ? p.html : null,
        },
      };
      const res = await fetch('/api/landing-lab/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.project?.id) {
        throw new Error(data?.error || `No se pudo importar (HTTP ${res.status})`);
      }
      // Drop into the editor on the new project id.
      router.push(`/landing-lab/edit?p=${encodeURIComponent(data.project.id)}`);
    } catch (e: any) {
      console.error('[mis-paginas] import failed:', e);
      setImportError(e?.message || 'Falla al importar el proyecto');
      setImporting(false);
    }
  }

  return (
    <div className="app-v2 fixed inset-0 z-[9999]">
      <SideNav active="mis-paginas" />
      <input
        ref={importInputRef}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleImportFile(f);
          e.target.value = '';
        }}
      />
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
                      disabled={deleting}
                      className="rounded-lg border border-[var(--rvz-card-border)] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--rvz-ink-muted)] transition hover:border-[var(--rvz-card-hover-border)] hover:text-[var(--rvz-ink)] disabled:opacity-50"
                    >
                      {allSelected ? 'Quitar todas' : 'Seleccionar todas'}
                    </button>
                    <button
                      onClick={() => setPendingDelete(true)}
                      disabled={selectedCount === 0 || deleting}
                      className="rounded-lg bg-red-500 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:bg-red-500/40"
                    >
                      Eliminar{selectedCount ? ` (${selectedCount})` : ''}
                    </button>
                    <button
                      onClick={exitEditMode}
                      disabled={deleting}
                      className="rounded-lg border border-[var(--rvz-card-border)] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--rvz-ink-muted)] transition hover:border-[var(--rvz-card-hover-border)] hover:text-[var(--rvz-ink)] disabled:opacity-50"
                    >
                      Listo
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={pickImportFile}
                      disabled={importing}
                      className="rounded-lg border border-[var(--rvz-card-border)] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--rvz-ink-muted)] transition hover:border-[var(--rvz-card-hover-border)] hover:text-[var(--rvz-ink)] disabled:opacity-50"
                      title="Subí un .riverz.json exportado del editor"
                    >
                      {importing ? 'Importando…' : '⬆ Importar'}
                    </button>
                    <button
                      onClick={() => setEditMode(true)}
                      className="rounded-lg border border-[var(--rvz-card-border)] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--rvz-ink-muted)] transition hover:border-[var(--rvz-card-hover-border)] hover:text-[var(--rvz-ink)]"
                    >
                      Seleccionar
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
          {importError && (
            <div className="card-cream mt-4 border-red-300 p-3 text-[12px] text-red-700">
              {importError}
            </div>
          )}

          {loadError && (
            <div className="card-cream mt-6 border-red-300 p-4 text-[13px] text-red-700">
              {loadError}
            </div>
          )}

          {loaded && projects.length === 0 && !loadError && (
            <div className="card-cream mt-10 p-12 text-center text-[var(--rvz-ink-muted)]">
              Todavía no creaste ninguna página.{' '}
              <a
                href="/landing-lab"
                className="font-semibold text-[var(--rvz-ink)] underline underline-offset-2 hover:text-[var(--rvz-ink)]"
              >
                Empezá una desde el inicio
              </a>{' '}
              o{' '}
              <button
                onClick={pickImportFile}
                disabled={importing}
                className="font-semibold text-[var(--rvz-ink)] underline underline-offset-2 hover:text-[var(--rvz-ink)] disabled:opacity-50"
              >
                {importing ? 'importando…' : 'importá un .riverz.json'}
              </button>
              .
            </div>
          )}

          {projects.length > 0 && (
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
          onClick={() => !deleting && setPendingDelete(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-[var(--rvz-card-border)] bg-[var(--rvz-card)] p-6 text-[var(--rvz-ink)] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-[18px] font-medium tracking-tight">
              ¿Eliminar {selectedCount} {selectedCount === 1 ? 'página' : 'páginas'}?
            </h2>
            <p className="mt-2 text-[13px] text-[var(--rvz-ink-muted)]">
              Esto borra los proyectos de tu cuenta. Las páginas ya publicadas en Shopify
              no se ven afectadas.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setPendingDelete(false)}
                disabled={deleting}
                className="rounded-lg border border-[var(--rvz-card-border)] px-3 py-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--rvz-ink-muted)] transition hover:border-[var(--rvz-card-hover-border)] hover:text-[var(--rvz-ink)] disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={deleteSelected}
                disabled={deleting}
                className="rounded-lg bg-red-500 px-3 py-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-white hover:bg-red-600 disabled:opacity-50"
              >
                {deleting ? 'Eliminando…' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
