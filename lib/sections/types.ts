/**
 * Section system — describe cada sección reusable del editor v2.
 *
 * Cada sección expone:
 *   - meta (categoría, nombre, thumbnail)
 *   - schema de props editables (lo que el inspector renderiza)
 *   - defaultProps (lo que se monta al insertarla)
 *   - Component (React) para el canvas/preview
 *   - render (function pura) para producir HTML al publicar a Shopify
 *   - aiPromptHint para que el endpoint de fill por IA sepa qué pedir
 *
 * Las secciones viven bajo lib/sections/<categoría>/<archivo>.tsx y se
 * registran exportando un objeto SectionDefinition que el registry recoge.
 */

import type { ComponentType } from 'react';

export type SectionCategory =
  | 'navigation'
  | 'hero'
  | 'product-details'
  | 'benefits'
  | 'ugc'
  | 'testimonials'
  | 'stats'
  | 'instructions'
  | 'ingredients'
  | 'comparison'
  | 'timeline'
  | 'faqs'
  | 'banners'
  | 'advertorial'
  | 'listicles'
  | 'saved';

/** Etiquetas legibles para la UI. Editables sin tocar tipos. */
export const CATEGORY_LABELS: Record<SectionCategory, string> = {
  saved: 'Guardadas',
  navigation: 'Navegación',
  hero: 'Hero',
  'product-details': 'Detalle de Producto',
  benefits: 'Beneficios',
  ugc: 'UGC',
  testimonials: 'Testimonios',
  stats: 'Stats',
  instructions: 'Instrucciones',
  ingredients: 'Ingredientes',
  comparison: 'Comparación',
  timeline: 'Timeline',
  faqs: 'FAQs',
  banners: 'Banners',
  advertorial: 'Advertorial',
  listicles: 'Listicles',
};

/** Orden con el que se muestran en el sidebar Add Section. */
export const CATEGORY_ORDER: SectionCategory[] = [
  'saved',
  'navigation',
  'hero',
  'product-details',
  'benefits',
  'ugc',
  'testimonials',
  'stats',
  'instructions',
  'ingredients',
  'comparison',
  'timeline',
  'faqs',
  'banners',
  'advertorial',
  'listicles',
];

/** Tipos de control que el inspector sabe renderizar. */
export type SectionPropKind =
  | 'text'
  | 'textarea'
  | 'url'
  | 'image'
  | 'color'
  | 'toggle'
  | 'select';

/** Agrupa props en el inspector (Layout / Visibility / Colors / Button…). */
export type SectionPropGroup =
  | 'content'
  | 'layout'
  | 'visibility'
  | 'colors'
  | 'button'
  | 'spacing';

export interface SectionPropFieldBase {
  kind: SectionPropKind;
  label: string;
  group?: SectionPropGroup;
  /** Texto pequeño debajo del label. */
  hint?: string;
}

export interface SectionPropTextField extends SectionPropFieldBase {
  kind: 'text' | 'textarea' | 'url';
  placeholder?: string;
  /** Si true, la IA debe rellenar este campo en auto-generate. */
  aiFillable?: boolean;
}

export interface SectionPropImageField extends SectionPropFieldBase {
  kind: 'image';
  recommended?: string; // "1920×800px"
}

export interface SectionPropColorField extends SectionPropFieldBase {
  kind: 'color';
}

export interface SectionPropToggleField extends SectionPropFieldBase {
  kind: 'toggle';
}

export interface SectionPropSelectField extends SectionPropFieldBase {
  kind: 'select';
  options: Array<{ value: string; label: string }>;
}

export type SectionPropField =
  | SectionPropTextField
  | SectionPropImageField
  | SectionPropColorField
  | SectionPropToggleField
  | SectionPropSelectField;

export type SectionPropSchema = Record<string, SectionPropField>;

/** Props que cada sección recibe al renderizar. */
export interface SectionRenderProps {
  /** Valores del usuario, ya mergeados con defaults. */
  values: Record<string, unknown>;
  /** Tema de la página (colores/fonts globales). */
  theme: {
    primary?: string;
    bg?: string;
    fontHeading?: string;
    fontBody?: string;
  };
  /** Visibility flags resueltos. */
  visible: Record<string, boolean>;
}

export interface SectionDefinition {
  /** ID estable — se persiste en SectionInstance.type. NUNCA renombrar. */
  type: string;
  category: SectionCategory;
  /** Nombre humano (Hero 01). */
  name: string;
  /** Thumbnail bajo /public/sections/<type>.jpg para el flyout. */
  thumbnail?: string;
  /** Descripción corta opcional. */
  description?: string;
  /** Default values que se montan al insertar. */
  defaultProps: Record<string, unknown>;
  /** Visibility defaults (true = visible al insertar). */
  defaultVisible?: Record<string, boolean>;
  schema: SectionPropSchema;
  /** Hint para la IA al hacer fill — qué tipo de copy esperar. */
  aiPromptHint?: string;
  /** Componente React (canvas + preview). */
  Component: ComponentType<SectionRenderProps>;
  /**
   * Renderiza la sección a HTML estático para publicar a Shopify.
   * DEBE ser determinista: mismas props → mismo HTML. Sin acceso a window.
   * Imágenes con URLs http(s) se mantienen tal cual; data: URLs se reemplazan
   * por placeholders {{IMG:n}} que el publish endpoint resolverá.
   */
  renderHtml: (props: SectionRenderProps) => string;
}
