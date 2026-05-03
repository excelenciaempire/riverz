/**
 * Fill por IA — la pieza central de "auto-generate content".
 *
 * - POST /api/landing-pages/{id}/fill
 *   Body: {
 *     section_ids?: string[];   // si vacío, llena toda la página
 *     instructions?: string;    // override del usuario ("hazlo más urgente")
 *     angle?: string;           // ángulo de venta opcional
 *   }
 *
 * Usa el `aiPromptHint` de cada SectionDefinition + las claves marcadas
 * `aiFillable` en su schema para construir un prompt corto y devolver
 * sólo los campos editados. El producto se pasa como contexto.
 */

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getSection } from '@/lib/sections/registry';
import { callKieGemini, parseAiJson } from '@/lib/kie-gemini';
import type { LandingPage, PageDocument, SectionInstance } from '@/types/landing-pages';

export const runtime = 'nodejs';
export const maxDuration = 90;
export const dynamic = 'force-dynamic';

interface FillBody {
  section_ids?: string[];
  instructions?: string;
  angle?: string;
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: FillBody = {};
  try {
    body = (await req.json()) as FillBody;
  } catch {
    /* body opcional */
  }

  const supabase = createAdminClient();
  const { data: page, error } = await supabase
    .from('landing_pages')
    .select('id, name, kind, document, product_id, clerk_user_id')
    .eq('id', id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!page || page.clerk_user_id !== userId)
    return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const doc = page.document as PageDocument;

  // Resolve product context (mismo patrón que generate-from-template).
  let productContext = `Producto sin metadata aún. Generá copy genérico atractivo.`;
  let productName = page.name;
  if (page.product_id) {
    const { data: product } = await supabase
      .from('products')
      .select('name, description, benefits, category, website, research_data')
      .eq('id', page.product_id)
      .maybeSingle();
    if (product) {
      productName = product.name;
      productContext = formatProduct(product, body.angle);
    }
  }

  const targets = body.section_ids?.length
    ? doc.sections.filter((sec) => body.section_ids!.includes(sec.id))
    : doc.sections;

  if (targets.length === 0)
    return NextResponse.json({ error: 'Sin secciones para llenar' }, { status: 400 });

  // Construye el prompt con TODAS las secciones a llenar de un saque para
  // que el modelo mantenga consistencia narrativa entre ellas.
  const sectionPrompts = targets.map((sec) => buildSectionPromptPart(sec)).filter(Boolean);
  if (sectionPrompts.length === 0)
    return NextResponse.json({ error: 'Ninguna sección tiene props rellenables por IA' }, { status: 400 });

  const sysPrompt = [
    'Eres copywriter senior de DTC ecommerce hispanohablante.',
    'Vas a recibir información de un producto y un conjunto de secciones de una landing page.',
    'Para cada sección, devolvé los textos editados respetando estrictamente la longitud y formato del ejemplo.',
    'Responde SOLO con un JSON válido — sin markdown, sin explicaciones.',
    'Estructura del JSON: { "<section_id>": { "<prop_key>": "valor", ... }, ... }',
    'Si un valor es un array (e.g. bullets, items, quotes), devuélvelo como array JSON — no como string.',
  ].join('\n');

  const userPrompt = [
    '=== PRODUCTO ===',
    productContext,
    body.instructions ? `\n=== INSTRUCCIONES ADICIONALES ===\n${body.instructions}` : '',
    '\n=== SECCIONES ===',
    sectionPrompts.join('\n\n---\n\n'),
    '\n=== RESPUESTA ===',
    'Devuelve el JSON con las claves de section_id arriba y los valores nuevos para cada prop.',
  ]
    .filter(Boolean)
    .join('\n');

  let raw: string;
  try {
    raw = await callKieGemini(
      [
        { role: 'system', content: sysPrompt },
        { role: 'user', content: userPrompt },
      ],
      { maxTokens: 8000 },
    );
  } catch (e: any) {
    return NextResponse.json({ error: 'Modelo IA falló: ' + e.message }, { status: 502 });
  }

  let parsed: Record<string, Record<string, unknown>>;
  try {
    parsed = parseAiJson<Record<string, Record<string, unknown>>>(raw);
  } catch (e: any) {
    return NextResponse.json({ error: 'JSON inválido del modelo: ' + e.message }, { status: 502 });
  }

  // Aplicar parche al document, respetando todo lo que no se mencionó.
  const newDoc: PageDocument = {
    ...doc,
    sections: doc.sections.map((sec) => {
      const patch = parsed[sec.id];
      if (!patch || typeof patch !== 'object') return sec;
      const def = getSection(sec.type);
      if (!def) return sec;
      const allowed = Object.entries(def.schema).filter(([, f]) => 'aiFillable' in f && f.aiFillable);
      const cleanPatch: Record<string, unknown> = {};
      for (const [k] of allowed) {
        if (Object.prototype.hasOwnProperty.call(patch, k)) cleanPatch[k] = patch[k];
      }
      return { ...sec, props: { ...sec.props, ...cleanPatch } };
    }),
  };

  // Persistir.
  await supabase.from('landing_pages').update({ document: newDoc }).eq('id', id);

  return NextResponse.json({ ok: true, document: newDoc, productName });
}

function buildSectionPromptPart(sec: SectionInstance): string | null {
  const def = getSection(sec.type);
  if (!def) return null;
  const editableEntries = Object.entries(def.schema).filter(([, f]) => 'aiFillable' in f && f.aiFillable);
  if (editableEntries.length === 0) return null;

  const example: Record<string, unknown> = {};
  for (const [k] of editableEntries) {
    example[k] = sec.props[k] ?? def.defaultProps[k] ?? '';
  }
  return [
    `section_id: ${sec.id}`,
    `tipo: ${def.name} (${def.type})`,
    def.aiPromptHint ? `instrucciones: ${def.aiPromptHint}` : '',
    `valores actuales (úsalos como ejemplo de longitud/formato):`,
    JSON.stringify(example, null, 2),
  ]
    .filter(Boolean)
    .join('\n');
}

function formatProduct(
  p: { name: string; description?: string | null; benefits?: string | null; category?: string | null; website?: string | null; research_data?: any },
  angle?: string,
): string {
  const parts: string[] = [`Producto: ${p.name}`];
  if (p.category) parts.push(`Categoría: ${p.category}`);
  if (p.description) parts.push(`Descripción: ${p.description}`);
  if (p.benefits) parts.push(`Beneficios:\n${p.benefits}`);
  if (p.website) parts.push(`Sitio: ${p.website}`);
  if (angle) parts.push(`Ángulo de venta: ${angle}`);
  return parts.join('\n');
}
