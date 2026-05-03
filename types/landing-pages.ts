/**
 * Landing Pages V2 — modelo del editor React.
 *
 * Una página es un documento JSON: array ordenado de SectionInstance + tema
 * mínimo + meta para SEO. Cada sección referencia un tipo del registry
 * (lib/sections/registry.ts) y trae sus props específicas. El renderer
 * server-side (lib/sections/render.ts) toma el documento y produce el
 * `body_html` que ya espera /api/landing-lab/publish.
 */

export type LandingPageKind =
  | 'landing_page'
  | 'product_page'
  | 'listicle'
  | 'advertorial';

export type LandingPageStatus = 'draft' | 'published';

/** Una sección instanciada dentro de una página. */
export interface SectionInstance {
  /** UUID local — estable para drag & drop y autosave. */
  id: string;
  /** Tipo registrado (e.g. "hero-01", "testimonials-03"). */
  type: string;
  /**
   * Estado de visibilidad de los slots opcionales (subheading, stars,
   * guarantee, button…). Se usa SectionDefinition.schema[*].group === 'visibility'.
   */
  visible?: Record<string, boolean>;
  /** Valores de cada prop editable (textos, urls, hex de colores). */
  props: Record<string, unknown>;
}

export interface PageTheme {
  /** Color primario (CTA, badges). */
  primary?: string;
  /** Fondo principal. */
  bg?: string;
  /** Familia de fuente headline. Sólo CSS family — sin Brand Style System. */
  fontHeading?: string;
  /** Familia de fuente body. */
  fontBody?: string;
}

export interface PageMeta {
  /** Título visible (también usado para SEO si seoTitle vacío). */
  title?: string;
  /** Slug de la URL al publicar (e.g. "shilajit-gummies"). */
  handle?: string;
  /** SEO title alternativo. */
  seoTitle?: string;
  /** Meta description SEO. */
  metaDescription?: string;
}

export interface PageDocument {
  sections: SectionInstance[];
  theme: PageTheme;
  meta: PageMeta;
}

export interface LandingPage {
  id: string;
  clerk_user_id: string;
  name: string;
  kind: LandingPageKind;
  product_id?: string | null;
  document: PageDocument;
  status: LandingPageStatus;
  thumbnail_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface LandingPageVersion {
  id: string;
  page_id: string;
  document: PageDocument;
  source: 'auto' | 'manual';
  label?: string | null;
  created_at: string;
}

export interface ApiKey {
  id: string;
  clerk_user_id: string;
  name: string;
  /** "rvz_live_xxxx" — primeros 12 chars, seguros para mostrar. */
  key_prefix: string;
  /** bcrypt — nunca se expone al cliente. */
  key_hash: string;
  last_used_at?: string | null;
  created_at: string;
  revoked_at?: string | null;
}

/** Lo que el cliente recibe; nunca exponemos key_hash. */
export type ApiKeyClientSafe = Omit<ApiKey, 'key_hash'>;

export interface Referral {
  id: string;
  referrer_clerk_id: string;
  referee_clerk_id: string;
  ref_code: string;
  status: 'signed_up' | 'activated';
  credits_awarded: number;
  signed_up_at: string;
  activated_at?: string | null;
}

export interface CreativeFolder {
  id: string;
  clerk_user_id: string;
  name: string;
  created_at: string;
}

/** Documento vacío usado al crear una página nueva. */
export const EMPTY_DOCUMENT: PageDocument = {
  sections: [],
  theme: {},
  meta: {},
};
