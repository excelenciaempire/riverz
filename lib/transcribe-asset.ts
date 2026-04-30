/**
 * Lightweight transcription helper for Meta Ads.
 *
 * Pipeline (no extra npm deps):
 *   1. fetch the asset URL → in-memory buffer (cap 95 MB so we stay inside
 *      Vercel's 100 MB body limit and Gemini Files API's per-file limit).
 *   2. upload to Google AI Files API (resumable upload).
 *   3. call models/gemini-2.0-flash:generateContent with a transcription
 *      prompt + the file_uri.
 *   4. return plain-text transcript.
 *
 * For images we ask Gemini to describe the visual + extract on-image text
 * (subtitles, packaging copy, badges) so the AI memory is uniform regardless
 * of media type.
 *
 * Requires GEMINI_API_KEY (Google AI Studio key) on the server.
 */

const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_TRANSCRIBE_MODEL || 'gemini-2.0-flash';
const FILES_BASE = 'https://generativelanguage.googleapis.com/upload/v1beta/files';
const GEN_BASE = 'https://generativelanguage.googleapis.com/v1beta';

const MAX_BYTES = 95 * 1024 * 1024;

export class TranscribeError extends Error {
  constructor(message: string, public code: 'config' | 'fetch' | 'upload' | 'generate' = 'generate') {
    super(message);
    this.name = 'TranscribeError';
  }
}

interface FetchedAsset {
  buffer: Buffer;
  mimeType: string;
}

async function fetchAsset(url: string): Promise<FetchedAsset> {
  const res = await fetch(url);
  if (!res.ok) throw new TranscribeError(`No se pudo descargar el asset (HTTP ${res.status})`, 'fetch');
  const contentLength = Number(res.headers.get('content-length') ?? 0);
  if (contentLength && contentLength > MAX_BYTES) {
    throw new TranscribeError(`El asset pesa ${(contentLength / 1024 / 1024).toFixed(1)} MB, máximo 95 MB.`, 'fetch');
  }
  const ab = await res.arrayBuffer();
  if (ab.byteLength > MAX_BYTES) {
    throw new TranscribeError(`El asset pesa ${(ab.byteLength / 1024 / 1024).toFixed(1)} MB, máximo 95 MB.`, 'fetch');
  }
  let mime = res.headers.get('content-type') || 'application/octet-stream';
  if (mime.includes(';')) mime = mime.split(';')[0].trim();
  // Meta usually returns video/mp4 or image/jpeg. Default to mp4 for unknown so
  // Gemini still accepts the upload.
  if (mime === 'application/octet-stream') {
    if (url.includes('.mp4')) mime = 'video/mp4';
    else if (url.includes('.mov')) mime = 'video/quicktime';
    else if (url.includes('.png')) mime = 'image/png';
    else if (url.includes('.jpg') || url.includes('.jpeg')) mime = 'image/jpeg';
    else if (url.includes('.webp')) mime = 'image/webp';
  }
  return { buffer: Buffer.from(ab), mimeType: mime };
}

interface UploadedFile {
  uri: string;
  mimeType: string;
  name: string;
}

async function uploadToGemini(asset: FetchedAsset, displayName: string): Promise<UploadedFile> {
  if (!GEMINI_KEY) throw new TranscribeError('GEMINI_API_KEY no está configurada', 'config');

  // 1. start resumable upload
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
    throw new TranscribeError(`Gemini upload start falló: ${startRes.status} ${text}`, 'upload');
  }
  const uploadUrl = startRes.headers.get('x-goog-upload-url');
  if (!uploadUrl) throw new TranscribeError('Gemini no devolvió upload URL', 'upload');

  // 2. push bytes + finalize
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
    throw new TranscribeError(`Gemini upload falló: ${finishRes.status} ${text}`, 'upload');
  }
  const json = await finishRes.json();
  const file = json?.file;
  if (!file?.uri) throw new TranscribeError('Gemini no devolvió file.uri', 'upload');
  return { uri: file.uri, mimeType: file.mimeType ?? asset.mimeType, name: file.name };
}

async function waitForFileActive(name: string): Promise<void> {
  // Most assets become ACTIVE in <2 s; cap at ~15 s.
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const res = await fetch(`${GEN_BASE}/${name}?key=${GEMINI_KEY}`);
    if (res.ok) {
      const j = await res.json();
      if (j?.state === 'ACTIVE') return;
      if (j?.state === 'FAILED') throw new TranscribeError('Gemini marcó el archivo como FAILED', 'upload');
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
}

const VIDEO_PROMPT = `Eres un experto en marketing de respuesta directa y meta ads.
Transcribe el audio de este anuncio palabra por palabra en su idioma original.
Si hay texto visible en pantalla (overlays, captions, packaging) inclúyelo entre corchetes así:
[on-screen: "20% OFF"].
Devuelve únicamente la transcripción, sin introducción ni cierre.`;

const IMAGE_PROMPT = `Eres un experto en marketing de respuesta directa y meta ads.
Describe lo que ves en este anuncio estático con detalle (composición, producto, claim principal).
Después transcribe TODO el texto visible literal entre comillas.
Formato:
- Visual: ...
- Texto en imagen: "..."`;

async function generateTranscript(file: UploadedFile): Promise<string> {
  const isImage = file.mimeType.startsWith('image/');
  const promptText = isImage ? IMAGE_PROMPT : VIDEO_PROMPT;

  const body = {
    contents: [
      {
        role: 'user',
        parts: [
          { fileData: { fileUri: file.uri, mimeType: file.mimeType } },
          { text: promptText },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 4096,
    },
  };

  const res = await fetch(
    `${GEN_BASE}/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new TranscribeError(`Gemini generateContent falló: ${res.status} ${text}`, 'generate');
  }
  const json = await res.json();
  const parts = json?.candidates?.[0]?.content?.parts ?? [];
  const text = parts.map((p: any) => p?.text ?? '').filter(Boolean).join('\n').trim();
  if (!text) throw new TranscribeError('Gemini devolvió un transcript vacío', 'generate');
  return text;
}

export async function transcribeAsset(url: string, displayName: string): Promise<string> {
  if (!GEMINI_KEY) throw new TranscribeError('GEMINI_API_KEY no está configurada', 'config');
  const asset = await fetchAsset(url);
  const file = await uploadToGemini(asset, displayName);
  try {
    await waitForFileActive(file.name);
  } catch {
    // If polling fails we still attempt generation — Gemini will return a clear error if not ready.
  }
  return generateTranscript(file);
}
