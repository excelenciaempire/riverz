/**
 * Ad transcription / analysis pipeline.
 *
 * Routing:
 *  - VIDEO assets (need real audio transcription) → Google's Generative
 *    Language API directly (Files API + Gemini). Requires GEMINI_API_KEY
 *    or GOOGLE_GENERATIVE_AI_API_KEY env var. This is the only path that
 *    actually transcribes the spoken audio + on-screen text together.
 *  - IMAGE assets (no audio) → kie.ai/Gemini 3 Pro via the existing
 *    KIE_API_KEY infrastructure. Same gateway the rest of Riverz uses.
 *
 * Falls back gracefully when an env var is missing so the user gets a
 * clear actionable error instead of a 500.
 */

import { analyzeWithGemini3Pro, imageUrlToCleanBase64 } from '@/lib/kie-client';

const KIE_KEY = process.env.KIE_API_KEY;
const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const GEMINI_VIDEO_MODEL = process.env.GEMINI_VIDEO_MODEL || 'gemini-2.0-flash';
const FILES_BASE = 'https://generativelanguage.googleapis.com/upload/v1beta/files';
const GEN_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const MAX_BYTES = 95 * 1024 * 1024;

export class TranscribeError extends Error {
  constructor(
    message: string,
    public code: 'config' | 'fetch' | 'upload' | 'generate' = 'generate',
  ) {
    super(message);
    this.name = 'TranscribeError';
  }
}

const VIDEO_PROMPT = `Eres un experto en marketing de respuesta directa y Meta Ads.
Analiza este anuncio de video EN ESPAÑOL. Devuelve EXACTAMENTE este formato:

TRANSCRIPCIÓN DEL AUDIO:
<transcripción palabra por palabra de TODO lo que se habla, en su idioma original. Si no hay audio o solo hay música, escribe "Sin diálogo">

TEXTO EN PANTALLA:
"<copia textual de cualquier overlay, subtítulo, packaging o badge visible. Si no hay, escribe "ninguno">"

HOOK VISUAL:
<qué llama la atención en los primeros 3 segundos: producto, persona, color dominante>

ESTILO:
<UGC / studio / lifestyle / animación / talking head / pattern interrupt>

POSIBLE ÁNGULO:
<la promesa o problema que ataca el anuncio, en 1-2 líneas>`;

const IMAGE_PROMPT = `Eres un experto en marketing de respuesta directa y Meta Ads.
Analiza este anuncio estático en español. Devuelve EXACTAMENTE este formato:

VISUAL:
<descripción de la composición: producto, persona, fondo, color dominante>

TEXTO EN IMAGEN:
"<copia textual de TODO el texto visible, palabra por palabra. Si no hay texto, escribe "ninguno">"

CTA O PROMESA PRINCIPAL:
<la oferta o claim principal en una línea>

POSIBLE ÁNGULO:
<la promesa o problema que parece atacar el anuncio, en 1-2 líneas>`;

// ---------------------------------------------------------------------------
// VIDEO PATH — Google AI Files API
// ---------------------------------------------------------------------------

interface FetchedAsset {
  buffer: Buffer;
  mimeType: string;
}

async function fetchAsset(url: string): Promise<FetchedAsset> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new TranscribeError(`No se pudo descargar el video (HTTP ${res.status})`, 'fetch');
  }
  const contentLength = Number(res.headers.get('content-length') ?? 0);
  if (contentLength && contentLength > MAX_BYTES) {
    throw new TranscribeError(
      `El video pesa ${(contentLength / 1024 / 1024).toFixed(1)} MB, máximo 95 MB.`,
      'fetch',
    );
  }
  const ab = await res.arrayBuffer();
  if (ab.byteLength > MAX_BYTES) {
    throw new TranscribeError(
      `El video pesa ${(ab.byteLength / 1024 / 1024).toFixed(1)} MB, máximo 95 MB.`,
      'fetch',
    );
  }
  let mime = res.headers.get('content-type') || 'video/mp4';
  if (mime.includes(';')) mime = mime.split(';')[0].trim();
  if (mime === 'application/octet-stream') {
    if (url.includes('.mp4')) mime = 'video/mp4';
    else if (url.includes('.mov')) mime = 'video/quicktime';
    else if (url.includes('.webm')) mime = 'video/webm';
  }
  return { buffer: Buffer.from(ab), mimeType: mime };
}

interface UploadedFile {
  uri: string;
  mimeType: string;
  name: string;
}

async function uploadToGemini(asset: FetchedAsset, displayName: string): Promise<UploadedFile> {
  const startRes = await fetch(`${FILES_BASE}?key=${GEMINI_KEY}`, {
    method: 'POST',
    headers: {
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(asset.buffer.byteLength),
      'X-Goog-Upload-Header-Content-Type': asset.mimeType,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ file: { display_name: displayName } }),
  });
  if (!startRes.ok) {
    const text = await startRes.text();
    throw new TranscribeError(`Gemini upload start: ${startRes.status} ${text}`, 'upload');
  }
  const uploadUrl = startRes.headers.get('x-goog-upload-url');
  if (!uploadUrl) throw new TranscribeError('Gemini no devolvió upload URL', 'upload');

  const finishRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Content-Length': String(asset.buffer.byteLength),
      'X-Goog-Upload-Offset': '0',
      'X-Goog-Upload-Command': 'upload, finalize',
    },
    body: asset.buffer,
  });
  if (!finishRes.ok) {
    const text = await finishRes.text();
    throw new TranscribeError(`Gemini upload: ${finishRes.status} ${text}`, 'upload');
  }
  const json = await finishRes.json();
  const file = json?.file;
  if (!file?.uri) throw new TranscribeError('Gemini no devolvió file.uri', 'upload');
  return { uri: file.uri, mimeType: file.mimeType ?? asset.mimeType, name: file.name };
}

async function waitForFileActive(name: string): Promise<void> {
  // Videos take longer than images to become ACTIVE — give it ~30 s.
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const res = await fetch(`${GEN_BASE}/${name}?key=${GEMINI_KEY}`);
    if (res.ok) {
      const j = await res.json();
      if (j?.state === 'ACTIVE') return;
      if (j?.state === 'FAILED') throw new TranscribeError('Gemini marcó el video como FAILED', 'upload');
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
}

async function transcribeVideoWithGemini(
  url: string,
  displayName: string,
): Promise<string> {
  if (!GEMINI_KEY) {
    throw new TranscribeError(
      'Para transcribir videos necesitas configurar GEMINI_API_KEY (Google AI Studio). ' +
        'kie.ai/Gemini 3 Pro no procesa audio de video.',
      'config',
    );
  }
  const asset = await fetchAsset(url);
  const file = await uploadToGemini(asset, displayName);
  try {
    await waitForFileActive(file.name);
  } catch {
    /* polling failed — try generation anyway */
  }

  const body = {
    contents: [
      {
        role: 'user',
        parts: [
          { fileData: { fileUri: file.uri, mimeType: file.mimeType } },
          { text: VIDEO_PROMPT },
        ],
      },
    ],
    generationConfig: { temperature: 0.2, maxOutputTokens: 4096 },
  };
  const res = await fetch(
    `${GEN_BASE}/models/${GEMINI_VIDEO_MODEL}:generateContent?key=${GEMINI_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new TranscribeError(`Gemini generateContent: ${res.status} ${text}`, 'generate');
  }
  const json = await res.json();
  const parts = json?.candidates?.[0]?.content?.parts ?? [];
  const text = (parts.map((p: any) => p?.text ?? '').filter(Boolean).join('\n') as string).trim();
  if (!text) throw new TranscribeError('Gemini devolvió respuesta vacía', 'generate');
  return text;
}

// ---------------------------------------------------------------------------
// IMAGE PATH — kie.ai Gemini 3 Pro
// ---------------------------------------------------------------------------

async function transcribeImageWithKie(url: string, displayName: string): Promise<string> {
  if (!KIE_KEY) {
    throw new TranscribeError('KIE_API_KEY no está configurada', 'config');
  }
  let dataUri: string;
  try {
    const { base64, mediaType } = await imageUrlToCleanBase64(url);
    dataUri = `data:${mediaType};base64,${base64}`;
  } catch (err: any) {
    throw new TranscribeError(
      `No se pudo descargar la imagen (${displayName}): ${err?.message || err}`,
      'fetch',
    );
  }
  try {
    const result = await analyzeWithGemini3Pro(
      [
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: dataUri } },
            { type: 'text', text: IMAGE_PROMPT },
          ],
        },
      ],
      { temperature: 0.2, maxTokens: 2000 },
    );
    const text = String(result || '').trim();
    if (!text) throw new TranscribeError('Gemini devolvió respuesta vacía', 'generate');
    return text;
  } catch (err: any) {
    if (err instanceof TranscribeError) throw err;
    throw new TranscribeError(err?.message || 'kie.ai/Gemini falló', 'generate');
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function transcribeAsset(
  url: string,
  displayName: string,
  opts: { isVideo?: boolean } = {},
): Promise<string> {
  if (opts.isVideo) {
    return transcribeVideoWithGemini(url, displayName);
  }
  return transcribeImageWithKie(url, displayName);
}
