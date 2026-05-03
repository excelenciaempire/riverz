/**
 * Banners 01 — barra de anuncio fina con texto + botón. Para "STOCK
 * LIMITADO", garantías, envío gratis arriba/abajo de la página.
 */
import type { SectionDefinition, SectionRenderProps } from '../types';
import { escapeHtml, s, b, color } from '../_helpers';

const TYPE = 'banners-01';

function Banners01({ values, theme, visible }: SectionRenderProps) {
  const bg = color(values, 'bg', theme.bg, '#0f0f0f');
  const text = color(values, 'text', undefined, '#ffffff');
  const ctaBg = color(values, 'ctaBg', theme.primary, '#07A498');

  return (
    <section style={{ background: bg, color: text }} className="px-6 py-3 text-center">
      <div className="mx-auto flex max-w-5xl items-center justify-center gap-4 text-sm">
        <span>{s(values, 'message', '🚚 Envío gratis en pedidos +$50.000 — Hoy únicamente.')}</span>
        {b(visible, 'cta') && (
          <a
            href={s(values, 'ctaUrl', '/products')}
            style={{ background: ctaBg, color: '#fff' }}
            className="rounded-full px-3 py-1 text-xs font-semibold uppercase"
          >
            {s(values, 'ctaText', 'Ver')}
          </a>
        )}
      </div>
    </section>
  );
}

export const definition: SectionDefinition = {
  type: TYPE,
  category: 'banners',
  name: 'Banners 01',
  description: 'Barra anuncio fina con CTA. Top o bottom.',
  thumbnail: '/sections/banners-01.jpg',
  defaultProps: {
    message: '🚚 Envío gratis en pedidos +$50.000 — Hoy únicamente.',
    ctaText: 'Ver',
    ctaUrl: '/products',
    bg: '#0f0f0f',
    text: '#ffffff',
    ctaBg: '#07A498',
  },
  defaultVisible: { cta: false },
  schema: {
    message: { kind: 'text', label: 'Mensaje', group: 'content', aiFillable: true },
    ctaText: { kind: 'text', label: 'CTA Text', group: 'button' },
    ctaUrl: { kind: 'url', label: 'CTA URL', group: 'button' },
    bg: { kind: 'color', label: 'Background', group: 'colors' },
    text: { kind: 'color', label: 'Text', group: 'colors' },
    ctaBg: { kind: 'color', label: 'Button', group: 'colors' },
  },
  aiPromptHint: 'Una sola línea (5-10 palabras) con urgencia o garantía. Puede usar emoji.',
  Component: Banners01,
  renderHtml: ({ values, theme, visible }) => {
    const bg = color(values, 'bg', theme.bg, '#0f0f0f');
    const text = color(values, 'text', undefined, '#ffffff');
    const ctaBg = color(values, 'ctaBg', theme.primary, '#07A498');
    const showCta = b(visible, 'cta', false);

    return `
<section style="background:${bg};color:${text};padding:12px 24px;text-align:center;">
  <div style="max-width:960px;margin:0 auto;display:flex;align-items:center;justify-content:center;gap:16px;font-size:14px;">
    <span>${escapeHtml(s(values, 'message'))}</span>
    ${showCta ? `<a href="${escapeHtml(s(values, 'ctaUrl', '/products'))}" style="background:${ctaBg};color:#fff;padding:4px 12px;border-radius:9999px;font-size:12px;font-weight:600;text-transform:uppercase;text-decoration:none;">${escapeHtml(s(values, 'ctaText', 'Ver'))}</a>` : ''}
  </div>
</section>`.trim();
  },
};
