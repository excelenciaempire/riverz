/**
 * Cliente compartido para Gemini-3-Pro vía kie.ai.
 *
 * Existe porque tres rutas distintas (generate-from-template, fill por
 * sección, fill por página, public API /v1/fill) hacen exactamente el
 * mismo POST + parseo de JSON. En lugar de copiar 50 líneas en cada una
 * mantenemos la implementación aquí.
 *
 * NO usar para imágenes — eso va por kie nano-banana-pro a otro endpoint.
 */

const KIE_ENDPOINT = 'https://api.kie.ai/gemini-3-pro/v1/chat/completions';

export interface KieMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface KieGeminiOptions {
  /** Default 8000. Subir si la respuesta esperada es muy grande. */
  maxTokens?: number;
}

export async function callKieGemini(
  messages: KieMessage[],
  opts: KieGeminiOptions = {},
): Promise<string> {
  const apiKey = process.env.KIE_API_KEY;
  if (!apiKey) throw new Error('KIE_API_KEY no configurada');

  const res = await fetch(KIE_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      max_tokens: opts.maxTokens ?? 8000,
      stream: false,
      messages: messages.map((m) => ({
        role: m.role,
        content: [{ type: 'text', text: m.content }],
      })),
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || data?.message || `KIE ${res.status}`;
    throw new Error(msg);
  }
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || !text) throw new Error('Respuesta vacía del modelo');
  return text;
}

/**
 * Parsea un blob que el modelo prometió devolver como JSON. Aguanta:
 *   - fences ```json ... ```
 *   - prefacios tipo "Aquí está el JSON: { ... }"
 *   - trailing commas (ignorando con un retry strip)
 */
export function parseAiJson<T = Record<string, unknown>>(raw: string): T {
  let s = raw.trim();
  if (s.startsWith('```')) {
    s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  }
  const first = s.indexOf('{');
  const last = s.lastIndexOf('}');
  if (first === -1 || last === -1 || last < first) {
    throw new Error('No JSON object found in response');
  }
  const json = s.slice(first, last + 1);
  try {
    return JSON.parse(json) as T;
  } catch (err) {
    // One retry: strip trailing commas before } or ]
    const cleaned = json.replace(/,\s*([}\]])/g, '$1');
    return JSON.parse(cleaned) as T;
  }
}
