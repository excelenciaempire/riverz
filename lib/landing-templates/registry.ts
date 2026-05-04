/**
 * Registry of landing-lab templates available in the dashboard.
 *
 * Today the registry is hand-curated — every template ships as a
 * standalone file under `public/templates/`. When the editor refactor
 * lands and every template is loaded dynamically from disk, this file
 * becomes the only place that needs touching to add a new template.
 *
 * Categories match the dashboard filter tabs. Don't rename them without
 * also updating the filter component.
 */
export type LandingTemplateKind =
  | 'landing_page'
  | 'product_page'
  | 'listicle'
  | 'advertorial';

export interface LandingTemplate {
  id: string;
  kind: LandingTemplateKind;
  name: string;
  description: string;
  /** URL under /public used for the live iframe preview AND for "Use template" loading. */
  htmlUrl: string;
  /** Optional static thumbnail under /public; falls back to the live iframe preview. */
  thumbnailUrl?: string;
  /** Tag for the "Coming soon" badge — read-only previews. */
  comingSoon?: boolean;
}

export const LANDING_TEMPLATES: LandingTemplate[] = [
  {
    id: 'pilar-listicle',
    kind: 'advertorial',
    name: 'Pilar — 5 Razones',
    description:
      'Listicle largo con autoridad médica, antes/después, escasez y oferta. Gran para cold traffic.',
    htmlUrl: '/templates/advertorial-listicle.html',
  },
  {
    id: 'listicle-powernax',
    kind: 'listicle',
    name: 'Listicle — 7 Señales (Powernax)',
    description:
      'Listicle masculino largo con 7 señales numeradas, sección puente "por qué pasa esto", grid de 8 ingredientes con dosis, oferta con garantía, reviews y FAQ. Inspirado en suplementos de testosterona/rendimiento. Paleta navy + gold + rojo.',
    htmlUrl: '/templates/listicle-powernax.html',
  },
  {
    id: 'product-page-default',
    kind: 'product_page',
    name: 'Product Page — Hero & Buy Box',
    description:
      'Hero con galería + buy box (Trustpilot, bullets, variantes, garantía, UGC), tira de prensa, rutina en 4 pasos, ingredientes, dolores, comparativo, timeline y FAQ. El estándar DTC moderno.',
    htmlUrl: '/templates/product-page-default.html',
  },
  {
    id: 'product-page-bold',
    kind: 'product_page',
    name: 'Product Page — Bold Supplement (UltimaPeak)',
    description:
      'Estética masculina premium negro + dorado. Bundle picker (Buy 1 / 2+1 / 3+2), buy box con bullets y trust bar, doctor card, timeline de resultados (Semana 1 / Mes 1 / Mes 3+), 4 cards "Why" con borde dorado, comparativo de 3 columnas (Nosotros vs Receta vs Genéricos), encuesta con stats, "Right for you if", ingredientes en círculos, reviews con foto y FAQ. Inspirado en suplementos masculinos como UltimaPeak.',
    htmlUrl: '/templates/product-page-bold.html',
  },
];

export const TEMPLATE_CATEGORIES: Array<{
  id: 'all' | LandingTemplateKind;
  label: string;
}> = [
  { id: 'all', label: 'Todos' },
  { id: 'advertorial', label: 'Advertorials' },
  { id: 'listicle', label: 'Listicles' },
  { id: 'landing_page', label: 'Landing Pages' },
  { id: 'product_page', label: 'Product Pages' },
];

export function getTemplate(id: string): LandingTemplate | undefined {
  return LANDING_TEMPLATES.find((t) => t.id === id);
}
