/**
 * FAQs 01 — acordeón clásico. Cada item es una pregunta + respuesta.
 * En el canvas se renderiza siempre abierto (para que el usuario edite
 * todo); en el publish HTML usamos <details>/<summary> nativo (sin JS,
 * funciona en cualquier theme Shopify).
 */
import type { SectionDefinition, SectionRenderProps } from '../types';
import { escapeHtml, s, color } from '../_helpers';

const TYPE = 'faqs-01';

interface QA {
  q: string;
  a: string;
}

function qas(raw: unknown): QA[] {
  if (Array.isArray(raw)) return raw.filter((x) => typeof x === 'object' && x) as QA[];
  return [];
}

function Faqs01({ values, theme }: SectionRenderProps) {
  const bg = color(values, 'bg', theme.bg, '#ffffff');
  const text = color(values, 'text', undefined, '#0f0f0f');

  return (
    <section style={{ background: bg, color: text }} className="px-6 py-16">
      <div className="mx-auto max-w-2xl">
        <h2 className="text-center text-3xl font-bold md:text-4xl">{s(values, 'heading', 'Preguntas frecuentes')}</h2>
        <div className="mt-10 divide-y divide-black/10">
          {qas(values.items).map((qa, i) => (
            <details key={i} className="group py-5" open={i === 0}>
              <summary className="flex cursor-pointer items-center justify-between text-base font-semibold">
                <span>{qa.q}</span>
                <span className="ml-4 transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-sm opacity-80">{qa.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export const definition: SectionDefinition = {
  type: TYPE,
  category: 'faqs',
  name: 'FAQs 01',
  description: 'Acordeón nativo (details/summary). Sin JS extra.',
  thumbnail: '/sections/faqs-01.jpg',
  defaultProps: {
    heading: 'Preguntas frecuentes',
    items: [
      { q: '¿Cuándo empiezo a sentir resultados?', a: 'La mayoría reporta más energía en los primeros 7 días y mejoras claras al mes.' },
      { q: '¿Qué pasa si no me funciona?', a: 'Te devolvemos el dinero. 30 días, sin preguntas.' },
      { q: '¿Cómo lo tomo?', a: 'Una cucharada en agua o tu batido favorito, 15 min antes de entrenar o desayunar.' },
    ],
    bg: '#ffffff',
    text: '#0f0f0f',
  },
  schema: {
    heading: { kind: 'text', label: 'Heading', group: 'content' },
    items: { kind: 'textarea', label: 'FAQs (JSON)', group: 'content', hint: '{ q, a }[]', aiFillable: true },
    bg: { kind: 'color', label: 'Background', group: 'colors' },
    text: { kind: 'color', label: 'Text', group: 'colors' },
  },
  aiPromptHint: '4-6 preguntas frecuentes. Cada respuesta corta (15-30 palabras), tono claro y honesto.',
  Component: Faqs01,
  renderHtml: ({ values, theme }) => {
    const bg = color(values, 'bg', theme.bg, '#ffffff');
    const text = color(values, 'text', undefined, '#0f0f0f');
    const list = qas(values.items);

    return `
<section style="background:${bg};color:${text};padding:64px 24px;">
  <div style="max-width:640px;margin:0 auto;">
    <h2 style="text-align:center;font-size:32px;font-weight:700;margin:0;">${escapeHtml(s(values, 'heading'))}</h2>
    <div style="margin-top:40px;">
      ${list.map((qa, i) => `
      <details ${i === 0 ? 'open' : ''} style="padding:20px 0;border-top:1px solid rgba(0,0,0,0.1);">
        <summary style="cursor:pointer;display:flex;justify-content:space-between;font-size:16px;font-weight:600;list-style:none;">
          <span>${escapeHtml(qa.q || '')}</span>
          <span style="margin-left:16px;">+</span>
        </summary>
        <p style="margin:12px 0 0;font-size:14px;opacity:0.8;">${escapeHtml(qa.a || '')}</p>
      </details>`).join('')}
    </div>
  </div>
</section>`.trim();
  },
};
