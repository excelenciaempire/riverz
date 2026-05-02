/**
 * Convert raw template / project / generation names into something a human
 * actually wants to read. The admin importer historically defaults a
 * template's name to its uploaded filename, which produces strings like
 *
 *   imgi_197_creative-assets%2Ff917b7c1-30bb-4970-8247-78347bdf5e03%2Fcompressed
 *
 * Showing that to the customer is ugly and leaks storage paths. This helper
 * detects the common patterns (URL-encoded segments, `imgi_<n>_` prefixes,
 * UUID tails, "compressed" / "thumbnail" suffixes) and produces a short,
 * stable, deterministic display name instead.
 *
 * Rules:
 *   - imgi_<n>_…  → "Plantilla <n>"
 *   - URL-encoded path with a UUID → "Plantilla <first 4 of UUID>"
 *   - Otherwise: decoded, trimmed, truncated to MAX with an ellipsis
 *   - Empty / nullish input → "Sin título"
 */
const MAX_LEN = 32;

export function prettyName(raw: unknown): string {
  if (raw == null) return 'Sin título';
  let s = String(raw).trim();
  if (!s) return 'Sin título';

  // Decode URL-encoded segments (`%2F` → `/`, etc.). Wrapped in try/catch so
  // a malformed sequence doesn't throw and crash the surrounding render.
  try {
    s = decodeURIComponent(s);
  } catch {
    // ignore — fall through with the raw string
  }

  // imgi_<digits>_… → "Plantilla <digits>". Stable across re-uploads of the
  // same source, and gives the customer a human number instead of a hash.
  const imgi = s.match(/^imgi_(\d+)_/i);
  if (imgi) return `Plantilla ${imgi[1]}`;

  // Anything that looks like "<something>/<uuid>/<suffix>" — typical for
  // storage paths — collapses to the first 4 chars of the UUID, prefixed.
  const uuidMatch = s.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  if (uuidMatch && (s.includes('/') || s.toLowerCase().includes('compressed'))) {
    return `Plantilla ${uuidMatch[0].slice(0, 4).toUpperCase()}`;
  }

  // Strip common storage-y suffixes that add noise without information.
  s = s
    .replace(/[\\/]+/g, ' / ')
    .replace(/\s*\/\s*compressed$/i, '')
    .replace(/\s*\/\s*thumbnail$/i, '')
    .replace(/\s*\.(png|jpe?g|webp|gif|svg)$/i, '')
    .trim();

  if (s.length <= MAX_LEN) return s;
  return `${s.slice(0, MAX_LEN - 1).trimEnd()}…`;
}
