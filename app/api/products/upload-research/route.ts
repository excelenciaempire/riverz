import { auth } from '@clerk/nextjs/server';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { analyzeWithGemini3Pro, type GeminiMessage } from '@/lib/kie-client';

export const runtime = 'nodejs';
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

// Hard cap on the *normalized* text we feed Gemini. ~400k chars ≈ 100k
// tokens — well under Gemini 3 Pro's 1M context. Anything bigger gets
// truncated with a notice in the response so the user knows part was
// dropped (vs. silently hallucinating from a partial doc).
const MAX_TEXT_CHARS = 400_000;
// Hard cap on raw uploaded file size. PDFs/DOCXs above this are too big
// to extract reliably in a 5-min serverless function and almost never
// research material — they're scans or full books.
const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB

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
  return `Eres un analista de research de mercado. El usuario te entrega su propia investigación de mercado en formato libre (puede ser un Google Doc, notas, entrevistas transcritas, posts de Reddit, reseñas, un PDF, un docx, etc.) y tu tarea es ESTRUCTURARLA en el JSON exacto que sigue.

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

/**
 * Light "text → markdown-ish" pass for raw extractor output. Preserves
 * paragraph breaks, collapses runs of whitespace, and strips form-feed
 * characters PDFs love to emit. We don't try to reverse-engineer headings —
 * Gemini reads paragraphs fine and inventing # / ## from font sizes we don't
 * have would just add noise.
 */
function toMarkdown(raw: string): string {
  return raw
    .replace(/\f/g, '\n\n') // form feeds → paragraph break
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

/**
 * Detect the kind of file we got and return the extension we'll route on.
 * Both the MIME type and the filename can be wrong/missing, so we trust
 * whichever signal is more specific.
 */
function detectKind(file: File): 'pdf' | 'docx' | 'text' | 'unknown' {
  const name = (file.name || '').toLowerCase();
  const mime = (file.type || '').toLowerCase();

  if (name.endsWith('.pdf') || mime === 'application/pdf') return 'pdf';
  if (
    name.endsWith('.docx') ||
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) return 'docx';
  if (
    name.endsWith('.txt') ||
    name.endsWith('.md') ||
    name.endsWith('.markdown') ||
    mime === 'text/plain' ||
    mime === 'text/markdown'
  ) return 'text';
  return 'unknown';
}

async function extractPdf(buf: Buffer): Promise<string> {
  // unpdf has no filesystem deps so it works on Vercel serverless.
  // extractText returns { text: string[] } where each entry is one page.
  const { extractText, getDocumentProxy } = await import('unpdf');
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const { text } = await extractText(pdf, { mergePages: false });
  if (!Array.isArray(text)) return String(text || '');
  // Stitch pages with double newline so paragraph boundaries survive.
  return text.join('\n\n');
}

async function extractDocx(buf: Buffer): Promise<string> {
  // mammoth has a `convertToMarkdown` style via convertToHtml + htmlToMd, but
  // for our purposes raw text is enough — the AI doesn't care about headings
  // and converting back to markdown loses fidelity on tables anyway.
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ buffer: buf });
  return result.value || '';
}

/**
 * Pull text out of an uploaded file regardless of its format. Returns an
 * object with the text and a tag noting which extractor was used so the
 * caller can record provenance on the saved research.
 */
async function extractFileText(file: File): Promise<{ text: string; kind: string; bytes: number }> {
  const kind = detectKind(file);
  if (kind === 'unknown') {
    throw new Error(
      `Tipo de archivo no soportado: ${file.name || file.type || 'desconocido'}. Sube .pdf, .docx, .txt o .md.`
    );
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(
      `Archivo demasiado grande (${(file.size / 1024 / 1024).toFixed(1)} MB). Máx ${(MAX_FILE_BYTES / 1024 / 1024).toFixed(0)} MB.`
    );
  }

  const arrayBuf = await file.arrayBuffer();
  const buf = Buffer.from(arrayBuf);

  let text: string;
  if (kind === 'pdf') text = await extractPdf(buf);
  else if (kind === 'docx') text = await extractDocx(buf);
  else text = buf.toString('utf-8');

  text = toMarkdown(text);
  return { text, kind, bytes: file.size };
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Two input modes:
    //   - multipart/form-data with a `file` field → server extracts text
    //   - application/json with `{ rawText }`     → already plain text
    // The UI picks the mode based on whether the user uploaded a binary
    // (.pdf/.docx) or pasted/uploaded plain text.
    const contentType = req.headers.get('content-type') || '';

    let productId: string | undefined;
    let rawText: string;
    let sourceTag: 'paste' | 'pdf' | 'docx' | 'text-file' = 'paste';
    let truncated = false;

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      productId = String(form.get('productId') || '') || undefined;
      const file = form.get('file');
      const pastedText = String(form.get('rawText') || '');

      if (file instanceof File && file.size > 0) {
        const extracted = await extractFileText(file);
        rawText = extracted.text;
        sourceTag = (extracted.kind === 'pdf'
          ? 'pdf'
          : extracted.kind === 'docx'
          ? 'docx'
          : 'text-file') as typeof sourceTag;
      } else if (pastedText.trim().length > 0) {
        rawText = pastedText;
      } else {
        return NextResponse.json({ error: 'Sube un archivo o pega texto.' }, { status: 400 });
      }
    } else {
      const body = await req.json();
      productId = body.productId;
      const pasted: string | undefined = body.rawText;
      if (!pasted || typeof pasted !== 'string') {
        return NextResponse.json({ error: 'Missing or invalid rawText' }, { status: 400 });
      }
      rawText = pasted;
    }

    if (!productId) {
      return NextResponse.json({ error: 'Missing productId' }, { status: 400 });
    }

    rawText = (rawText || '').trim();
    if (rawText.length < 50) {
      return NextResponse.json(
        {
          error:
            'El research está demasiado corto o el archivo no contenía texto extraíble. Si era un PDF escaneado, conviértelo primero a texto (OCR) y vuelve a subirlo.',
        },
        { status: 400 }
      );
    }
    if (rawText.length > MAX_TEXT_CHARS) {
      // Trim the tail rather than failing — most research docs put the meat
      // up front and the tail is appendices/references. We tag the response
      // so the user knows part was dropped.
      rawText = rawText.slice(0, MAX_TEXT_CHARS);
      truncated = true;
    }

    const supabase = await createClient();

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

    await supabase
      .from('products')
      .update({ research_status: 'processing' })
      .eq('id', productId);

    const systemPrompt = buildNormalizationPrompt(
      product.name || '',
      product.description || product.benefits || product.website || ''
    );

    const messages: GeminiMessage[] = [
      { role: 'developer', content: systemPrompt },
      { role: 'user', content: `RESEARCH DEL USUARIO:\n\n${rawText}` },
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
            source_kind: sourceTag,
          },
        })
        .eq('id', productId);
      return NextResponse.json(
        { error: `Gemini falló al normalizar el research: ${err?.message || err}` },
        { status: 502 }
      );
    }

    let researchData: any;
    try {
      researchData = parseJsonTolerant(modelResponse);
    } catch (parseErr: any) {
      researchData = {
        raw_response: modelResponse,
        parse_error: true,
        source: 'user_upload',
        source_kind: sourceTag,
        parse_error_message: parseErr?.message || String(parseErr),
      };
    }

    if (!researchData.parse_error) {
      researchData.source = 'user_upload';
      researchData.source_kind = sourceTag;
      researchData.uploaded_at = new Date().toISOString();
      researchData.input_chars = rawText.length;
      if (truncated) researchData.input_truncated = true;
    }

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
      sourceKind: sourceTag,
      inputChars: rawText.length,
      truncated,
    });
  } catch (error: any) {
    console.error('[UPLOAD-RESEARCH] Fatal:', error);
    return NextResponse.json(
      { error: error.message || 'Error procesando el research' },
      { status: 500 }
    );
  }
}
