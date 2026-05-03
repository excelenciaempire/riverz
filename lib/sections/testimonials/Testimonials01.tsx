/**
 * Testimonials 01 — grid de 3 quote cards con estrellas, texto, autor.
 * El patrón más usado para social proof en landings.
 */
import type { SectionDefinition, SectionRenderProps } from '../types';
import { escapeHtml, s, color } from '../_helpers';

const TYPE = 'testimonials-01';

interface Quote {
  stars?: number;
  text: string;
  author: string;
  role?: string;
}

function quotes(raw: unknown): Quote[] {
  if (Array.isArray(raw)) return raw.filter((x) => typeof x === 'object' && x) as Quote[];
  return [];
}

function Testimonials01({ values, theme }: SectionRenderProps) {
  const bg = color(values, 'bg', theme.bg, '#0a0a0a');
  const text = color(values, 'text', undefined, '#ffffff');
  const cardBg = color(values, 'cardBg', undefined, 'rgba(255,255,255,0.05)');

  return (
    <section style={{ background: bg, color: text }} className="px-6 py-20">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-center text-3xl font-bold md:text-4xl">{s(values, 'heading', 'Lo que dicen quienes ya lo prueban.')}</h2>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {quotes(values.quotes).map((q, i) => (
            <div key={i} style={{ background: cardBg }} className="rounded-2xl p-6">
              <div className="text-yellow-400">{'★'.repeat(q.stars ?? 5)}</div>
              <p className="mt-4 text-base leading-relaxed">"{q.text}"</p>
              <p className="mt-6 text-sm font-semibold">{q.author}</p>
              {q.role && <p className="text-xs opacity-70">{q.role}</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export const definition: SectionDefinition = {
  type: TYPE,
  category: 'testimonials',
  name: 'Testimonials 01',
  description: 'Grid 3 cards con estrellas + quote + autor.',
  thumbnail: '/sections/testimonials-01.jpg',
  defaultProps: {
    heading: 'Lo que dicen quienes ya lo prueban.',
    quotes: [
      { stars: 5, text: 'Mis mañanas cambiaron. Por fin tengo energía constante sin nerviosismo.', author: 'Carlos M.', role: 'Verificado' },
      { stars: 5, text: 'Entreno más fuerte, recupero más rápido. Y no afecta mi sueño.', author: 'Lucía P.', role: 'Verificado' },
      { stars: 5, text: 'Ingredientes limpios y resultados reales. Vale cada peso.', author: 'Daniel R.', role: 'Verificado' },
    ],
    bg: '#0a0a0a',
    text: '#ffffff',
    cardBg: 'rgba(255,255,255,0.05)',
  },
  schema: {
    heading: { kind: 'text', label: 'Heading', group: 'content', aiFillable: true },
    quotes: { kind: 'textarea', label: 'Quotes (JSON)', group: 'content', hint: '{ stars, text, author, role }[]', aiFillable: true },
    bg: { kind: 'color', label: 'Background', group: 'colors' },
    text: { kind: 'color', label: 'Text', group: 'colors' },
    cardBg: { kind: 'color', label: 'Card', group: 'colors' },
  },
  aiPromptHint: 'Heading (5-9 palabras). 3 testimonios cortos (15-25 palabras cada uno) con autor (nombre + apellido inicial).',
  Component: Testimonials01,
  renderHtml: ({ values, theme }) => {
    const bg = color(values, 'bg', theme.bg, '#0a0a0a');
    const text = color(values, 'text', undefined, '#ffffff');
    const cardBg = color(values, 'cardBg', undefined, 'rgba(255,255,255,0.05)');
    const list = quotes(values.quotes);

    return `
<section style="background:${bg};color:${text};padding:80px 24px;">
  <div style="max-width:1152px;margin:0 auto;">
    <h2 style="text-align:center;font-size:32px;font-weight:700;margin:0;">${escapeHtml(s(values, 'heading'))}</h2>
    <div style="margin-top:48px;display:grid;gap:24px;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));">
      ${list.map((q) => `
      <div style="background:${cardBg};border-radius:16px;padding:24px;">
        <div style="color:#facc15;">${'★'.repeat(q.stars ?? 5)}</div>
        <p style="margin:16px 0 0;font-size:16px;line-height:1.6;">"${escapeHtml(q.text || '')}"</p>
        <p style="margin:24px 0 0;font-size:14px;font-weight:600;">${escapeHtml(q.author || '')}</p>
        ${q.role ? `<p style="margin:0;font-size:12px;opacity:0.7;">${escapeHtml(q.role)}</p>` : ''}
      </div>`).join('')}
    </div>
  </div>
</section>`.trim();
  },
};
