'use client';

import { useEffect, useMemo, useRef, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  LANDING_TEMPLATES,
  TEMPLATE_CATEGORIES,
  type LandingTemplate,
  type LandingTemplateKind,
} from '@/lib/landing-templates/registry';
import { SideNav } from './_side-nav';

type Product = {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  benefits?: string | null;
  research_status?: string | null;
};

const PROJECTS_KEY = 'lab_v5';

const TYPE_DEFAULT_TEMPLATE: Record<LandingTemplateKind, string | null> = {
  advertorial: 'pilar-listicle',
  listicle: 'pilar-listicle',
  landing_page: null,
  product_page: null,
};

const TYPE_STARTER_PROMPT: Record<LandingTemplateKind, string> = {
  landing_page: 'Crea una landing page enfocada en una sola oferta para mi producto.',
  product_page: 'Crea una página de producto con beneficios, variantes y add-to-cart.',
  listicle: 'Crea un listicle de 5 razones por las que mi producto es la mejor opción.',
  advertorial: 'Crea un advertorial estilo editorial que eduque y caliente tráfico frío.',
};

const TYPE_LABEL: Record<LandingTemplateKind, string> = {
  landing_page: 'Landing page',
  product_page: 'Product page',
  listicle: 'Listicle',
  advertorial: 'Advertorial',
};

export default function LandingLabDashboard() {
  return (
    <Suspense fallback={null}>
      <DashboardInner />
    </Suspense>
  );
}

function DashboardInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filter, setFilter] = useState<'all' | LandingTemplateKind>('all');
  const carouselRef = useRef<HTMLDivElement | null>(null);

  // Composer state
  const [prompt, setPrompt] = useState('');
  const [products, setProducts] = useState<Product[] | null>(null);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productId, setProductId] = useState<string | ''>('');
  const [pageType, setPageType] = useState<LandingTemplateKind | ''>('');
  const [chosenTemplate, setChosenTemplate] = useState<LandingTemplate | null>(null);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setProductsLoading(true);
    fetch('/api/products')
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Product[]) => {
        setProducts(Array.isArray(data) ? data : []);
        if (Array.isArray(data) && data.length > 0) setProductId(data[0].id);
      })
      .catch(() => setProducts([]))
      .finally(() => setProductsLoading(false));
  }, []);

  const visibleTemplates = useMemo(
    () =>
      filter === 'all'
        ? LANDING_TEMPLATES
        : LANDING_TEMPLATES.filter((t) => t.kind === filter),
    [filter],
  );

  function pickCategory(kind: LandingTemplateKind) {
    setFilter(kind);
    setPageType(kind);
    if (!prompt.trim()) setPrompt(TYPE_STARTER_PROMPT[kind]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function pickTemplateFromCard(t: LandingTemplate) {
    if (t.comingSoon) return;
    router.push(`/landing-lab/template/${encodeURIComponent(t.id)}`);
  }

  // When the preview screen sends the user back here with a ?template=<id>
  // query param ("Personalizar con IA" path), pre-load the chip + starter
  // prompt so the user just has to pick a product and submit. Cleared from
  // the URL afterwards so a refresh doesn't re-trigger.
  useEffect(() => {
    const tplId = searchParams.get('template');
    if (!tplId) return;
    const t = LANDING_TEMPLATES.find((x) => x.id === tplId);
    if (t && !t.comingSoon) {
      setChosenTemplate(t);
      setPageType(t.kind);
      setPrompt((p) => p.trim() ? p : TYPE_STARTER_PROMPT[t.kind]);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    // Drop the query param so a refresh doesn't re-fire.
    if (typeof window !== 'undefined' && window.history && window.history.replaceState) {
      try { window.history.replaceState(null, '', '/landing-lab'); } catch {/* ignore */}
    }
  }, [searchParams]);

  function onAttachClick() { fileInputRef.current?.click(); }
  function onFilesPicked(files: FileList | null) {
    if (!files) return;
    const arr = Array.from(files).filter((f) => f.type.startsWith('image/'));
    setAttachments((prev) => [...prev, ...arr]);
  }
  function removeAttachment(idx: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setGenError(null);

    const templateId =
      chosenTemplate?.id ||
      (pageType ? TYPE_DEFAULT_TEMPLATE[pageType] : null);

    if (!templateId) {
      setGenError('Elegí un tipo de página o un template específico abajo.');
      return;
    }

    const product = (products || []).find((p) => p.id === productId);
    if (!product && !prompt.trim()) {
      setGenError('Elegí un producto o describí qué querés en el chat.');
      return;
    }

    setGenerating(true);
    try {
      const reqBody: any = { template_id: templateId };
      if (product) {
        reqBody.product_id = product.id;
        if (prompt.trim()) reqBody.product_info = { name: product.name, angle: prompt.trim() };
      } else {
        reqBody.product_info = { name: 'Mi producto', description: prompt.trim(), angle: prompt.trim() };
      }

      const res = await fetch('/api/landing-lab/generate-from-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reqBody),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Error ${res.status}`);

      const newId = makeProjectId();
      const tplName = LANDING_TEMPLATES.find((t) => t.id === templateId)?.name || 'Template';
      const projectName = `${tplName} — ${data.product_name || product?.name || 'Sin producto'}`;
      const newProject = {
        id: newId,
        name: projectName,
        angle: prompt.trim() || product?.name || '',
        ctaUrl: 'https://',
        texts: data.texts || {},
        images: {},
        templateId,
      };

      const raw = localStorage.getItem(PROJECTS_KEY);
      const stored = raw ? JSON.parse(raw) : { projects: [], activeId: null };
      const list = Array.isArray(stored.projects) ? stored.projects : [];
      list.push(newProject);
      stored.projects = list;
      stored.activeId = newId;
      localStorage.setItem(PROJECTS_KEY, JSON.stringify(stored));

      router.push(`/landing-lab/edit?p=${encodeURIComponent(newId)}`);
    } catch (err: any) {
      setGenError(err?.message || 'No se pudo generar el copy');
      setGenerating(false);
    }
  }

  function scrollCarousel(dir: 1 | -1) {
    const el = carouselRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.min(el.clientWidth * 0.85, 720), behavior: 'smooth' });
  }

  const submitDisabled = generating || (!prompt.trim() && !productId && !chosenTemplate);

  return (
    <div className="app-v2 fixed inset-0 z-[9999]">
      <SideNav active="inicio" />

      <div className="ml-0 h-full overflow-y-auto sm:ml-56">
        <main className="mx-auto max-w-[960px] px-6 pt-12 pb-24 sm:px-8">

          {/* Hero headline */}
          <h1 className="text-center text-[40px] font-bold leading-[1.05] tracking-tight sm:text-[56px]">
            Lanzá 10x más páginas.<br />
            <span className="text-[var(--rvz-ink)]">Escalá 90% más rápido.</span>
          </h1>

          {/* Composer (chat) */}
          <form
            onSubmit={handleSubmit}
            className="mt-10 rounded-2xl border border-[var(--rvz-card-border)] bg-[var(--rvz-card)] p-3 shadow-[0_2px_30px_rgba(0,0,0,.4)]"
          >
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describí lo que querés crear, o elegí una categoría abajo y Riverz autocompleta el prompt…"
              rows={3}
              disabled={generating}
              className="w-full resize-none bg-transparent px-3 py-2 text-[15px] text-[var(--rvz-ink)] placeholder:text-[var(--rvz-ink-faint)] focus:outline-none disabled:opacity-50"
            />

            {attachments.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2 px-3">
                {attachments.map((f, i) => (
                  <span
                    key={`${f.name}-${i}`}
                    className="inline-flex items-center gap-1.5 rounded-md border border-[var(--rvz-card-border)] bg-[var(--rvz-bg-soft)] px-2 py-1 text-xs text-[var(--rvz-ink-muted)]"
                  >
                    <span aria-hidden>🖼</span>
                    <span className="max-w-[140px] truncate">{f.name}</span>
                    <button
                      type="button"
                      onClick={() => removeAttachment(i)}
                      className="ml-1 text-[var(--rvz-ink-faint)] hover:text-[var(--rvz-ink)]"
                      aria-label={`Quitar ${f.name}`}
                    >×</button>
                  </span>
                ))}
              </div>
            )}

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <ProductChip
                products={products}
                productId={productId}
                setProductId={setProductId}
                loading={productsLoading}
                disabled={generating}
              />
              <button
                type="button"
                onClick={onAttachClick}
                disabled={generating}
                className="inline-flex select-none items-center gap-1.5 rounded-full bg-[var(--rvz-bg-soft)] px-3 py-1.5 text-xs text-[var(--rvz-ink-muted)] ring-1 ring-inset ring-[var(--rvz-card-border)] hover:bg-[var(--rvz-bg-soft)] hover:text-[var(--rvz-ink)] disabled:opacity-50"
              >
                <span aria-hidden>📎</span> Adjuntar
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(e) => { onFilesPicked(e.target.files); e.target.value = ''; }}
              />

              <div className="ml-auto flex items-center gap-2">
                <PageTypeChip
                  value={pageType}
                  onChange={setPageType}
                  disabled={generating}
                />
                {chosenTemplate && (
                  <span className="inline-flex select-none items-center gap-1.5 rounded-full bg-[var(--rvz-accent)]/30 px-3 py-1.5 text-xs text-[var(--rvz-ink)] ring-1 ring-inset ring-[var(--rvz-ink)]/20">
                    <span aria-hidden>📐</span>
                    {chosenTemplate.name}
                    <button
                      type="button"
                      onClick={() => setChosenTemplate(null)}
                      className="ml-1 text-[var(--rvz-ink-faint)] hover:text-[var(--rvz-ink)]"
                      aria-label="Quitar template"
                      disabled={generating}
                    >×</button>
                  </span>
                )}
                <button
                  type="submit"
                  aria-label="Generar"
                  disabled={submitDisabled}
                  className="app-v2-cta h-9 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {generating ? (<><Spinner /> Generando…</>) : (<>Generar →</>)}
                </button>
              </div>
            </div>

            {genError && (
              <div className="mx-3 mt-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
                {genError}
              </div>
            )}
          </form>

          {/* 4 Category cards */}
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <CategoryCard
              title="Landing Pages"
              subtitle="Probá nuevas ofertas, ángulos e ideas de tus mejores ads."
              tone="from-violet-500/20 to-violet-500/5"
              onClick={() => pickCategory('landing_page')}
            />
            <CategoryCard
              title="Product Pages"
              subtitle="Templates personalizados de página de producto en tu Shopify."
              tone="from-amber-500/20 to-amber-500/5"
              onClick={() => pickCategory('product_page')}
            />
            <CategoryCard
              title="Listicles"
              subtitle="Lista las razones por las que tu producto es la mejor opción."
              tone="from-rose-500/20 to-rose-500/5"
              onClick={() => pickCategory('listicle')}
            />
            <CategoryCard
              title="Advertorials"
              subtitle="Educa y calienta tráfico frío antes de la compra."
              tone="from-emerald-500/20 to-emerald-500/5"
              onClick={() => pickCategory('advertorial')}
            />
          </div>

          {/* Discover templates */}
          <section className="mt-16">
            <div className="flex items-end justify-between">
              <div>
                <h2 className="text-2xl font-semibold">Descubrí templates</h2>
                <p className="mt-1 text-sm text-[var(--rvz-ink-muted)]">
                  Hover sobre un template para ver el preview animado. Click para cargarlo en el chat.
                </p>
              </div>
            </div>

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
                        ? 'bg-[var(--rvz-ink)] text-[var(--rvz-bg)]'
                        : 'bg-[var(--rvz-bg-soft)] text-[var(--rvz-ink-muted)] hover:text-[var(--rvz-ink)]')
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
                  className="grid size-8 place-items-center rounded-full border border-[var(--rvz-card-border)] bg-[var(--rvz-bg-soft)] text-[var(--rvz-ink-muted)] hover:bg-[var(--rvz-bg-soft)] hover:text-[var(--rvz-ink)]"
                >‹</button>
                <button
                  aria-label="Siguiente"
                  onClick={() => scrollCarousel(1)}
                  className="grid size-8 place-items-center rounded-full border border-[var(--rvz-card-border)] bg-[var(--rvz-bg-soft)] text-[var(--rvz-ink-muted)] hover:bg-[var(--rvz-bg-soft)] hover:text-[var(--rvz-ink)]"
                >›</button>
              </div>
            </div>

            <div
              ref={carouselRef}
              className="mt-5 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {visibleTemplates.map((t) => (
                <TemplateCard key={t.id} template={t} onClick={() => pickTemplateFromCard(t)} />
              ))}
              {visibleTemplates.length === 0 && (
                <div className="grid h-[260px] w-full place-items-center rounded-xl border border-dashed border-[var(--rvz-card-border)] text-sm text-[var(--rvz-ink-faint)]">
                  No hay templates en esta categoría todavía.
                </div>
              )}
            </div>
          </section>

        </main>
      </div>
    </div>
  );
}

/* ───── presentational sub-components ───── */

function ProductChip({
  products, productId, setProductId, loading, disabled,
}: {
  products: Product[] | null;
  productId: string;
  setProductId: (v: string) => void;
  loading: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const selected = (products || []).find((p) => p.id === productId);
  const hasProducts = (products?.length || 0) > 0;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={disabled || loading}
        className={
          'inline-flex select-none items-center gap-1.5 rounded-full px-3 py-1.5 text-xs ring-1 ring-inset transition ' +
          (selected
            ? 'bg-emerald-500/15 text-emerald-200 ring-emerald-400/30 hover:bg-emerald-500/20'
            : 'bg-[var(--rvz-bg-soft)] text-[var(--rvz-ink-muted)] ring-[var(--rvz-card-border)] hover:bg-[var(--rvz-bg-soft)] hover:text-[var(--rvz-ink)]') +
          ' disabled:opacity-50'
        }
      >
        <span aria-hidden>📦</span>
        {loading ? 'Cargando productos…' : selected ? selected.name : 'Producto'}
        <span aria-hidden className="text-[var(--rvz-ink-faint)]">▾</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1.5 w-[260px] overflow-hidden rounded-lg border border-[var(--rvz-card-border)] bg-[var(--rvz-card)] shadow-xl">
          {!hasProducts && (
            <div className="p-3 text-xs text-[var(--rvz-ink-muted)]">
              No tenés productos.{' '}
              <a href="/marcas" className="font-semibold text-purple-300 hover:text-purple-200">
                Agregá uno
              </a>.
            </div>
          )}
          {hasProducts && (
            <ul className="max-h-[260px] overflow-y-auto py-1">
              {(products || []).map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => { setProductId(p.id); setOpen(false); }}
                    className={
                      'flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition hover:bg-white/[0.05] ' +
                      (productId === p.id ? 'text-[var(--rvz-ink)]' : 'text-[var(--rvz-ink-muted)]')
                    }
                  >
                    <span className="truncate">{p.name}</span>
                    {p.research_status === 'completed' && (
                      <span className="shrink-0 text-[10px] uppercase tracking-wider text-emerald-300/80">research</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function PageTypeChip({
  value, onChange, disabled,
}: {
  value: LandingTemplateKind | '';
  onChange: (v: LandingTemplateKind | '') => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        className="inline-flex select-none items-center gap-1.5 rounded-full bg-[var(--rvz-bg-soft)] px-3 py-1.5 text-xs text-[var(--rvz-ink-muted)] ring-1 ring-inset ring-[var(--rvz-card-border)] hover:bg-[var(--rvz-bg-soft)] hover:text-[var(--rvz-ink)] disabled:opacity-50"
      >
        <span aria-hidden>📐</span>
        {value ? TYPE_LABEL[value] : 'Tipo de página'}
        <span aria-hidden className="text-[var(--rvz-ink-faint)]">▾</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1.5 w-[180px] overflow-hidden rounded-lg border border-[var(--rvz-card-border)] bg-[var(--rvz-card)] shadow-xl">
          <ul className="py-1">
            {(Object.keys(TYPE_LABEL) as LandingTemplateKind[]).map((k) => (
              <li key={k}>
                <button
                  type="button"
                  onClick={() => { onChange(k); setOpen(false); }}
                  className={
                    'block w-full px-3 py-2 text-left text-sm hover:bg-white/[0.05] ' +
                    (value === k ? 'text-[var(--rvz-ink)]' : 'text-[var(--rvz-ink-muted)]')
                  }
                >
                  {TYPE_LABEL[k]}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function CategoryCard({
  title, subtitle, tone, onClick,
}: { title: string; subtitle: string; tone: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group relative overflow-hidden rounded-2xl border border-[var(--rvz-card-border)] bg-[var(--rvz-card)] p-6 text-left transition hover:border-[var(--rvz-card-hover-border)] hover:bg-[var(--rvz-bg-soft)]"
    >
      <div className={`absolute inset-0 -z-10 bg-gradient-to-br ${tone} opacity-60 transition group-hover:opacity-90`} />
      <h3 className="text-xl font-bold tracking-tight">{title}</h3>
      <p className="mt-2 max-w-[28ch] text-sm text-[var(--rvz-ink-muted)]">{subtitle}</p>
      <span className="mt-6 inline-flex items-center gap-1 text-xs font-semibold text-[var(--rvz-ink-faint)] transition group-hover:text-[var(--rvz-ink)]">
        Cargar prompt en el chat <span aria-hidden>→</span>
      </span>
    </button>
  );
}

function TemplateCard({ template, onClick }: { template: LandingTemplate; onClick: () => void }) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const rafRef = useRef<number | null>(null);

  function startScrollAnim() {
    cancelAnim();
    const win = iframeRef.current?.contentWindow;
    const doc = win?.document;
    if (!win || !doc) return;
    const max = Math.max(0, doc.documentElement.scrollHeight - win.innerHeight);
    if (max <= 0) return;
    const duration = 5500; // ~5.5s for a full-page sweep — slow enough to read, fast enough to feel alive
    const startScroll = win.scrollY || 0;
    const t0 = performance.now();
    function step(now: number) {
      const t = Math.min(1, (now - t0) / duration);
      // Ease in-out so the start and end aren't jarring
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      win!.scrollTo(0, startScroll + (max - startScroll) * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(step);
    }
    rafRef.current = requestAnimationFrame(step);
  }

  function stopScrollAnim() {
    cancelAnim();
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    // Smooth scroll back to top so the next hover starts clean
    try { win.scrollTo({ top: 0, behavior: 'smooth' }); } catch { win.scrollTo(0, 0); }
  }

  function cancelAnim() {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }

  return (
    <button
      onClick={onClick}
      onMouseEnter={startScrollAnim}
      onMouseLeave={stopScrollAnim}
      onFocus={startScrollAnim}
      onBlur={stopScrollAnim}
      className="group relative w-[300px] shrink-0 snap-start overflow-hidden rounded-xl border border-[var(--rvz-card-border)] bg-[var(--rvz-card)] text-left transition hover:border-[var(--rvz-card-hover-border)]"
      disabled={template.comingSoon}
    >
      <div className="relative h-[210px] overflow-hidden bg-white">
        <iframe
          ref={iframeRef}
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
        <div className="mt-1 text-xs uppercase tracking-wider text-[var(--rvz-ink-faint)]">
          {template.kind === 'advertorial' ? 'Advertorial'
            : template.kind === 'listicle' ? 'Listicle'
            : template.kind === 'product_page' ? 'Product page'
            : 'Landing page'}
        </div>
        <div className="mt-2 line-clamp-2 text-sm text-[var(--rvz-ink-muted)]">{template.description}</div>
      </div>
    </button>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="inline-block size-4 animate-spin rounded-full border-2 border-current border-r-transparent"
    />
  );
}

function makeProjectId(): string {
  return 'p_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
