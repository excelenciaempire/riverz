/**
 * Ad transcription / analysis powered by kie.ai (KIE_API_KEY).
 *
 * Why kie.ai and not direct Gemini Files API:
 *  the rest of the project already routes every Gemini call through the kie.ai
 *  gateway (see lib/kie-client.ts), so we share quota, billing and observability
 *  by reusing analyzeWithGemini3Pro instead of holding a separate Google AI key.
 *
 * Trade-off:
 *  kie.ai's Gemini wrapper exposes the OpenAI chat-completions shape, which
 *  accepts text + image_url content blocks but NOT raw audio/video. So for
 *  videos we analyze the COVER FRAME (Meta's thumbnail_url) — that gives us
 *  on-screen copy + visual hook + style, but NOT the spoken audio. For audio
 *  transcription we'd need a Whisper-style endpoint, which kie.ai does not
 *  currently expose.
 */

import { analyzeWithGemini3Pro, imageUrlToCleanBase64 } from '@/lib/kie-client';

export class TranscribeError extends Error {
  constructor(message: string, public code: 'config' | 'fetch' | 'generate' = 'generate') {
    super(message);
    this.name = 'TranscribeError';
  }
}

const VIDEO_PROMPT = `Eres un experto en marketing de respuesta directa y Meta Ads.
Esta es la portada (cover frame) de un anuncio de video. kie.ai/Gemini no procesa el audio del video — analiza solo lo visible.
Devuelve EXACTAMENTE este formato, en español:

HOOK VISUAL:
<qué llama la atención: producto, persona, color dominante, expresión>

TEXTO EN PANTALLA:
"<copia textual de cualquier palabra visible: subtítulos, packaging, ofertas, watermarks. Si no hay texto, escribe "ninguno">"

ESTILO:
<UGC / studio / lifestyle / animación / talking head / pattern interrupt / etc>

POSIBLE ÁNGULO:
<la promesa o problema que parece atacar el anuncio, en 1-2 líneas>

NOTA:
La transcripción del audio no está disponible con kie.ai/Gemini. Para audio hablado se necesita Whisper o similar.`;

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

const KIE_KEY = process.env.KIE_API_KEY;

/**
 * Sends an image (or a video's cover frame) to Gemini 3 Pro on kie.ai and
 * returns a structured ad analysis as plain text.
 */
export async function transcribeAsset(
  url: string,
  displayName: string,
  opts: { isVideo?: boolean } = {},
): Promise<string> {
  if (!KIE_KEY) throw new TranscribeError('KIE_API_KEY no está configurada', 'config');

  // Pre-convert the asset to base64 to avoid relying on kie.ai's gateway to
  // download the URL itself — same pattern used by lib/kie-client's Claude wrapper.
  let dataUri: string;
  try {
    const { base64, mediaType } = await imageUrlToCleanBase64(url);
    dataUri = `data:${mediaType};base64,${base64}`;
  } catch (err: any) {
    throw new TranscribeError(`No se pudo descargar el asset (${displayName}): ${err?.message || err}`, 'fetch');
  }

  const prompt = opts.isVideo ? VIDEO_PROMPT : IMAGE_PROMPT;

  try {
    const result = await analyzeWithGemini3Pro(
      [
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: dataUri } },
            { type: 'text', text: prompt },
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
    throw new TranscribeError(err?.message || 'Análisis con kie.ai/Gemini falló', 'generate');
  }
}
