/**
 * POST /api/v1/pages/{id}/fill — re-genera todos los textos AI-fillable
 * de la página usando el mismo motor que el editor.
 *
 * Body:
 *   {
 *     section_ids?: string[];   // si vacío, llena toda la página
 *     instructions?: string;
 *     angle?: string;
 *   }
 *
 * Implementación: reusa /api/landing-pages/[id]/fill via fetch interno.
 * No re-implementamos la lógica para mantener una sola fuente de verdad.
 */

import { NextResponse } from 'next/server';
import { authenticateApiKey } from '@/lib/auth/api-key';
import { createAdminClient } from '@/lib/supabase/server';
import { callKieGemini, parseAiJson } from '@/lib/kie-gemini';
import { getSection } from '@/lib/sections/registry';
import type { PageDocument, SectionInstance } from '@/types/landing-pages';

export const runtime = 'nodejs';
export const maxDuration = 90;
export const dynamic = 'force-dynamic';

interface Body {
  section_ids?: string[];
  instructions?: string;
  angle?: string;
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const key = await authenticateApiKey(req);
  if (!key) return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 });

  let body: Body = {};
  try {
    body = await req.json();
  } catch {
    /* opcional */
  }

  const supabase = createAdminClient();
  const { data: page } = await supabase
    .from('landing_pages')
    .select('id, name, document, product_id, clerk_user_id')
    .eq('id', id)
    .maybeSingle();
  if (!page || page.clerk_user_id !== key.clerk_user_id)
    return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const doc = page.document as PageDocument;
  let productContext = `Producto sin metadata: generá copy genérico atractivo.`;
  if (page.product_id) {
    const { data: product } = await supabase
      .from('products')
      .select('name, description, benefits, category, website')
      .eq('id', page.product_id)
      .maybeSingle();
    if (product) {
      productContext = [
        `Producto: ${product.name}`,
        product.category ? `Categoría: ${product.category}` : '',
        product.description ? `Descripción: ${product.description}` : '',
        product.benefits ? `Beneficios:\n${product.benefits}` : '',
        body.angle ? `Ángulo: ${body.angle}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    }
  }

  const targets = body.section_ids?.length
    ? doc.sections.filter((sec) => body.section_ids!.includes(sec.id))
    : doc.sections;
  if (targets.length === 0)
    return NextResponse.json({ error: 'No sections to fill' }, { status: 400 });

  const sectionPromptParts = targets
    .map((sec) => {
      const def = getSection(sec.type);
      if (!def) return null;
      const editable = Object.entries(def.schema).filter(([, f]) => 'aiFillable' in f && f.aiFillable);
      if (editable.length === 0) return null;
      const example: Record<string, unknown> = {};
      for (const [k] of editable) example[k] = sec.props[k] ?? def.defaultProps[k] ?? '';
      return [
        `section_id: ${sec.id}`,
        `tipo: ${def.name}`,
        def.aiPromptHint ? `instrucciones: ${def.aiPromptHint}` : '',
        `ejemplo:`,
        JSON.stringify(example, null, 2),
      ]
        .filter(Boolean)
        .join('\n');
    })
    .filter(Boolean) as string[];

  if (sectionPromptParts.length === 0)
    return NextResponse.json({ error: 'No fillable props in selected sections' }, { status: 400 });

  const sysPrompt = [
    'Eres copywriter senior DTC ecommerce hispanohablante.',
    'Devolvé SOLO un JSON con shape: { "<section_id>": { "<prop_key>": "valor" } }.',
    'Mantené longitud y formato del ejemplo. Para arrays, devolvé arrays.',
  ].join('\n');
  const userPrompt = [
    '=== PRODUCTO ===',
    productContext,
    body.instructions ? `\n=== INSTRUCCIONES ===\n${body.instructions}` : '',
    '\n=== SECCIONES ===',
    sectionPromptParts.join('\n\n---\n\n'),
  ]
    .filter(Boolean)
    .join('\n');

  let raw: string;
  try {
    raw = await callKieGemini([
      { role: 'system', content: sysPrompt },
      { role: 'user', content: userPrompt },
    ]);
  } catch (e: any) {
    return NextResponse.json({ error: 'AI failed: ' + e.message }, { status: 502 });
  }
  let parsed: Record<string, Record<string, unknown>>;
  try {
    parsed = parseAiJson<Record<string, Record<string, unknown>>>(raw);
  } catch (e: any) {
    return NextResponse.json({ error: 'Invalid AI JSON: ' + e.message }, { status: 502 });
  }

  const newDoc: PageDocument = {
    ...doc,
    sections: doc.sections.map((sec): SectionInstance => {
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

  await supabase.from('landing_pages').update({ document: newDoc }).eq('id', id);
  return NextResponse.json({ ok: true, document: newDoc });
}
