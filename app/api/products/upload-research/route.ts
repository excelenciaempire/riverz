import { auth } from '@clerk/nextjs/server';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { analyzeWithGemini3Pro, type GeminiMessage } from '@/lib/kie-client';

export const runtime = 'nodejs';
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

// Hard cap so a malicious or accidental megabyte-sized paste can't blow past
// the model's input window or balloon the request body. ~400k chars ≈ 100k
// tokens — well under Gemini 3 Pro's 1M context but big enough to fit any
// realistic research doc.
const MAX_INPUT_CHARS = 400_000;

// Schema delivered to the model in the system prompt. Matches exactly what
// `/marcas/[id]/research` page renders so any new upload behaves like an
// AI-generated research from /api/research.
const RESEARCH_SCHEMA = `{
  "perfil_demografico": {
    "nombre_avatar": "",
    "edad": "",
    "genero": "",
    "ubicacion": "",
    "nivel_socioeconomico": "",
    "ocupacion": "",
    "comportamiento_online": "",
    "descripcion_detallada": ""
  },
  "problema_central": {
    "pain_point_principal": "",
    "sintomas_diarios": "",
    "impacto_emocional": "",
    "urgencia": "",
    "como_se_siente": ""
  },
  "top_5_emociones": ["", "", "", "", ""],
  "miedos_oscuros": {
    "miedo_1": { "miedo": "", "por_que_aterra": "", "escenario_pesadilla": "" },
    "miedo_2": { "miedo": "", "por_que_aterra": "", "escenario_pesadilla": "" },
    "miedo_3": { "miedo": "", "por_que_aterra": "", "escenario_pesadilla": "" },
    "miedo_4": { "miedo": "", "por_que_aterra": "", "escenario_pesadilla": "" },
    "miedo_5": { "miedo": "", "por_que_aterra": "", "escenario_pesadilla": "" }
  },
  "impacto_en_relaciones": {
    "pareja": "",
    "hijos": "",
    "amigos": "",
    "familia_extendida": "",
    "compañeros_trabajo": ""
  },
  "cosas_hirientes_que_dicen": [
    { "quien": "", "quote": "" }
  ],
  "soluciones_fallidas": {
    "solucion_1": { "que_probaron": "", "por_que_fallo": "", "frustracion": "", "soundbite": "" },
    "solucion_2": { "que_probaron": "", "por_que_fallo": "", "frustracion": "", "soundbite": "" },
    "solucion_3": { "que_probaron": "", "por_que_fallo": "", "frustracion": "", "soundbite": "" },
    "solucion_4": { "que_probaron": "", "por_que_fallo": "", "frustracion": "", "soundbite": "" },
    "solucion_5": { "que_probaron": "", "por_que_fallo": "", "frustracion": "", "soundbite": "" }
  },
  "transformacion_deseada": {
    "resultados_genio_magico": [],
    "impacto_estatus_social": "",
    "cosas_que_diran_otros": [
      { "quien": "", "quote": "" }
    ]
  },
  "creencias_y_objeciones": {
    "si_solo_tuviera": "",
    "por_que_permanecen_en_problema": "",
    "a_quien_culpan": [],
    "objeciones_principales": []
  },
  "lenguaje_del_mercado": {
    "frases_que_usan": [],
    "palabras_que_resuenan": [],
    "terminos_que_evitar": []
  }
}`;

function buildNormalizationPrompt(productName: string, productDescription: string) {
  return `Eres un analista de research de mercado. El usuario te entrega su propia investigación de mercado en formato libre (puede ser un Google Doc, notas, entrevistas transcritas, posts de Reddit, reseñas, etc.) y tu tarea es ESTRUCTURARLA en el JSON exacto que sigue.

PRODUCTO: ${productName}
DESCRIPCIÓN: ${productDescription || 'No disponible'}

REGLAS:
1. Devuelve ÚNICAMENTE el JSON — sin fences \`\`\`, sin texto antes ni después.
2. Usa EXACTAMENTE las claves del schema. No inventes campos nuevos.
3. Si un dato no está en el research del usuario, DEJA EL STRING VACÍO ("") o el array vacío ([]). No inventes contenido — la honestidad importa más que rellenar.
4. Cuando haya múltiples opciones (miedos, soluciones, emociones), prioriza las que el research menciona con más fuerza/frecuencia.
5. Mantén las frases originales del research cuando sean citas literales (en "quote", "frases_que_usan", "soundbite"). Esas son oro — no las parafrasees.
6. El idioma de salida debe ser español, igual que el resto del schema.

SCHEMA OBLIGATORIO:
${RESEARCH_SCHEMA}

Ahora procesa el research que viene a continuación y devuelve SOLO el JSON estructurado.`;
}

function parseJsonTolerant(s: string): any {
  let txt = s.trim();
  if (txt.startsWith('```json')) txt = txt.slice(7).trim();
  else if (txt.startsWith('```')) txt = txt.slice(3).trim();
  if (txt.endsWith('```')) txt = txt.slice(0, -3).trim();

  const firstBrace = txt.indexOf('{');
  if (firstBrace > 0) txt = txt.slice(firstBrace);

  // Walk to find the matching close brace.
  let depth = 0;
  let inString = false;
  let escape = false;
  let end = -1;
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    if (escape) { escape = false; continue; }
    if (c === '\\') { escape = true; continue; }
    if (c === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }
  if (end > 0) txt = txt.slice(0, end + 1);
  return JSON.parse(txt);
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const productId: string | undefined = body.productId;
    const rawText: string | undefined = body.rawText;

    if (!productId) {
      return NextResponse.json({ error: 'Missing productId' }, { status: 400 });
    }
    if (!rawText || typeof rawText !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid rawText' }, { status: 400 });
    }

    const trimmed = rawText.trim();
    if (trimmed.length < 50) {
      return NextResponse.json(
        { error: 'El research está demasiado corto. Pega al menos un párrafo con contenido real.' },
        { status: 400 }
      );
    }
    if (trimmed.length > MAX_INPUT_CHARS) {
      return NextResponse.json(
        { error: `Research demasiado largo (${trimmed.length.toLocaleString()} chars). Máx ${MAX_INPUT_CHARS.toLocaleString()}.` },
        { status: 413 }
      );
    }

    const supabase = await createClient();

    // 1. Verify the product belongs to the caller.
    const { data: product, error: fetchError } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .single();

    if (fetchError || !product) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
    }
    if (product.clerk_user_id && product.clerk_user_id !== userId) {
      return NextResponse.json({ error: 'No autorizado para este producto' }, { status: 403 });
    }

    // 2. Mark as processing so the existing UI shows the spinner.
    await supabase
      .from('products')
      .update({ research_status: 'processing' })
      .eq('id', productId);

    // 3. Build normalization prompt + send to Gemini.
    const systemPrompt = buildNormalizationPrompt(
      product.name || '',
      product.description || product.benefits || product.website || ''
    );

    const messages: GeminiMessage[] = [
      { role: 'developer', content: systemPrompt },
      { role: 'user', content: `RESEARCH DEL USUARIO:\n\n${trimmed}` },
    ];

    let modelResponse: string;
    try {
      modelResponse = await analyzeWithGemini3Pro(messages, {
        temperature: 0.3,
        maxTokens: 64000,
      });
    } catch (err: any) {
      await supabase
        .from('products')
        .update({
          research_status: 'failed',
          research_data: {
            error: `Gemini falló al normalizar: ${err?.message || err}`,
            timestamp: new Date().toISOString(),
            source: 'user_upload',
          },
        })
        .eq('id', productId);
      return NextResponse.json(
        { error: `Gemini falló al normalizar el research: ${err?.message || err}` },
        { status: 502 }
      );
    }

    // 4. Parse the structured JSON. On parse failure, save the raw response so
    //    the user can at least see what the model returned (mirrors the
    //    existing /api/research fallback behavior).
    let researchData: any;
    try {
      researchData = parseJsonTolerant(modelResponse);
    } catch (parseErr: any) {
      researchData = {
        raw_response: modelResponse,
        parse_error: true,
        source: 'user_upload',
        parse_error_message: parseErr?.message || String(parseErr),
      };
    }

    // Tag the source so future analytics can distinguish AI-generated vs
    // user-uploaded research.
    if (!researchData.parse_error) {
      researchData.source = 'user_upload';
      researchData.uploaded_at = new Date().toISOString();
    }

    // 5. Persist.
    const { error: updateError } = await supabase
      .from('products')
      .update({
        research_data: researchData,
        research_status: researchData.parse_error ? 'failed' : 'completed',
      })
      .eq('id', productId);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      success: !researchData.parse_error,
      researchData,
      parseError: !!researchData.parse_error,
    });
  } catch (error: any) {
    console.error('[UPLOAD-RESEARCH] Fatal:', error);
    return NextResponse.json(
      { error: error.message || 'Error procesando el research' },
      { status: 500 }
    );
  }
}
