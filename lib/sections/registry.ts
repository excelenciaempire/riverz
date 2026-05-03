/**
 * Section registry — fuente única de verdad de qué secciones existen y bajo
 * qué categoría aparecen en el sidebar Add Section.
 *
 * Para añadir una sección nueva:
 *   1. Crea el componente en lib/sections/<categoria>/Hero02.tsx exportando
 *      `export const definition: SectionDefinition = { ... }`.
 *   2. Importa y agrega al array `SECTIONS` abajo.
 *   3. (Opcional) sube un thumbnail a /public/sections/<type>.jpg.
 *
 * El editor lee este registry en cliente y server, así que no incluyas
 * imports que dependan de window/localStorage en los componentes.
 */

import type {
  SectionCategory,
  SectionDefinition,
} from './types';

// Hero
import { definition as hero01 } from './hero/Hero01';
import { definition as hero02 } from './hero/Hero02';
import { definition as hero03 } from './hero/Hero03';

// Navigation
import { definition as navigation01 } from './navigation/Navigation01';

// Benefits
import { definition as benefits01 } from './benefits/Benefits01';
import { definition as benefits02 } from './benefits/Benefits02';

// Testimonials
import { definition as testimonials01 } from './testimonials/Testimonials01';

// Stats
import { definition as stats01 } from './stats/Stats01';

// FAQs
import { definition as faqs01 } from './faqs/Faqs01';

// Banners
import { definition as banners01 } from './banners/Banners01';

export const SECTIONS: SectionDefinition[] = [
  navigation01,
  hero01,
  hero02,
  hero03,
  benefits01,
  benefits02,
  testimonials01,
  stats01,
  faqs01,
  banners01,
];

const SECTIONS_BY_TYPE = new Map<string, SectionDefinition>(
  SECTIONS.map((s) => [s.type, s]),
);

export function getSection(type: string): SectionDefinition | undefined {
  return SECTIONS_BY_TYPE.get(type);
}

export function getSectionsByCategory(
  category: SectionCategory,
): SectionDefinition[] {
  return SECTIONS.filter((s) => s.category === category);
}

export function countByCategory(): Record<SectionCategory, number> {
  const out: Partial<Record<SectionCategory, number>> = {};
  for (const s of SECTIONS) {
    out[s.category] = (out[s.category] ?? 0) + 1;
  }
  return out as Record<SectionCategory, number>;
}
