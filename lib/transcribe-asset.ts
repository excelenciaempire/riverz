/**
 * Ad transcription / analysis pipeline — 100% kie.ai.
 *
 * Why this works for video:
 *   kie.ai's Gemini endpoints expose a "unified media structure" —
 *   images, videos, audio and PDFs all use the same content block shape:
 *     { type: 'image_url', image_url: { url: 'https://...' } }
 *   The kie.ai gateway downloads the URL, transcodes it if needed and
 *   forwards it to Gemini's multimodal interface. So we hand it Meta's
 *   public video URL and Gemini transcribes the audio + reads on-screen
 *   text in one shot. No separate GEMINI_API_KEY required.
 *
 *   Docs: https://docs.kie.ai/api-reference/llm/google/gemini-3-pro-preview
 */

import { analyzeWithGemini3Pro, type GeminiMessage } from '@/lib/kie-client';

const KIE_KEY = process.env.KIE_API_KEY;

export class TranscribeError extends Error {
  constructor(
    message: string,
    public code: 'config' | 'fetch' | 'generate' = 'generate',
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

export async function transcribeAsset(
  url: string,
  _displayName: string,
  opts: { isVideo?: boolean } = {},
): Promise<string> {
  if (!KIE_KEY) {
    throw new TranscribeError(
      'KIE_API_KEY no está configurada en el servidor.',
      'config',
    );
  }

  const prompt = opts.isVideo ? VIDEO_PROMPT : IMAGE_PROMPT;

  // kie.ai's unified media block — same shape for image / video / audio.
  // We pass Meta's public CDN URL straight through; kie.ai fetches and
  // transcodes server-side before handing bytes to Gemini.
  const messages: GeminiMessage[] = [
    {
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url } },
        { type: 'text', text: prompt },
      ],
    },
  ];

  try {
    // Videos take longer to analyze than images (kie.ai has to download +
    // forward the bytes). Bump max_tokens so the structured output isn't
    // truncated mid-section.
    const result = await analyzeWithGemini3Pro(messages, {
      temperature: 0.2,
      maxTokens: opts.isVideo ? 8000 : 4000,
    });
    const text = String(result || '').trim();
    if (!text) throw new TranscribeError('kie.ai/Gemini devolvió respuesta vacía', 'generate');
    return text;
  } catch (err: any) {
    if (err instanceof TranscribeError) throw err;
    const msg: string = err?.message || 'kie.ai/Gemini falló';
    // Heuristic: long-form errors from kie.ai include the upstream HTTP
    // status — surface those clearly so the UI shows something actionable.
    throw new TranscribeError(msg, 'generate');
  }
}
