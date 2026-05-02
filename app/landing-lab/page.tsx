'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  LANDING_TEMPLATES,
  TEMPLATE_CATEGORIES,
  type LandingTemplate,
  type LandingTemplateKind,
} from '@/lib/landing-templates/registry';

type Project = { id: string; name: string; angle?: string; templateId?: string };

const PROJECTS_KEY = 'lab_v5';

export default function LandingLabDashboard() {
  const router = useRouter();
  const [filter, setFilter] = useState<'all' | LandingTemplateKind>('all');
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const carouselRef = useRef<HTMLDivElement | null>(null);

  // Load existing projects from localStorage so the user can keep editing.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(PROJECTS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const list: Project[] = Array.isArray(parsed?.projects)
        ? parsed.projects.map((p: any) => ({
            id: p.id,
            name: p.name,
            angle: p.angle,
            templateId: p.templateId,
          }))
        : [];
      setProjects(list);
      setActiveId(parsed?.activeId || null);
    } catch {
      // localStorage corrupt or first visit — leave empty.
    }
  }, []);

  const visibleTemplates = useMemo(
    () =>
      filter === 'all'
        ? LANDING_TEMPLATES
        : LANDING_TEMPLATES.filter((t) => t.kind === filter),
    [filter],
  );

  function openTemplate(t: LandingTemplate) {
    if (t.comingSoon) return;
    // For Vitalu inline templates, the editor's existing "create new from
    // starter project" flow handles the load; we just send a hint param.
    if (t.inlineSource) {
      router.push(`/landing-lab/edit?template=${encodeURIComponent(t.inlineSource)}`);
      return;
    }
    router.push(`/landing-lab/edit?template=${encodeURIComponent(t.id)}`);
  }

  function openProject(id: string) {
    router.push(`/landing-lab/edit?p=${encodeURIComponent(id)}`);
  }

  function scrollCarousel(dir: 1 | -1) {
    const el = carouselRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.min(el.clientWidth * 0.85, 720), behavior: 'smooth' });
  }

  function onPromptSubmit(e: React.FormEvent) {
    e.preventDefault();
    // AI generation path is not wired yet — the dashboard ships UI-only.
    // Until /api/landing-lab/ai-generate exists, route the user to the
    // template gallery so they pick a starter manually.
    if (!prompt.trim()) return;
    alert('La generación con IA llega en el próximo release. Por ahora elegí un template abajo y editalo.');
  }

  return (
    <div className="fixed inset-0 z-[9999] overflow-y-auto bg-[#0b0d12] text-white">
      <main className="mx-auto max-w-[960px] px-6 pt-10 pb-24 sm:px-8">

        {/* Header strip — plan badge + close button */}
        <div className="mb-10 flex items-center justify-between">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs">
            <span className="text-white/60">Free plan</span>
            <span className="text-purple-400">·</span>
            <a href="/configuracion?tab=plan" className="text-purple-400 hover:text-purple-300">Upgrade</a>
          </div>
          <a
            href="/dashboard"
            className="text-sm text-white/50 hover:text-white"
            title="Volver al dashboard"
          >
            Salir ✕
          </a>
        </div>

        {/* Hero headline */}
        <h1 className="text-center text-[44px] font-bold leading-[1.05] tracking-tight sm:text-[60px]">
          Lanza 10x más páginas.<br />
          <span className="text-white/90">Escala 90% más rápido.</span>
        </h1>

        {/* Prompt input */}
        <form onSubmit={onPromptSubmit} className="mt-10 rounded-2xl border border-white/10 bg-[#15181f] p-3 shadow-[0_2px_30px_rgba(0,0,0,.4)]">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Pídele a Riverz que cree un listicle con 5 razones para tu producto..."
            rows={3}
            className="w-full resize-none bg-transparent px-3 py-2 text-[15px] text-white placeholder:text-white/40 focus:outline-none"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <PillButton icon="🎨" label="Brand Style" />
            <PillButton icon="📦" label="Producto" />
            <PillButton icon="📎" label="Adjuntar" />
            <div className="ml-auto flex items-center gap-2">
              <PillButton icon="📐" label="Landing page" />
              <button
                type="submit"
                aria-label="Generar"
                className="grid size-9 place-items-center rounded-full bg-white text-black transition hover:bg-white/90 disabled:opacity-50"
                disabled={!prompt.trim()}
              >
                ↑
              </button>
            </div>
          </div>
        </form>

        {/* 4 Category cards */}
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <CategoryCard
            title="Landing Pages"
            subtitle="Probá nuevas ofertas, ángulos e ideas de tus mejores ads."
            tone="from-violet-500/20 to-violet-500/5"
            onClick={() => setFilter('landing_page')}
          />
          <CategoryCard
            title="Product Pages"
            subtitle="Templates personalizados de página de producto en tu Shopify."
            tone="from-amber-500/20 to-amber-500/5"
            onClick={() => setFilter('product_page')}
          />
          <CategoryCard
            title="Listicles"
            subtitle="Lista las razones por las que tu producto es la mejor opción."
            tone="from-rose-500/20 to-rose-500/5"
            onClick={() => setFilter('listicle')}
          />
          <CategoryCard
            title="Advertorials"
            subtitle="Educa y calienta tráfico frío antes de la compra."
            tone="from-emerald-500/20 to-emerald-500/5"
            onClick={() => setFilter('advertorial')}
          />
        </div>

        {/* Mis páginas (existing projects) */}
        {projects.length > 0 && (
          <section className="mt-16">
            <div className="flex items-end justify-between">
              <div>
                <h2 className="text-2xl font-semibold">Mis páginas</h2>
                <p className="mt-1 text-sm text-white/50">Continuá donde lo dejaste.</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
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

        {/* Discover templates */}
        <section className="mt-16">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-semibold">Descubrí templates</h2>
              <p className="mt-1 text-sm text-white/50">Empezá tu próximo proyecto desde un template.</p>
            </div>
          </div>

          {/* Filter pills */}
          <div className="mt-5 flex flex-wrap items-center gap-2">
            {TEMPLATE_CATEGORIES.map((c) => {
              const active = filter === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setFilter(c.id)}
                  className={
                    'rounded-full px-4 py-1.5 text-sm transition ' +
                    (active
                      ? 'bg-white text-black'
                      : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white')
                  }
                >
                  {c.label}
                </button>
              );
            })}
            <div className="ml-auto flex items-center gap-2">
              <button
                aria-label="Anterior"
                onClick={() => scrollCarousel(-1)}
                className="grid size-8 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/10 hover:text-white"
              >‹</button>
              <button
                aria-label="Siguiente"
                onClick={() => scrollCarousel(1)}
                className="grid size-8 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/10 hover:text-white"
              >›</button>
            </div>
          </div>

          {/* Carousel */}
          <div
            ref={carouselRef}
            className="mt-5 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {visibleTemplates.map((t) => (
              <TemplateCard key={t.id} template={t} onClick={() => openTemplate(t)} />
            ))}
            {visibleTemplates.length === 0 && (
              <div className="grid h-[260px] w-full place-items-center rounded-xl border border-dashed border-white/10 text-sm text-white/40">
                No hay templates en esta categoría todavía.
              </div>
            )}
          </div>
        </section>

      </main>
    </div>
  );
}

/* ───── presentational sub-components ───── */

function PillButton({ icon, label }: { icon: string; label: string }) {
  return (
    <span className="inline-flex select-none items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1.5 text-xs text-white/75 ring-1 ring-inset ring-white/10">
      <span aria-hidden>{icon}</span>
      {label}
    </span>
  );
}

function CategoryCard({
  title,
  subtitle,
  tone,
  onClick,
}: {
  title: string;
  subtitle: string;
  tone: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group relative overflow-hidden rounded-2xl border border-white/10 bg-[#15181f] p-6 text-left transition hover:border-white/25 hover:bg-[#1a1e27]"
    >
      <div className={`absolute inset-0 -z-10 bg-gradient-to-br ${tone} opacity-60 transition group-hover:opacity-90`} />
      <h3 className="text-xl font-bold tracking-tight">{title}</h3>
      <p className="mt-2 max-w-[28ch] text-sm text-white/55">{subtitle}</p>
      <span className="mt-6 inline-flex items-center gap-1 text-xs font-semibold text-white/40 transition group-hover:text-white">
        Ver templates <span aria-hidden>→</span>
      </span>
    </button>
  );
}

function TemplateCard({ template, onClick }: { template: LandingTemplate; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group relative w-[300px] shrink-0 snap-start overflow-hidden rounded-xl border border-white/10 bg-[#15181f] text-left transition hover:border-white/25"
      disabled={template.comingSoon}
    >
      {/* Thumbnail — live iframe scaled down. Pointer-events disabled so the
          whole card stays clickable. */}
      <div className="relative h-[210px] overflow-hidden bg-white">
        <iframe
          src={template.htmlUrl}
          title={`${template.name} preview`}
          aria-hidden
          className="pointer-events-none origin-top-left scale-[0.30]"
          style={{ width: '1000px', height: '700px', border: 0 }}
        />
        {template.comingSoon && (
          <div className="absolute inset-0 grid place-items-center bg-black/65 backdrop-blur-[2px]">
            <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider">
              Próximamente
            </span>
          </div>
        )}
      </div>
      <div className="p-4">
        <div className="text-base font-semibold">{template.name}</div>
        <div className="mt-1 text-xs uppercase tracking-wider text-white/40">
          {kindLabel(template.kind)}
        </div>
        <div className="mt-2 line-clamp-2 text-sm text-white/55">{template.description}</div>
      </div>
    </button>
  );
}

function kindLabel(k: LandingTemplateKind): string {
  if (k === 'advertorial') return 'Advertorial';
  if (k === 'listicle') return 'Listicle';
  if (k === 'product_page') return 'Product page';
  return 'Landing page';
}
