import { imageUrlToBase64, getMediaTypeFromDataUri, stripBase64Prefix } from '@/lib/kie-client';
import {
  AdsImageProvider,
  EditImageInput,
  GenerateStaticAdInput,
  GenerateStaticAdResult,
  ProviderError,
} from './types';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-3-pro-image-preview';
const TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || 'gemini-3.1-pro-preview';

type GeminiPart =
  | { text: string }
  | { inline_data: { mime_type: string; data: string } };

interface GeminiContent {
  parts: GeminiPart[];
  role?: 'user' | 'model';
}

interface GeminiResponse {
  candidates?: Array<{
    content?: GeminiContent;
    finishReason?: string;
    safetyRatings?: any[];
  }>;
  error?: { code: number; message: string; status: string };
  promptFeedback?: { blockReason?: string };
}

function mapGeminiError(status: number, body: any): ProviderError {
  const msg = body?.error?.message || body?.promptFeedback?.blockReason || `HTTP ${status}`;
  if (status === 401 || status === 403) {
    return new ProviderError({ code: 'auth', message: msg, provider: 'gemini', status });
  }
  if (status === 429) {
    return new ProviderError({ code: 'rate_limit', message: msg, provider: 'gemini', status });
  }
  if (status === 400 && /safety|block/i.test(msg)) {
    return new ProviderError({ code: 'safety', message: msg, provider: 'gemini', status });
  }
  if (status >= 500 && status < 600) {
    return new ProviderError({ code: 'network', message: msg, provider: 'gemini', status });
  }
  return new ProviderError({ code: 'unknown', message: msg, provider: 'gemini', status });
}

async function callGeminiImage(
  apiKey: string,
  parts: GeminiPart[],
  aspectRatio: string,
): Promise<GenerateStaticAdResult> {
  const url = `${GEMINI_BASE}/models/${IMAGE_MODEL}:generateContent`;
  const body = {
    contents: [{ parts }],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig: { aspectRatio, imageSize: '2K' },
    },
  };

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'x-goog-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch (err: any) {
    throw new ProviderError({
      code: 'network',
      message: `fetch failed: ${err?.message || err}`,
      provider: 'gemini',
    });
  }

  const text = await res.text();
  let parsed: GeminiResponse;
  try {
    parsed = text ? JSON.parse(text) : ({} as GeminiResponse);
  } catch {
    parsed = {} as GeminiResponse;
  }

  if (!res.ok) throw mapGeminiError(res.status, parsed);

  const blockReason = parsed?.promptFeedback?.blockReason;
  if (blockReason) {
    throw new ProviderError({
      code: 'safety',
      message: `Gemini blocked: ${blockReason}`,
      provider: 'gemini',
    });
  }

  const candidate = parsed.candidates?.[0];
  if (candidate?.finishReason && /SAFETY|BLOCK/i.test(candidate.finishReason)) {
    throw new ProviderError({
      code: 'safety',
      message: `Gemini finishReason=${candidate.finishReason}`,
      provider: 'gemini',
    });
  }
  const imagePart = candidate?.content?.parts?.find(
    (p): p is { inline_data: { mime_type: string; data: string } } =>
      'inline_data' in p && /^image\//.test(p.inline_data?.mime_type || ''),
  );
  if (!imagePart) {
    throw new ProviderError({
      code: 'no_image',
      message: 'Gemini response contained no image part',
      provider: 'gemini',
    });
  }

  return {
    imageBase64: imagePart.inline_data.data,
    mimeType: imagePart.inline_data.mime_type,
    modelId: IMAGE_MODEL,
    provider: 'gemini',
  };
}

async function urlsToParts(urls: string[]): Promise<GeminiPart[]> {
  const parts: GeminiPart[] = [];
  for (const u of urls) {
    if (!u || typeof u !== 'string' || !u.startsWith('http')) continue;
    try {
      const dataUri = await imageUrlToBase64(u);
      const mime = getMediaTypeFromDataUri(dataUri);
      parts.push({ inline_data: { mime_type: mime, data: stripBase64Prefix(dataUri) } });
    } catch (err: any) {
      console.warn(`[GEMINI] skipping image (fetch failed): ${u} — ${err?.message || err}`);
    }
  }
  return parts;
}

function buildStaticAdPrompt(input: GenerateStaticAdInput, templateCount: number, productCount: number): string {
  const ctx = input.productContext;
  const lang = ctx.language || 'es';
  const benefits = ctx.benefits ? `\nBeneficios clave: ${ctx.benefits}` : '';
  const desc = ctx.description ? `\nDescripción: ${ctx.description}` : '';
  const cat = ctx.category ? `\nCategoría: ${ctx.category}` : '';
  const tone = ctx.brandTone ? `\nTono de marca: ${ctx.brandTone}` : '';
  const research = ctx.researchData
    ? `\nInsights de investigación (úsalos para guiar copy y composición): ${JSON.stringify(ctx.researchData).slice(0, 4000)}`
    : '';
  const userExtra = input.userInstructions ? `\n\nInstrucciones adicionales del usuario: ${input.userInstructions}` : '';

  const intro = lang === 'en'
    ? 'Create a high-converting static ad creative.'
    : 'Crea un creativo estático de alta conversión para performance ads.';

  return [
    intro,
    '',
    `Recibes ${templateCount} imagen(es) de plantilla de referencia y ${productCount} imagen(es) del producto del usuario.`,
    '',
    'CRÍTICO:',
    '- Usa la(s) plantilla(s) SOLO como referencia de estilo: composición, jerarquía visual, colores, tipografía, atmósfera, ángulo de cámara, tratamiento de luz, ubicación de copy.',
    '- El producto físico que aparece en el ad final debe ser EXACTAMENTE el del usuario (mismo packaging, mismo logo, misma forma, mismas etiquetas). NO inventes branding ni alteres el packaging.',
    '- Reproduce el estilo de la plantilla sobre el producto del usuario, no al revés.',
    '- El texto/copy debe ser legible, en el idioma del usuario, y reforzar los beneficios.',
    `- Aspect ratio: ${input.aspectRatio}.`,
    '',
    'Contexto del producto:',
    `Nombre: ${ctx.name}`,
    `${desc}${benefits}${cat}${tone}${research}`,
    userExtra,
  ].filter(Boolean).join('\n');
}

export class GeminiProvider implements AdsImageProvider {
  readonly name = 'gemini' as const;
  private apiKey: string;

  constructor(apiKey: string) {
    if (!apiKey || apiKey.length < 10) {
      throw new ProviderError({ code: 'auth', message: 'Empty or invalid Gemini API key', provider: 'gemini' });
    }
    this.apiKey = apiKey;
  }

  async generateStaticAd(input: GenerateStaticAdInput): Promise<GenerateStaticAdResult> {
    const templateParts = await urlsToParts(input.templateImageUrls);
    const productParts = await urlsToParts(input.productImageUrls.slice(0, 6));
    if (templateParts.length === 0 && productParts.length === 0) {
      throw new ProviderError({
        code: 'no_image',
        message: 'No usable template or product images for Gemini',
        provider: 'gemini',
      });
    }
    const prompt = buildStaticAdPrompt(input, templateParts.length, productParts.length);
    const parts: GeminiPart[] = [
      { text: prompt },
      ...templateParts,
      ...productParts,
    ];
    return callGeminiImage(this.apiKey, parts, input.aspectRatio);
  }

  async editImage(input: EditImageInput): Promise<GenerateStaticAdResult> {
    const parts = await urlsToParts([input.sourceImageUrl]);
    if (parts.length === 0) {
      throw new ProviderError({
        code: 'no_image',
        message: 'Source image could not be fetched',
        provider: 'gemini',
      });
    }
    return callGeminiImage(
      this.apiKey,
      [{ text: input.editInstructions }, ...parts],
      input.aspectRatio,
    );
  }

  async ping(): Promise<{ ok: true } | { ok: false; error: ProviderError }> {
    const url = `${GEMINI_BASE}/models/${TEXT_MODEL}:generateContent`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'x-goog-api-key': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'ok' }] }],
          generationConfig: { maxOutputTokens: 1, temperature: 0 },
        }),
      });
      if (res.ok) return { ok: true };
      const body = await res.json().catch(() => ({}));
      return { ok: false, error: mapGeminiError(res.status, body) };
    } catch (err: any) {
      return {
        ok: false,
        error: new ProviderError({ code: 'network', message: err?.message || 'fetch failed', provider: 'gemini' }),
      };
    }
  }
}
