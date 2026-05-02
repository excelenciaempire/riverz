/**
 * File-text extraction utilities used by the product knowledge base AND the
 * legacy /api/products/upload-research endpoint. Centralised here so both
 * paths agree on supported types, MIME detection, and the lightweight
 * markdown normalisation pass.
 *
 * Implementations are dynamic-imported at call time so the bundle for
 * routes that never extract a file (most of the app) doesn't pay the
 * unpdf/mammoth weight cost.
 */

export const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB

export type ExtractKind = 'pdf' | 'docx' | 'text' | 'unknown';

/**
 * Detect kind from filename + MIME. Both can lie or be missing — pick
 * whichever signal is more specific.
 */
export function detectFileKind(file: File): ExtractKind {
  const name = (file.name || '').toLowerCase();
  const mime = (file.type || '').toLowerCase();

  if (name.endsWith('.pdf') || mime === 'application/pdf') return 'pdf';
  if (
    name.endsWith('.docx') ||
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) return 'docx';
  if (
    name.endsWith('.txt') ||
    name.endsWith('.md') ||
    name.endsWith('.markdown') ||
    mime === 'text/plain' ||
    mime === 'text/markdown'
  ) return 'text';
  return 'unknown';
}

/**
 * Light normalisation: collapse whitespace, normalise line endings, turn
 * form-feed characters into paragraph breaks. We do NOT attempt to invent
 * heading levels or bullet structure from extractor output — the AI reads
 * paragraphs fine and inventing # / ## from font metrics we don't have
 * just adds noise.
 */
export function toMarkdown(raw: string): string {
  return raw
    .replace(/\f/g, '\n\n')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

async function extractPdf(buf: Buffer): Promise<string> {
  // unpdf has no filesystem deps so it works on Vercel serverless.
  const { extractText, getDocumentProxy } = await import('unpdf');
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const { text } = await extractText(pdf, { mergePages: false });
  if (!Array.isArray(text)) return String(text || '');
  return text.join('\n\n');
}

async function extractDocx(buf: Buffer): Promise<string> {
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ buffer: buf });
  return result.value || '';
}

/**
 * Pull text from any supported file. Returns text + provenance tag so the
 * caller can record what extractor was used. Throws on unsupported kinds
 * or oversized files — callers should catch and surface a 400.
 */
export async function extractFileText(file: File): Promise<{
  text: string;
  kind: ExtractKind;
  bytes: number;
}> {
  const kind = detectFileKind(file);
  if (kind === 'unknown') {
    throw new Error(
      `Tipo de archivo no soportado: ${file.name || file.type || 'desconocido'}. Sube .pdf, .docx, .txt o .md.`
    );
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(
      `Archivo demasiado grande (${(file.size / 1024 / 1024).toFixed(1)} MB). Máx ${(MAX_FILE_BYTES / 1024 / 1024).toFixed(0)} MB.`
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());
  let text: string;
  if (kind === 'pdf') text = await extractPdf(buf);
  else if (kind === 'docx') text = await extractDocx(buf);
  else text = buf.toString('utf-8');

  text = toMarkdown(text);
  return { text, kind, bytes: file.size };
}
