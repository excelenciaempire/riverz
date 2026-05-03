/**
 * POST /api/v1/pages/{id}/duplicate-and-fill
 *
 * Clona la página, le aplica fill (mismo motor que /fill) y devuelve el id
 * + URL del editor de la nueva. El use-case principal: agencias que
 * generan una landing por anuncio Meta — apuntan a una "master template",
 * llaman este endpoint con un `angle` distinto, y obtienen una landing
 * lista para publicar.
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
  /** Override del nombre de la nueva. Default: "<original> · copy" */
  name?: string;
  /** Producto opcional al que asociar la copia (default: el del original). */
  product_id?: string | null;
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
  const { data: orig } = await supabase
    .from('landing_pages')
    .select('id, name, kind, document, product_id, clerk_user_id')
    .eq('id', id)
    .maybeSingle();
  if (!orig || orig.clerk_user_id !== key.clerk_user_id)
    return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const newName = (body.name || `${orig.name} · copy`).slice(0, 200);
  const productId = body.product_id !== undefined ? body.product_id : orig.product_id;

  // 1) Insert duplicate.
  const { data: dup, error: dupErr } = await supabase
    .from('landing_pages')
    .insert({
      clerk_user_id: key.clerk_user_id,
      name: newName,
      kind: orig.kind,
      product_id: productId,
      document: orig.document,
      status: 'draft',
    })
    .select('id, document')
    .single();
  if (dupErr || !dup) return NextResponse.json({ error: dupErr?.message || 'duplicate failed' }, { status: 500 });

  // 2) Fill (mismo flujo que /fill, todas las secciones).
  const doc = dup.document as PageDocument;
  let productContext = `Producto sin metadata: generá copy genérico atractivo.`;
  if (productId) {
    const { data: product } = await supabase
      .from('products')
      .select('name, description, benefits, category, website')
      .eq('id', productId)
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

  const partsArr = doc.sections
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

  let newDoc = doc;
  if (partsArr.length > 0) {
    const sysPrompt = [
      'Eres copywriter senior DTC ecommerce hispanohablante.',
      'Devolvé SOLO un JSON: { "<section_id>": { "<prop_key>": "valor" } }.',
      'Para arrays, devolvé arrays.',
    ].join('\n');
    const userPrompt = [
      '=== PRODUCTO ===',
      productContext,
      body.instructions ? `\n=== INSTRUCCIONES ===\n${body.instructions}` : '',
      '\n=== SECCIONES ===',
      partsArr.join('\n\n---\n\n'),
    ]
      .filter(Boolean)
      .join('\n');

    try {
      const raw = await callKieGemini([
        { role: 'system', content: sysPrompt },
        { role: 'user', content: userPrompt },
      ]);
      const parsed = parseAiJson<Record<string, Record<string, unknown>>>(raw);
      newDoc = {
        ...doc,
        sections: doc.sections.map((sec): SectionInstance => {
          const patch = parsed[sec.id];
          if (!patch) return sec;
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
      await supabase.from('landing_pages').update({ document: newDoc }).eq('id', dup.id);
    } catch (e) {
      console.warn('duplicate-and-fill: AI failed, returning unfilled copy', e);
    }
  }

  return NextResponse.json({
    ok: true,
    page: { id: dup.id, name: newName, document: newDoc },
    edit_url: `${process.env.NEXT_PUBLIC_APP_URL || ''}/landing-lab/edit/${dup.id}`,
  });
}
