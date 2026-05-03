/**
 * Hero 03 — banner con badge de oferta arriba, headline corto, 3 bullet
 * points con check, CTA principal y "as seen in" logos. Patrón clásico
 * supplement DTC (AG1, Magic Mind…).
 */
import type { SectionDefinition, SectionRenderProps } from '../types';
import { escapeHtml, s, b, color } from '../_helpers';

const TYPE = 'hero-03';

function bullets(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((x) => typeof x === 'string') as string[];
  if (typeof raw === 'string') return raw.split('\n').filter(Boolean);
  return [];
}

function Hero03({ values, theme, visible }: SectionRenderProps) {
  const bg = color(values, 'bg', theme.bg, '#0f1715');
  const text = color(values, 'text', undefined, '#ffffff');
  const ctaBg = color(values, 'ctaBg', theme.primary, '#07A498');

  return (
    <section style={{ background: bg, color: text }} className="px-6 py-20 text-center">
      {b(visible, 'badge') && (
        <span className="mb-6 inline-block rounded-full border border-white/20 px-4 py-1 text-xs uppercase tracking-widest">
          {s(values, 'badge', 'Oferta de lanzamiento • -25%')}
        </span>
      )}
      <h1 className="mx-auto max-w-3xl text-4xl font-bold leading-tight md:text-6xl">
        {s(values, 'headline', 'Energía limpia para tus mañanas.')}
      </h1>
      <ul className="mx-auto mt-8 grid max-w-xl gap-3 text-left text-base">
        {bullets(values.bullets).map((bullet, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="mt-0.5 text-green-400">✓</span>
            <span>{bullet}</span>
          </li>
        ))}
      </ul>
      {b(visible, 'cta') && (
        <a
          href={s(values, 'ctaUrl', '/products')}
          style={{ background: ctaBg, color: '#fff' }}
          className="mt-10 inline-block rounded-full px-8 py-4 font-semibold uppercase tracking-wide"
        >
          {s(values, 'ctaText', 'Probarlo hoy')}
        </a>
      )}
    </section>
  );
}

export const definition: SectionDefinition = {
  type: TYPE,
  category: 'hero',
  name: 'Hero 03',
  description: 'Badge oferta + headline + bullets + CTA. Estilo supplement DTC.',
  thumbnail: '/sections/hero-03.jpg',
  defaultProps: {
    badge: 'Oferta de lanzamiento • -25%',
    headline: 'Energía limpia para tus mañanas.',
    bullets: [
      'Sin bajones de azúcar',
      'Adaptógenos clínicamente probados',
      'Listo en 30 segundos',
    ],
    ctaText: 'Probarlo hoy',
    ctaUrl: '/products',
    bg: '#0f1715',
    text: '#ffffff',
    ctaBg: '#07A498',
  },
  defaultVisible: { badge: true, cta: true },
  schema: {
    badge: { kind: 'text', label: 'Badge text', group: 'content', aiFillable: true },
    headline: { kind: 'text', label: 'Headline', group: 'content', aiFillable: true },
    bullets: { kind: 'textarea', label: 'Bullets (uno por línea)', group: 'content', aiFillable: true },
    ctaText: { kind: 'text', label: 'CTA Text', group: 'button' },
    ctaUrl: { kind: 'url', label: 'CTA URL', group: 'button' },
    bg: { kind: 'color', label: 'Background', group: 'colors' },
    text: { kind: 'color', label: 'Text', group: 'colors' },
    ctaBg: { kind: 'color', label: 'Button', group: 'colors' },
  },
  aiPromptHint:
    'Hero estilo supplement DTC: badge corto (5-8 palabras) con oferta, headline (5-9 palabras), 3 bullets con beneficios concretos (5-9 palabras cada uno), y CTA imperativo (2-4 palabras).',
  Component: Hero03,
  renderHtml: ({ values, theme, visible }) => {
    const bg = color(values, 'bg', theme.bg, '#0f1715');
    const text = color(values, 'text', undefined, '#ffffff');
    const ctaBg = color(values, 'ctaBg', theme.primary, '#07A498');
    const list = bullets(values.bullets);
    const showBadge = b(visible, 'badge');
    const showCta = b(visible, 'cta');

    return `
<section style="background:${bg};color:${text};padding:80px 24px;text-align:center;">
  ${showBadge ? `<span style="display:inline-block;margin-bottom:24px;border:1px solid rgba(255,255,255,0.2);border-radius:9999px;padding:4px 16px;font-size:12px;letter-spacing:0.15em;text-transform:uppercase;">${escapeHtml(s(values, 'badge'))}</span>` : ''}
  <h1 style="max-width:768px;margin:0 auto;font-size:48px;font-weight:700;line-height:1.1;">${escapeHtml(s(values, 'headline'))}</h1>
  <ul style="max-width:560px;margin:32px auto 0;padding:0;list-style:none;text-align:left;display:grid;gap:12px;">
    ${list.map((line) => `<li style="display:flex;gap:12px;align-items:flex-start;"><span style="color:#34d399;">✓</span><span>${escapeHtml(line)}</span></li>`).join('')}
  </ul>
  ${showCta ? `<a href="${escapeHtml(s(values, 'ctaUrl', '/products'))}" style="display:inline-block;margin-top:40px;background:${ctaBg};color:#fff;padding:16px 32px;border-radius:9999px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;text-decoration:none;font-size:14px;">${escapeHtml(s(values, 'ctaText', 'Probarlo hoy'))}</a>` : ''}
</section>`.trim();
  },
};
