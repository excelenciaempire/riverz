/**
 * Registry of landing-lab templates available in the dashboard.
 *
 * Today the registry is hand-curated — every template ships either as a
 * standalone file under `public/templates/` (new templates) or as an
 * inline Vitalu layout already baked into `public/landing-lab.html`
 * (legacy projects). When the editor refactor lands and every template
 * is loaded dynamically from disk, this file becomes the only place that
 * needs touching to add a new template.
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
  /**
   * For Vitalu A/B layouts that were authored inline in landing-lab.html
   * before the registry existed. The editor recognises this string and
   * boots the corresponding hard-coded layout instead of fetching htmlUrl.
   */
  inlineSource?: 'vitalu-frustracion' | 'vitalu-ancestral';
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
    id: 'vitalu-frustracion',
    kind: 'advertorial',
    name: 'Vitalú — Frustración',
    description:
      'Narrativa problema → revelación → solución. Ingrediente "enterrado" + ciencia.',
    htmlUrl: '/landing-lab.html',
    inlineSource: 'vitalu-frustracion',
  },
  {
    id: 'vitalu-ancestral',
    kind: 'advertorial',
    name: 'Vitalú — Ancestral',
    description:
      'Misma estructura que Frustración pero con ángulo histórico/abuelas.',
    htmlUrl: '/landing-lab.html',
    inlineSource: 'vitalu-ancestral',
  },
  {
    id: 'product-page-default',
    kind: 'product_page',
    name: 'Product Page — Hero & Buy Box',
    description:
      'Galería de fotos + precio (con tachado de precio anterior) + variantes + reseñas + FAQ. El estándar DTC moderno.',
    htmlUrl: '/templates/product-page-default.html',
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
