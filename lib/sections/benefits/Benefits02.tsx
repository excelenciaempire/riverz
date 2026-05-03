/**
 * Benefits 02 — lista vertical alternada (left/right) con imagen y texto.
 * Funciona bien para "deep dive" de cada beneficio en landings largas.
 */
import type { SectionDefinition, SectionRenderProps } from '../types';
import { escapeHtml, s, color } from '../_helpers';

const TYPE = 'benefits-02';

interface Item {
  title: string;
  body: string;
  image?: string;
}

function items(raw: unknown): Item[] {
  if (Array.isArray(raw)) return raw.filter((x) => typeof x === 'object' && x) as Item[];
  return [];
}

function Benefits02({ values, theme }: SectionRenderProps) {
  const bg = color(values, 'bg', theme.bg, '#fafafa');
  const text = color(values, 'text', undefined, '#0f0f0f');

  return (
    <section style={{ background: bg, color: text }} className="px-6 py-20">
      <div className="mx-auto max-w-5xl space-y-16">
        <h2 className="text-center text-3xl font-bold md:text-4xl">{s(values, 'heading', 'Lo que cambia en tu día.')}</h2>
        {items(values.items).map((it, i) => (
          <div key={i} className={`grid items-center gap-10 md:grid-cols-2 ${i % 2 ? 'md:[&>div:first-child]:order-2' : ''}`}>
            <div
              className="aspect-[4/3] rounded-2xl bg-black/10 bg-cover bg-center"
              style={{ backgroundImage: it.image ? `url(${it.image})` : undefined }}
            />
            <div>
              <h3 className="text-2xl font-bold md:text-3xl">{it.title}</h3>
              <p className="mt-3 text-base opacity-80">{it.body}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export const definition: SectionDefinition = {
  type: TYPE,
  category: 'benefits',
  name: 'Benefits 02',
  description: 'Lista vertical alternada con imagen + texto. Para deep dives.',
  thumbnail: '/sections/benefits-02.jpg',
  defaultProps: {
    heading: 'Lo que cambia en tu día.',
    items: [
      { title: 'Mañanas claras', body: 'Despierta enfocado, sin necesidad del segundo café.', image: '' },
      { title: 'Tardes sin caída', body: 'Energía pareja, sin la sensación de "pared" a las 3pm.', image: '' },
      { title: 'Noches reparadoras', body: 'Sin estimulantes sintéticos: tu sueño no se altera.', image: '' },
    ],
    bg: '#fafafa',
    text: '#0f0f0f',
  },
  schema: {
    heading: { kind: 'text', label: 'Heading', group: 'content', aiFillable: true },
    items: { kind: 'textarea', label: 'Items (JSON)', group: 'content', hint: '{ title, body, image }[]', aiFillable: true },
    bg: { kind: 'color', label: 'Background', group: 'colors' },
    text: { kind: 'color', label: 'Text', group: 'colors' },
  },
  aiPromptHint: 'Heading (4-7 palabras), 3 ítems. Cada uno con título (2-4 palabras) y body (12-20 palabras).',
  Component: Benefits02,
  renderHtml: ({ values, theme }) => {
    const bg = color(values, 'bg', theme.bg, '#fafafa');
    const text = color(values, 'text', undefined, '#0f0f0f');
    const list = items(values.items);

    return `
<section style="background:${bg};color:${text};padding:80px 24px;">
  <div style="max-width:960px;margin:0 auto;">
    <h2 style="text-align:center;font-size:32px;font-weight:700;margin:0 0 64px;">${escapeHtml(s(values, 'heading'))}</h2>
    ${list.map((it, i) => {
      const img = `<div style="aspect-ratio:4/3;border-radius:16px;background:${it.image ? `url(${escapeHtml(it.image)}) center/cover` : 'rgba(0,0,0,0.08)'};"></div>`;
      const txt = `<div><h3 style="font-size:24px;font-weight:700;margin:0;">${escapeHtml(it.title || '')}</h3><p style="margin:12px 0 0;font-size:16px;opacity:0.8;">${escapeHtml(it.body || '')}</p></div>`;
      const order = i % 2 ? `${txt}${img}` : `${img}${txt}`;
      return `<div style="display:grid;gap:40px;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));align-items:center;margin-top:${i === 0 ? '0' : '64px'};">${order}</div>`;
    }).join('')}
  </div>
</section>`.trim();
  },
};
