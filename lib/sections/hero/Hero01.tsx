/**
 * Hero 01 — clásico: imagen full-bleed, headline grande, subheadline, CTA,
 * mini-strip de social proof (estrellas + reseñas count). Buen default
 * para landing pages de producto con tráfico cold.
 */
import type { SectionDefinition, SectionRenderProps } from '../types';
import { escapeHtml, s, b, color } from '../_helpers';

const TYPE = 'hero-01';

function HeroComponent({ values, theme, visible }: SectionRenderProps) {
  const bg = color(values, 'bg', theme.bg, '#0a0a0a');
  const text = color(values, 'text', undefined, '#ffffff');
  const ctaBg = color(values, 'ctaBg', theme.primary, '#07A498');
  const ctaText = color(values, 'ctaText', undefined, '#ffffff');

  return (
    <section
      style={{ background: bg, color: text }}
      className="px-6 py-20 md:py-32"
    >
      <div className="mx-auto max-w-3xl text-center">
        {b(visible, 'rating') && (
          <div className="mb-4 inline-flex items-center gap-2 text-sm opacity-80">
            <span>★★★★★</span>
            <span>{s(values, 'rating', '4.9/5 basado en 25,000+ reseñas')}</span>
          </div>
        )}
        <h1 className="text-4xl font-bold leading-tight md:text-6xl">
          {s(values, 'headline', 'Tu mejor versión empieza aquí.')}
        </h1>
        {b(visible, 'subheadline') && (
          <p className="mx-auto mt-4 max-w-2xl text-lg opacity-80 md:text-xl">
            {s(
              values,
              'subheadline',
              'Domina tu energía y acelera tu recuperación con nuestra fórmula orgánica certificada.',
            )}
          </p>
        )}
        {b(visible, 'cta') && (
          <a
            href={s(values, 'ctaUrl', '/products')}
            style={{ background: ctaBg, color: ctaText }}
            className="mt-8 inline-block rounded-full px-8 py-4 text-base font-semibold uppercase tracking-wide"
          >
            {s(values, 'ctaText', 'Empezar ahora')}
          </a>
        )}
      </div>
    </section>
  );
}

export const definition: SectionDefinition = {
  type: TYPE,
  category: 'hero',
  name: 'Hero 01',
  description: 'Centrado, social proof + CTA. Default seguro.',
  thumbnail: '/sections/hero-01.jpg',
  defaultProps: {
    headline: 'Tu mejor versión empieza aquí.',
    subheadline:
      'Domina tu energía y acelera tu recuperación con nuestra fórmula orgánica certificada.',
    ctaText: 'Empezar ahora',
    ctaUrl: '/products',
    rating: '4.9/5 basado en 25,000+ reseñas',
    bg: '#0a0a0a',
    text: '#ffffff',
    ctaBg: '#07A498',
    ctaText_color: '#ffffff',
  },
  defaultVisible: { rating: true, subheadline: true, cta: true },
  schema: {
    headline: { kind: 'text', label: 'Headline', group: 'content', aiFillable: true },
    subheadline: { kind: 'textarea', label: 'Subheadline', group: 'content', aiFillable: true },
    ctaText: { kind: 'text', label: 'CTA Text', group: 'button' },
    ctaUrl: { kind: 'url', label: 'CTA URL', group: 'button' },
    rating: { kind: 'text', label: 'Rating text', group: 'content' },
    bg: { kind: 'color', label: 'Background', group: 'colors' },
    text: { kind: 'color', label: 'Text', group: 'colors' },
    ctaBg: { kind: 'color', label: 'Button bg', group: 'colors' },
    ctaText_color: { kind: 'color', label: 'Button text', group: 'colors' },
  },
  aiPromptHint:
    'Hero principal con headline grande (8-12 palabras), subheadline (15-25 palabras) y un CTA imperativo corto (2-4 palabras).',
  Component: HeroComponent,
  renderHtml: ({ values, theme, visible }) => {
    const bg = color(values, 'bg', theme.bg, '#0a0a0a');
    const text = color(values, 'text', undefined, '#ffffff');
    const ctaBg = color(values, 'ctaBg', theme.primary, '#07A498');
    const ctaText = color(values, 'ctaText_color', undefined, '#ffffff');
    const showRating = b(visible, 'rating');
    const showSub = b(visible, 'subheadline');
    const showCta = b(visible, 'cta');

    return `
<section style="background:${bg};color:${text};padding:80px 24px;">
  <div style="max-width:768px;margin:0 auto;text-align:center;">
    ${showRating ? `<div style="margin-bottom:16px;font-size:14px;opacity:0.8;">★★★★★ &nbsp; ${escapeHtml(s(values, 'rating'))}</div>` : ''}
    <h1 style="font-size:48px;font-weight:700;line-height:1.1;margin:0;">${escapeHtml(s(values, 'headline'))}</h1>
    ${showSub ? `<p style="margin:16px auto 0;max-width:640px;font-size:18px;opacity:0.8;">${escapeHtml(s(values, 'subheadline'))}</p>` : ''}
    ${showCta ? `<a href="${escapeHtml(s(values, 'ctaUrl', '/products'))}" style="display:inline-block;margin-top:32px;background:${ctaBg};color:${ctaText};padding:16px 32px;border-radius:9999px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;text-decoration:none;font-size:14px;">${escapeHtml(s(values, 'ctaText', 'Empezar ahora'))}</a>` : ''}
  </div>
</section>`.trim();
  },
};
