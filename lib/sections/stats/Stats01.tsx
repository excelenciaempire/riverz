/**
 * Stats 01 — banda con 3-4 números grandes (47K clientes, 4.9★, etc.).
 * Banner de autoridad: rápido de leer, alta densidad de social proof.
 */
import type { SectionDefinition, SectionRenderProps } from '../types';
import { escapeHtml, s, color } from '../_helpers';

const TYPE = 'stats-01';

interface Stat {
  number: string;
  label: string;
}

function stats(raw: unknown): Stat[] {
  if (Array.isArray(raw)) return raw.filter((x) => typeof x === 'object' && x) as Stat[];
  return [];
}

function Stats01({ values, theme }: SectionRenderProps) {
  const bg = color(values, 'bg', theme.bg, '#07A498');
  const text = color(values, 'text', undefined, '#ffffff');

  return (
    <section style={{ background: bg, color: text }} className="px-6 py-12">
      <div className="mx-auto grid max-w-5xl gap-8 text-center md:grid-cols-4">
        {stats(values.stats).map((st, i) => (
          <div key={i}>
            <div className="text-4xl font-bold md:text-5xl">{st.number}</div>
            <div className="mt-1 text-sm uppercase tracking-wider opacity-80">{st.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

export const definition: SectionDefinition = {
  type: TYPE,
  category: 'stats',
  name: 'Stats 01',
  description: 'Banda de 4 stats grandes. Banner de autoridad.',
  thumbnail: '/sections/stats-01.jpg',
  defaultProps: {
    stats: [
      { number: '47,000+', label: 'Clientes felices' },
      { number: '4.9★', label: 'Trustpilot rating' },
      { number: '98%', label: 'Reordenan' },
      { number: '100%', label: 'Garantía' },
    ],
    bg: '#07A498',
    text: '#ffffff',
  },
  schema: {
    stats: { kind: 'textarea', label: 'Stats (JSON)', group: 'content', hint: '{ number, label }[]', aiFillable: true },
    bg: { kind: 'color', label: 'Background', group: 'colors' },
    text: { kind: 'color', label: 'Text', group: 'colors' },
  },
  aiPromptHint: '4 stats: cada uno con un número impactante (con sufijo K/+/%/★) y label corto (2-3 palabras).',
  Component: Stats01,
  renderHtml: ({ values, theme }) => {
    const bg = color(values, 'bg', theme.bg, '#07A498');
    const text = color(values, 'text', undefined, '#ffffff');
    const list = stats(values.stats);

    return `
<section style="background:${bg};color:${text};padding:48px 24px;">
  <div style="max-width:960px;margin:0 auto;display:grid;gap:32px;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));text-align:center;">
    ${list.map((st) => `
    <div>
      <div style="font-size:40px;font-weight:700;">${escapeHtml(st.number || '')}</div>
      <div style="margin-top:4px;font-size:13px;text-transform:uppercase;letter-spacing:0.1em;opacity:0.8;">${escapeHtml(st.label || '')}</div>
    </div>`).join('')}
  </div>
</section>`.trim();
  },
};
