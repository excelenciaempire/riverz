/**
 * Hero 02 — split: imagen del producto a la derecha, copy + CTA a la izquierda.
 * Layout switchable Desktop (Media Left/Right) + Mobile (Media Top/Bottom),
 * lo cual es un patrón EcomWize muy usado.
 */
import type { SectionDefinition, SectionRenderProps } from '../types';
import { escapeHtml, s, b, color } from '../_helpers';

const TYPE = 'hero-02';

function Hero02({ values, theme, visible }: SectionRenderProps) {
  const bg = color(values, 'bg', theme.bg, '#fff8ef');
  const text = color(values, 'text', undefined, '#0f0f0f');
  const ctaBg = color(values, 'ctaBg', theme.primary, '#07A498');
  const layout = (values.layout as string) ?? 'media-right';
  const isLeft = layout === 'media-left';

  return (
    <section style={{ background: bg, color: text }} className="px-6 py-16">
      <div
        className={`mx-auto grid max-w-6xl items-center gap-10 md:grid-cols-2 ${isLeft ? '' : 'md:[&>div:first-child]:order-2'}`}
      >
        <div className="aspect-[4/3] rounded-2xl bg-black/10 bg-cover bg-center" style={{ backgroundImage: values.image ? `url(${values.image})` : undefined }} />
        <div>
          <h2 className="text-3xl font-bold leading-tight md:text-5xl">
            {s(values, 'headline', 'La fórmula que estabas buscando.')}
          </h2>
          {b(visible, 'subheadline') && (
            <p className="mt-4 text-base opacity-80 md:text-lg">
              {s(values, 'subheadline', 'Ingredientes RAW de origen ético, certificados orgánicos.')}
            </p>
          )}
          {b(visible, 'cta') && (
            <a
              href={s(values, 'ctaUrl', '/products')}
              style={{ background: ctaBg, color: '#fff' }}
              className="mt-6 inline-block rounded-full px-7 py-3 font-semibold uppercase tracking-wide"
            >
              {s(values, 'ctaText', 'Quiero el mío')}
            </a>
          )}
        </div>
      </div>
    </section>
  );
}

export const definition: SectionDefinition = {
  type: TYPE,
  category: 'hero',
  name: 'Hero 02',
  description: 'Split: imagen + copy/CTA. Configurable Media Left/Right.',
  thumbnail: '/sections/hero-02.jpg',
  defaultProps: {
    layout: 'media-right',
    headline: 'La fórmula que estabas buscando.',
    subheadline: 'Ingredientes RAW de origen ético, certificados orgánicos.',
    ctaText: 'Quiero el mío',
    ctaUrl: '/products',
    image: '',
    bg: '#fff8ef',
    text: '#0f0f0f',
    ctaBg: '#07A498',
  },
  defaultVisible: { subheadline: true, cta: true },
  schema: {
    layout: {
      kind: 'select',
      label: 'Desktop layout',
      group: 'layout',
      options: [
        { value: 'media-left', label: 'Media Left' },
        { value: 'media-right', label: 'Media Right' },
      ],
    },
    headline: { kind: 'text', label: 'Headline', group: 'content', aiFillable: true },
    subheadline: { kind: 'textarea', label: 'Subheadline', group: 'content', aiFillable: true },
    image: { kind: 'image', label: 'Image', group: 'content', recommended: '1200×900px' },
    ctaText: { kind: 'text', label: 'CTA Text', group: 'button' },
    ctaUrl: { kind: 'url', label: 'CTA URL', group: 'button' },
    bg: { kind: 'color', label: 'Background', group: 'colors' },
    text: { kind: 'color', label: 'Text', group: 'colors' },
    ctaBg: { kind: 'color', label: 'Button', group: 'colors' },
  },
  aiPromptHint:
    'Hero split con headline (8-12 palabras), subheadline (15-25 palabras) sobre el beneficio principal del producto, y CTA imperativo (2-4 palabras).',
  Component: Hero02,
  renderHtml: ({ values, theme, visible }) => {
    const bg = color(values, 'bg', theme.bg, '#fff8ef');
    const text = color(values, 'text', undefined, '#0f0f0f');
    const ctaBg = color(values, 'ctaBg', theme.primary, '#07A498');
    const layout = (values.layout as string) ?? 'media-right';
    const img = s(values, 'image');
    const showSub = b(visible, 'subheadline');
    const showCta = b(visible, 'cta');

    const imageBlock = img
      ? `<div style="aspect-ratio:4/3;border-radius:16px;background-image:url(${escapeHtml(img)});background-size:cover;background-position:center;"></div>`
      : `<div style="aspect-ratio:4/3;border-radius:16px;background:rgba(0,0,0,0.08);"></div>`;
    const textBlock = `
      <div>
        <h2 style="font-size:40px;font-weight:700;line-height:1.1;margin:0;">${escapeHtml(s(values, 'headline'))}</h2>
        ${showSub ? `<p style="margin:16px 0 0;font-size:18px;opacity:0.8;">${escapeHtml(s(values, 'subheadline'))}</p>` : ''}
        ${showCta ? `<a href="${escapeHtml(s(values, 'ctaUrl', '/products'))}" style="display:inline-block;margin-top:24px;background:${ctaBg};color:#fff;padding:12px 28px;border-radius:9999px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;text-decoration:none;font-size:14px;">${escapeHtml(s(values, 'ctaText', 'Quiero el mío'))}</a>` : ''}
      </div>`;

    const order = layout === 'media-left' ? `${imageBlock}${textBlock}` : `${textBlock}${imageBlock}`;
    return `
<section style="background:${bg};color:${text};padding:64px 24px;">
  <div style="max-width:1152px;margin:0 auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:40px;align-items:center;">
    ${order}
  </div>
</section>`.trim();
  },
};
