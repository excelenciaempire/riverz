import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { promises as fs } from 'node:fs';
import path from 'node:path';

export const runtime = 'nodejs';
// Gemini-3-pro through kie.ai usually returns the full slot map in 12-25s
// for a 60-slot advertorial. 60s gives headroom for slow links.
export const maxDuration = 90;
export const dynamic = 'force-dynamic';

const KIE_API_KEY = process.env.KIE_API_KEY!;
const KIE_ENDPOINT = 'https://api.kie.ai/gemini-3-pro/v1/chat/completions';

// Maps every templateId we know about to its standalone HTML file under
// /public/templates/. Keep this in sync with lib/landing-templates/registry.ts
// — the loader on the editor reads from that registry; this server-side copy
// is needed because we only have the template ids on the wire here.
const TEMPLATE_FILES: Record<string, string> = {
  'pilar-listicle': 'advertorial-listicle.html',
};

interface GenerateRequest {
  template_id: string;
  product_id?: string;
  // Inline overrides if the caller doesn't have a product row yet (e.g. a
  // brand-new account that hasn't run deep research). The endpoint accepts
  // either path so the dashboard's "no product yet — describe it here"
  // fallback still works.
  product_info?: {
    name?: string;
    description?: string;
    benefits?: string;
    category?: string;
    angle?: string;
  };
}

interface GeneratedTexts {
  texts: Record<string, string>;
  product_name: string;
}

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: GenerateRequest;
  try {
    body = (await req.json()) as GenerateRequest;
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 });
  }
  if (!body.template_id || !TEMPLATE_FILES[body.template_id]) {
    return NextResponse.json({ error: 'template_id desconocido' }, { status: 400 });
  }
  if (!body.product_id && !body.product_info?.name) {
    return NextResponse.json(
      { error: 'Falta product_id o product_info.name' },
      { status: 400 },
    );
  }

  // Resolve product context — DB first, inline fallback.
  let productContext = '';
  let productName = body.product_info?.name || 'tu producto';
  if (body.product_id) {
    const { data: product, error } = await supabaseAdmin
      .from('products')
      .select('name, description, benefits, category, website, research_data')
      .eq('id', body.product_id)
      .eq('clerk_user_id', userId)
      .maybeSingle();
    if (error || !product) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
    }
    productName = product.name;
    productContext = formatProductContext(product, body.product_info?.angle);
  } else {
    productContext = formatProductContext(
      {
        name: body.product_info!.name || 'tu producto',
        description: body.product_info!.description || '',
        benefits: body.product_info!.benefits || '',
        category: body.product_info!.category || '',
        website: '',
        research_data: null,
      },
      body.product_info?.angle,
    );
  }

  // Load template, extract slot keys + their default sample copy. The AI
  // gets to see each slot's example so it can match length/tone/purpose
  // (e.g. r1-title is short + bold, r1-p1 is a sentence, etc.) without us
  // having to spell out per-slot rules.
  let slotsMap: Record<string, string>;
  try {
    slotsMap = await extractSlotsFromTemplate(body.template_id);
  } catch (e: any) {
    return NextResponse.json(
      { error: 'No se pudo leer el template: ' + e.message },
      { status: 500 },
    );
  }

  const slotKeys = Object.keys(slotsMap);
  if (slotKeys.length === 0) {
    return NextResponse.json({ error: 'Template sin slots editables' }, { status: 500 });
  }

  // Build the AI prompt. The model gets the full slot map as a JSON object
  // (so we keep ordering + sample lengths), the product context, and a
  // strict instruction to return ONE JSON object with the same keys.
  const sysPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt({
    productContext,
    productName,
    templateId: body.template_id,
    slots: slotsMap,
  });

  let aiResponseText: string;
  try {
    aiResponseText = await callKieGemini(sysPrompt, userPrompt);
  } catch (e: any) {
    return NextResponse.json(
      { error: 'Falla del modelo de IA: ' + e.message },
      { status: 502 },
    );
  }

  // Parse the AI response. The model is instructed to return raw JSON but
  // sometimes wraps in ```json fences — strip those before parsing.
  let parsed: Record<string, string>;
  try {
    parsed = parseAiJson(aiResponseText);
  } catch (e: any) {
    return NextResponse.json(
      { error: 'Respuesta del modelo inválida: ' + e.message, raw: aiResponseText.slice(0, 500) },
      { status: 502 },
    );
  }

  // Filter to known slot keys only — discard anything the model invented,
  // and keep template defaults for slots the model skipped.
  const finalTexts: Record<string, string> = {};
  for (const k of slotKeys) {
    const v = parsed[k];
    if (typeof v === 'string' && v.trim().length > 0) finalTexts[k] = v;
  }

  return NextResponse.json<GeneratedTexts>({
    texts: finalTexts,
    product_name: productName,
  });
}

/* ────────── helpers ────────── */

async function extractSlotsFromTemplate(templateId: string): Promise<Record<string, string>> {
  const file = TEMPLATE_FILES[templateId];
  const fullPath = path.join(process.cwd(), 'public', 'templates', file);
  const html = await fs.readFile(fullPath, 'utf-8');
  // Cheap regex-based extraction — we don't need full HTML parsing because
  // every slot looks like ` data-v-text="<slot>"...>TEXT</tag>`. Server-side
  // DOM parsing in Next.js Edge would also work but adds a dep for a
  // simple use case.
  const out: Record<string, string> = {};
  const slotRe = /data-v-text="([^"]+)"[^>]*>([\s\S]*?)<\/[a-zA-Z][^>]*>/g;
  let m: RegExpExecArray | null;
  while ((m = slotRe.exec(html)) !== null) {
    const slot = m[1];
    if (slot in out) continue;
    // Keep only the visible text content (strip tags), trim, collapse whitespace.
    const raw = m[2]
      .replace(/<[^>]+>/g, ' ')
      .replace(/&[a-z]+;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    out[slot] = raw;
  }
  return out;
}

function formatProductContext(
  product: {
    name: string;
    description?: string | null;
    benefits?: string | null;
    category?: string | null;
    website?: string | null;
    research_data?: any;
  },
  angle?: string,
): string {
  const parts: string[] = [];
  parts.push(`Producto: ${product.name}`);
  if (product.category) parts.push(`Categoría: ${product.category}`);
  if (product.description) parts.push(`Descripción: ${product.description}`);
  if (product.benefits) parts.push(`Beneficios:\n${product.benefits}`);
  if (product.website) parts.push(`Sitio: ${product.website}`);
  if (product.research_data) {
    const compact = compactResearch(product.research_data);
    if (compact) parts.push(`Investigación:\n${compact}`);
  }
  if (angle) parts.push(`Ángulo de venta: ${angle}`);
  return parts.join('\n\n');
}

// Cap the deep-research blob so we don't blow past the model context. Most
// research_data shapes are { miedos:[], productos_fallidos:[], avatar: {} }
// — we keep top-level keys and shorten arrays to the first 5 items each.
function compactResearch(rd: any): string {
  if (!rd) return '';
  if (typeof rd === 'string') return rd.slice(0, 4000);
  try {
    const trimmed: any = {};
    for (const [k, v] of Object.entries(rd)) {
      if (Array.isArray(v)) trimmed[k] = v.slice(0, 5);
      else if (typeof v === 'object' && v !== null) {
        trimmed[k] = JSON.stringify(v).slice(0, 800);
      } else trimmed[k] = v;
    }
    return JSON.stringify(trimmed, null, 2).slice(0, 6000);
  } catch {
    return '';
  }
}

function buildSystemPrompt(): string {
  return [
    'Eres un copywriter experto en ecommerce hispanohablante.',
    'Vas a recibir la información de un producto y la estructura de un advertorial / landing page.',
    'Cada slot del template viene con un texto de ejemplo (de otro producto) que muestra el ESTILO esperado: longitud, tono, propósito, formato.',
    'Tu trabajo: reescribir cada slot adaptado al producto del usuario, MANTENIENDO la estructura, longitud aproximada y propósito de cada slot.',
    '',
    'Reglas estrictas:',
    '- Responde SOLO con un objeto JSON válido. Sin markdown, sin ```json, sin explicaciones.',
    '- Las claves del JSON son exactamente las claves de slot que recibís.',
    '- Cada valor es texto plano (sin HTML salvo <strong>, <em>, <br> si el ejemplo lo usaba).',
    '- Mantén tono emocional, directo, conversacional, en español neutro o ajustado al país si la categoría lo sugiere.',
    '- Nunca inventes claves nuevas. Si no podés generar una, repetí el ejemplo.',
    '- Nombres de personas en quotes/testimonios: invéntalos creíbles para el target del producto.',
    '- Cantidades, descuentos, garantías: mantenelos del ejemplo a menos que la info del producto los contradiga.',
  ].join('\n');
}

function buildUserPrompt(args: {
  productContext: string;
  productName: string;
  templateId: string;
  slots: Record<string, string>;
}): string {
  return [
    `=== PRODUCTO ===`,
    args.productContext,
    '',
    `=== TEMPLATE: ${args.templateId} ===`,
    `Cada clave es un slot. El valor es un texto de EJEMPLO (de otro producto) que muestra estilo y longitud esperados.`,
    `Reemplazá cada valor por el copy adaptado a ${args.productName}.`,
    '',
    `=== SLOTS ===`,
    JSON.stringify(args.slots, null, 2),
    '',
    `=== RESPUESTA ===`,
    `Devolvé el JSON con las mismas claves y los valores reescritos:`,
  ].join('\n');
}

async function callKieGemini(systemPrompt: string, userPrompt: string): Promise<string> {
  if (!KIE_API_KEY) throw new Error('KIE_API_KEY no configurada');
  const res = await fetch(KIE_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${KIE_API_KEY}`,
    },
    body: JSON.stringify({
      max_tokens: 8000,
      stream: false,
      messages: [
        { role: 'system', content: [{ type: 'text', text: systemPrompt }] },
        { role: 'user', content: [{ type: 'text', text: userPrompt }] },
      ],
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

function parseAiJson(raw: string): Record<string, string> {
  let s = raw.trim();
  // Strip ```json fences if the model added them.
  if (s.startsWith('```')) {
    s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  }
  // Some models add a preface — try to find the first { and last }.
  const first = s.indexOf('{');
  const last = s.lastIndexOf('}');
  if (first === -1 || last === -1 || last < first) {
    throw new Error('No JSON object found in response');
  }
  const json = s.slice(first, last + 1);
  const parsed = JSON.parse(json);
  if (typeof parsed !== 'object' || parsed === null) throw new Error('Not an object');
  // Coerce all values to string for safety.
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(parsed)) {
    if (typeof v === 'string') out[k] = v;
    else if (v != null) out[k] = String(v);
  }
  return out;
}
