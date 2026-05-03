/**
 * Server-side renderer: PageDocument → HTML estático.
 *
 * El endpoint /api/landing-lab/publish ya espera `body_html` + lista de
 * imágenes. Este módulo es el puente entre el editor v2 (JSON-first) y ese
 * contrato existente, así no rompemos nada del pipeline Shopify.
 *
 * Cualquier sección que devuelva HTML con `data:` URLs en imágenes:
 * el caller debe invocar `extractImagePlaceholders()` para sustituirlas
 * por `__IMG_n__` antes de subirlas. Aquí sólo concatenamos.
 */

import { getSection } from './registry';
import type { PageDocument } from '@/types/landing-pages';

export interface RenderedPage {
  /** HTML concatenado de todas las secciones, en orden. */
  html: string;
  /** Tipos de sección no encontrados en el registry (para logging). */
  unknownSections: string[];
}

export function renderPageDocument(doc: PageDocument): RenderedPage {
  const unknown: string[] = [];
  const parts: string[] = [];

  for (const inst of doc.sections) {
    const def = getSection(inst.type);
    if (!def) {
      unknown.push(inst.type);
      continue;
    }
    // Merge defaults <- user props (user wins).
    const values = { ...def.defaultProps, ...(inst.props ?? {}) };
    const visible = { ...(def.defaultVisible ?? {}), ...(inst.visible ?? {}) };

    try {
      parts.push(def.renderHtml({ values, theme: doc.theme ?? {}, visible }));
    } catch (err) {
      // Una sección rota no debe tirar toda la página al publicar.
      console.error(`[renderPageDocument] section ${inst.type} threw`, err);
      parts.push(`<!-- section ${inst.type} failed to render -->`);
    }
  }

  // Wrapper mínimo: el publish endpoint le añade su propio reset CSS.
  const html = `<div class="riverz-landing">${parts.join('\n')}</div>`;
  return { html, unknownSections: unknown };
}
