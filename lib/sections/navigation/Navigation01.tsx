/**
 * Navigation 01 — barra superior simple: logo a la izquierda, 3 links al
 * centro, CTA a la derecha. Sin mega-menu por ahora (V2).
 */
import type { SectionDefinition, SectionRenderProps } from '../types';
import { escapeHtml, s, b, color } from '../_helpers';

const TYPE = 'navigation-01';

function links(raw: unknown): Array<{ label: string; href: string }> {
  if (Array.isArray(raw)) {
    return raw
      .map((l) => (typeof l === 'object' && l ? (l as { label: string; href: string }) : null))
      .filter(Boolean) as Array<{ label: string; href: string }>;
  }
  return [];
}

function Navigation01({ values, theme, visible }: SectionRenderProps) {
  const bg = color(values, 'bg', theme.bg, '#ffffff');
  const text = color(values, 'text', undefined, '#0f0f0f');
  const ctaBg = color(values, 'ctaBg', theme.primary, '#07A498');

  return (
    <header style={{ background: bg, color: text }} className="border-b border-black/5 px-6 py-4">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6">
        <a href="/" className="text-lg font-bold">
          {s(values, 'logoText', 'BRAND')}
        </a>
        <nav className="hidden items-center gap-6 text-sm md:flex">
          {links(values.links).map((l, i) => (
            <a key={i} href={l.href} className="opacity-70 hover:opacity-100">
              {l.label}
            </a>
          ))}
        </nav>
        {b(visible, 'cta') && (
          <a
            href={s(values, 'ctaUrl', '/products')}
            style={{ background: ctaBg, color: '#fff' }}
            className="rounded-full px-5 py-2 text-sm font-semibold"
          >
            {s(values, 'ctaText', 'Comprar')}
          </a>
        )}
      </div>
    </header>
  );
}

export const definition: SectionDefinition = {
  type: TYPE,
  category: 'navigation',
  name: 'Navigation 01',
  description: 'Logo + links + CTA. Default minimalista.',
  thumbnail: '/sections/navigation-01.jpg',
  defaultProps: {
    logoText: 'BRAND',
    links: [
      { label: 'Productos', href: '/collections/all' },
      { label: 'Cómo funciona', href: '#beneficios' },
      { label: 'Reseñas', href: '#testimonios' },
    ],
    ctaText: 'Comprar',
    ctaUrl: '/products',
    bg: '#ffffff',
    text: '#0f0f0f',
    ctaBg: '#07A498',
  },
  defaultVisible: { cta: true },
  schema: {
    logoText: { kind: 'text', label: 'Logo text', group: 'content' },
    links: { kind: 'textarea', label: 'Links (JSON)', group: 'content', hint: 'Array de {label,href}' },
    ctaText: { kind: 'text', label: 'CTA Text', group: 'button' },
    ctaUrl: { kind: 'url', label: 'CTA URL', group: 'button' },
    bg: { kind: 'color', label: 'Background', group: 'colors' },
    text: { kind: 'color', label: 'Text', group: 'colors' },
    ctaBg: { kind: 'color', label: 'Button', group: 'colors' },
  },
  Component: Navigation01,
  renderHtml: ({ values, theme, visible }) => {
    const bg = color(values, 'bg', theme.bg, '#ffffff');
    const text = color(values, 'text', undefined, '#0f0f0f');
    const ctaBg = color(values, 'ctaBg', theme.primary, '#07A498');
    const linksList = links(values.links);
    const showCta = b(visible, 'cta');

    return `
<header style="background:${bg};color:${text};border-bottom:1px solid rgba(0,0,0,0.05);padding:16px 24px;">
  <div style="max-width:1152px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:24px;">
    <a href="/" style="font-weight:700;font-size:18px;text-decoration:none;color:inherit;">${escapeHtml(s(values, 'logoText'))}</a>
    <nav style="display:flex;gap:24px;font-size:14px;">
      ${linksList.map((l) => `<a href="${escapeHtml(l.href)}" style="opacity:0.7;text-decoration:none;color:inherit;">${escapeHtml(l.label)}</a>`).join('')}
    </nav>
    ${showCta ? `<a href="${escapeHtml(s(values, 'ctaUrl', '/products'))}" style="background:${ctaBg};color:#fff;padding:8px 20px;border-radius:9999px;font-size:14px;font-weight:600;text-decoration:none;">${escapeHtml(s(values, 'ctaText', 'Comprar'))}</a>` : ''}
  </div>
</header>`.trim();
  },
};
