/**
 * Benefits 01 — grid de 3 columnas con icono + título + descripción.
 * El "qué te llevas" estándar para cualquier landing.
 */
import type { SectionDefinition, SectionRenderProps } from '../types';
import { escapeHtml, s, color } from '../_helpers';

const TYPE = 'benefits-01';

interface Item {
  icon: string;
  title: string;
  body: string;
}

function items(raw: unknown): Item[] {
  if (Array.isArray(raw)) return raw.filter((x) => typeof x === 'object' && x) as Item[];
  return [];
}

function Benefits01({ values, theme }: SectionRenderProps) {
  const bg = color(values, 'bg', theme.bg, '#ffffff');
  const text = color(values, 'text', undefined, '#0f0f0f');
  const accent = color(values, 'accent', theme.primary, '#07A498');

  return (
    <section style={{ background: bg, color: text }} className="px-6 py-16">
      <div className="mx-auto max-w-5xl text-center">
        <h2 className="text-3xl font-bold md:text-4xl">{s(values, 'heading', 'Por qué funciona.')}</h2>
        <div className="mt-12 grid gap-10 md:grid-cols-3">
          {items(values.items).map((it, i) => (
            <div key={i}>
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full text-xl" style={{ background: accent, color: '#fff' }}>
                {it.icon || '✓'}
              </div>
              <h3 className="text-lg font-semibold">{it.title}</h3>
              <p className="mt-2 text-sm opacity-75">{it.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export const definition: SectionDefinition = {
  type: TYPE,
  category: 'benefits',
  name: 'Benefits 01',
  description: 'Grid 3 columnas con icono. Default seguro.',
  thumbnail: '/sections/benefits-01.jpg',
  defaultProps: {
    heading: 'Por qué funciona.',
    items: [
      { icon: '⚡', title: 'Energía sostenida', body: 'Sin bajones ni nerviosismo durante 8 horas.' },
      { icon: '🌿', title: 'Ingredientes RAW', body: 'Origen ético, certificación orgánica, cero rellenos.' },
      { icon: '🔬', title: 'Respaldo clínico', body: 'Adaptógenos en dosis estudiadas. Sin marketing vacío.' },
    ],
    bg: '#ffffff',
    text: '#0f0f0f',
    accent: '#07A498',
  },
  schema: {
    heading: { kind: 'text', label: 'Heading', group: 'content', aiFillable: true },
    items: { kind: 'textarea', label: 'Items (JSON)', group: 'content', hint: '{ icon, title, body }[]', aiFillable: true },
    bg: { kind: 'color', label: 'Background', group: 'colors' },
    text: { kind: 'color', label: 'Text', group: 'colors' },
    accent: { kind: 'color', label: 'Accent', group: 'colors' },
  },
  aiPromptHint:
    'Heading corto (4-7 palabras), 3 beneficios concretos. Cada uno con título (3-5 palabras) y body (10-18 palabras).',
  Component: Benefits01,
  renderHtml: ({ values, theme }) => {
    const bg = color(values, 'bg', theme.bg, '#ffffff');
    const text = color(values, 'text', undefined, '#0f0f0f');
    const accent = color(values, 'accent', theme.primary, '#07A498');
    const list = items(values.items);

    return `
<section style="background:${bg};color:${text};padding:64px 24px;">
  <div style="max-width:960px;margin:0 auto;text-align:center;">
    <h2 style="font-size:32px;font-weight:700;margin:0;">${escapeHtml(s(values, 'heading'))}</h2>
    <div style="margin-top:48px;display:grid;gap:40px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));">
      ${list.map((it) => `
      <div>
        <div style="margin:0 auto 16px;width:48px;height:48px;border-radius:9999px;background:${accent};color:#fff;display:flex;align-items:center;justify-content:center;font-size:20px;">${escapeHtml(it.icon || '✓')}</div>
        <h3 style="font-size:18px;font-weight:600;margin:0;">${escapeHtml(it.title || '')}</h3>
        <p style="margin:8px 0 0;font-size:14px;opacity:0.75;">${escapeHtml(it.body || '')}</p>
      </div>`).join('')}
    </div>
  </div>
</section>`.trim();
  },
};
