/**
 * Helpers compartidos por todas las secciones.
 *
 * - `escapeHtml` para los strings que vienen del usuario al renderizar HTML
 *   estático en el publish. Sin esto, un copy con "<" rompería la página
 *   en Shopify (o peor, sería una vector de XSS si el dueño de la tienda
 *   no es el mismo usuario).
 * - `s` (string getter) y `b` (boolean getter) para leer values sin tener
 *   que castear en cada sección.
 */

export function escapeHtml(input: unknown): string {
  if (input === null || input === undefined) return '';
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function s(values: Record<string, unknown>, key: string, fallback = ''): string {
  const v = values[key];
  return typeof v === 'string' && v.length > 0 ? v : fallback;
}

export function b(visible: Record<string, boolean>, key: string, fallback = true): boolean {
  if (Object.prototype.hasOwnProperty.call(visible, key)) return Boolean(visible[key]);
  return fallback;
}

/** Resuelve un color del tema con fallback seguro. */
export function color(
  values: Record<string, unknown>,
  key: string,
  themeFallback?: string,
  hardFallback = '#000000',
): string {
  const v = values[key];
  if (typeof v === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(v)) return v;
  return themeFallback ?? hardFallback;
}
