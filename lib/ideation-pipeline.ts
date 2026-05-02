import { createClient } from '@supabase/supabase-js';
import { analyzeWithFallback, getKieModelConfig, GeminiMessage } from '@/lib/kie-client';
import { getPromptText, getPromptWithVariables } from '@/lib/get-ai-prompt';

/**
 * Internal ideation pipeline.
 *
 * Two-stage flow that runs entirely server-side via kie.ai (same provider
 * the rest of the static-ads pipeline uses):
 *
 *   STAGE 1 — Concept generation
 *     Input:  product knowledge base (research_data + uploaded knowledge
 *             rows) + headcount.
 *     Prompt: `ideation_concept_generation` (admin-editable in /admin).
 *     Output: an array of N concepts grouped by awareness level
 *             (unaware / problem_aware / solution_aware), each with a
 *             headline, description, hook, cta.
 *
 *   STAGE 2 — Per-concept Nano Banana prompt
 *     Input:  one concept + product context.
 *     Prompt: `ideation_image_prompt` (admin-editable in /admin).
 *     Output: a JSON-shaped string that goes verbatim as the Nano Banana
 *             prompt when the user later clicks "Generar imagen". Stored on
 *             `ad_concepts.image_prompt`.
 *
 * Both stages run with `analyzeWithFallback` (primary kie analysis model →
 * Claude Sonnet 4.6 → GPT-4o → Gemini Flash 2.0) so a single LLM hiccup
 * doesn't kill the whole batch.
 *
 * Why two stages instead of one mega-prompt?
 *   - Concept generation needs to see ALL of the knowledge base at once to
 *     produce diverse angles. The prompt is bulky and prompt-tuning is
 *     iterative.
 *   - Image prompts need to be tailored per concept (different visual
 *     metaphor per headline). Bundling them would multiply the per-concept
 *     work into one giant slow call and tangle the prompt-engineering for
 *     each piece.
 *   - Splitting also lets the admin tune the two prompts independently.
 */

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export type AwarenessLevel = 'unaware' | 'problem_aware' | 'solution_aware';

export interface IdeationConcept {
  awareness_level: AwarenessLevel;
  headline: string;
  description: string;
  hook?: string;
  cta?: string;
}

interface ProductKnowledgeRow {
  kind: 'text' | 'document' | 'link';
  title: string;
  content: string | null;
  source_url: string | null;
}

/**
 * Tolerant JSON parser. Mirrors the one in process-queue/route.ts: strips
 * markdown fences and any preamble before the first `{` or `[`. The model
 * is instructed to return raw JSON but in practice it sometimes wraps the
 * payload in ```json ... ```  or prefaces with "Aquí están las ideas:".
 */
function parseJsonFromResponse(response: string): any {
  let s = response.trim();
  if (s.startsWith('```json')) s = s.slice(7).trim();
  else if (s.startsWith('```')) s = s.slice(3).trim();
  if (s.endsWith('```')) s = s.slice(0, -3).trim();

  const firstIdx = s.search(/[{[]/);
  if (firstIdx < 0) return JSON.parse(s);
  s = s.slice(firstIdx);

  const opening = s[0];
  const closing = opening === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  let escape = false;
  let end = -1;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (escape) { escape = false; continue; }
    if (c === '\\') { escape = true; continue; }
    if (c === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (c === opening) depth++;
    else if (c === closing) {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }
  if (end > 0) s = s.slice(0, end + 1);
  return JSON.parse(s);
}

/**
 * Read the admin-tunable concept count from `admin_config.ideas_per_batch`.
 * Falls back to 15 (5 per awareness level × 3 levels) if missing or invalid.
 */
export async function getIdeasPerBatch(): Promise<number> {
  const { data } = await supabaseAdmin
    .from('admin_config')
    .select('value')
    .eq('key', 'ideas_per_batch')
    .maybeSingle();
  const parsed = data?.value ? parseInt(data.value, 10) : NaN;
  if (!isNaN(parsed) && parsed >= 3 && parsed <= 60) return parsed;
  return 15;
}

/**
 * Build the knowledge-base block injected into the concept-generation prompt.
 * Combines deep research (already in `products.research_data`) with whatever
 * the user added in the /marcas/[id] Knowledge Base tab.
 */
function formatKnowledgeBase(opts: {
  productName: string;
  productDescription?: string | null;
  productBenefits?: string | null;
  productCategory?: string | null;
  researchData: any | null;
  knowledge: ProductKnowledgeRow[];
}): string {
  const lines: string[] = [];

  lines.push(`PRODUCTO: ${opts.productName}`);
  if (opts.productCategory) lines.push(`CATEGORÍA: ${opts.productCategory}`);
  if (opts.productDescription) lines.push(`DESCRIPCIÓN: ${opts.productDescription}`);
  if (opts.productBenefits) lines.push(`BENEFICIOS: ${opts.productBenefits}`);

  if (opts.researchData) {
    lines.push('');
    lines.push('=== DEEP RESEARCH (buyer persona) ===');
    lines.push(JSON.stringify(opts.researchData, null, 2));
  }

  const grouped: Record<string, ProductKnowledgeRow[]> = { text: [], document: [], link: [] };
  for (const row of opts.knowledge) grouped[row.kind]?.push(row);

  if (grouped.text.length) {
    lines.push('');
    lines.push('=== BRIEF / NOTAS DEL USUARIO ===');
    for (const r of grouped.text) {
      lines.push(`— ${r.title}`);
      if (r.content) lines.push(r.content);
      lines.push('');
    }
  }
  if (grouped.document.length) {
    lines.push('');
    lines.push('=== DOCUMENTOS SUBIDOS ===');
    for (const r of grouped.document) {
      lines.push(`— ${r.title}${r.source_url ? ` (${r.source_url})` : ''}`);
      if (r.content) lines.push(r.content);
      lines.push('');
    }
  }
  if (grouped.link.length) {
    lines.push('');
    lines.push('=== ENLACES DE REFERENCIA ===');
    for (const r of grouped.link) {
      lines.push(`— ${r.title}: ${r.source_url || ''}`);
      if (r.content) lines.push(r.content);
      lines.push('');
    }
  }

  return lines.join('\n');
}

/**
 * STAGE 1 — generate raw concepts from a product's knowledge base.
 *
 * The prompt is `ideation_concept_generation` (admin-editable). It receives
 * `{KNOWLEDGE_BASE}` (assembled here) and `{COUNT}` (how many concepts) as
 * variables. The model is expected to return a JSON object shaped:
 *
 *   {
 *     "unaware":         [ { headline, description, hook, cta }, ... ],
 *     "problem_aware":   [ ... ],
 *     "solution_aware":  [ ... ]
 *   }
 *
 * We split COUNT evenly across the three levels, rounding up so a request
 * for 15 yields 5/5/5 and a request for 10 yields 4/4/4 (caller can resize).
 */
export async function generateConcepts(opts: {
  productId: string;
  count: number;
}): Promise<IdeationConcept[]> {
  const { productId, count } = opts;

  const { data: product, error: prodErr } = await supabaseAdmin
    .from('products')
    .select('*')
    .eq('id', productId)
    .single();
  if (prodErr || !product) throw new Error('Product not found for ideation');

  const { data: knowledge } = await supabaseAdmin
    .from('product_knowledge')
    .select('kind, title, content, source_url')
    .eq('product_id', productId)
    .order('created_at', { ascending: true });

  const knowledgeBase = formatKnowledgeBase({
    productName: product.name,
    productDescription: product.description ?? null,
    productBenefits: product.benefits ?? null,
    productCategory: product.category ?? null,
    researchData: product.research_data || null,
    knowledge: (knowledge || []) as ProductKnowledgeRow[],
  });

  const perLevel = Math.max(1, Math.ceil(count / 3));

  const systemPrompt = await getPromptWithVariables('ideation_concept_generation', {
    KNOWLEDGE_BASE: knowledgeBase,
    COUNT: String(count),
    COUNT_PER_LEVEL: String(perLevel),
    PRODUCT_NAME: product.name,
  });

  const messages: GeminiMessage[] = [
    { role: 'developer', content: systemPrompt },
    { role: 'user', content: 'Devuelve únicamente el JSON con las ideas por nivel de awareness.' },
  ];

  const { analysisModel } = await getKieModelConfig();
  const { text } = await analyzeWithFallback(analysisModel, messages, {
    temperature: 0.85,
    maxTokens: 16000,
  });

  let parsed: any;
  try {
    parsed = parseJsonFromResponse(text);
  } catch (err: any) {
    throw new Error(`Stage 1 (concepts) returned invalid JSON: ${err?.message || err}`);
  }

  const out: IdeationConcept[] = [];
  for (const level of ['unaware', 'problem_aware', 'solution_aware'] as const) {
    const arr = Array.isArray(parsed?.[level]) ? parsed[level] : [];
    for (const item of arr) {
      if (!item?.headline || !item?.description) continue;
      out.push({
        awareness_level: level,
        headline: String(item.headline).slice(0, 500),
        description: String(item.description).slice(0, 2000),
        hook: item.hook ? String(item.hook).slice(0, 1000) : undefined,
        cta: item.cta ? String(item.cta).slice(0, 200) : undefined,
      });
    }
  }

  if (out.length === 0) {
    throw new Error('Stage 1 (concepts) returned 0 valid concepts');
  }
  return out;
}

/**
 * STAGE 2 — turn ONE concept into the Nano Banana Pro prompt.
 *
 * The prompt is `ideation_image_prompt` (admin-editable). It receives the
 * concept fields + product metadata as variables. The model can return
 * either a JSON object or a raw string — we accept both (we serialize the
 * object so it is sent verbatim to Nano Banana, which is fine because Nano
 * Banana accepts long structured prompts as text).
 */
export async function generateImagePromptForConcept(opts: {
  concept: IdeationConcept;
  product: { id: string; name: string; benefits?: string | null; category?: string | null; description?: string | null };
}): Promise<string> {
  const { concept, product } = opts;

  const systemPrompt = await getPromptWithVariables('ideation_image_prompt', {
    HEADLINE: concept.headline,
    DESCRIPTION: concept.description,
    HOOK: concept.hook || '',
    CTA: concept.cta || '',
    AWARENESS_LEVEL: concept.awareness_level,
    PRODUCT_NAME: product.name,
    PRODUCT_BENEFITS: product.benefits || '',
    PRODUCT_CATEGORY: product.category || '',
    PRODUCT_DESCRIPTION: product.description || '',
  });

  const messages: GeminiMessage[] = [
    { role: 'developer', content: systemPrompt },
    { role: 'user', content: 'Devuelve únicamente el prompt final que se enviará a Nano Banana Pro.' },
  ];

  const { analysisModel } = await getKieModelConfig();
  const { text } = await analyzeWithFallback(analysisModel, messages, {
    temperature: 0.6,
    maxTokens: 8000,
  });

  // Try to parse as JSON; if it parses, serialize compactly so Nano Banana
  // sees a clean structured payload. If it doesn't parse, just return the
  // raw text — the admin may want a free-form prompt for this stage.
  const trimmed = text.trim();
  try {
    const obj = parseJsonFromResponse(trimmed);
    return JSON.stringify(obj, null, 2);
  } catch {
    return trimmed;
  }
}

/**
 * Full ideation: generate N concepts, then per-concept image prompts, then
 * insert them all into `ad_concepts` with `image_prompt` populated.
 *
 * Stage 2 fans out per concept with bounded parallelism (4 at a time) to
 * keep total wall-clock under a minute even for batches of 15-30. A single
 * concept failing to produce an image_prompt just leaves that concept's
 * image_prompt null — the row still gets inserted so the user sees the
 * idea, with the "Generar imagen" button disabled until owner re-runs.
 */
export async function runIdeationForProduct(opts: {
  productId: string;
  count?: number;
}): Promise<{ inserted: number; failed: number }> {
  const ideasPerBatch = opts.count ?? (await getIdeasPerBatch());

  const concepts = await generateConcepts({ productId: opts.productId, count: ideasPerBatch });

  // Refetch product (we already have it inside generateConcepts but it's
  // cheap and avoids passing the row around).
  const { data: product } = await supabaseAdmin
    .from('products')
    .select('id, name, benefits, category, description')
    .eq('id', opts.productId)
    .single();
  if (!product) throw new Error('Product disappeared mid-flight');

  // Bounded parallelism for stage 2.
  const PARALLEL = 4;
  const enriched: Array<IdeationConcept & { image_prompt: string | null }> = [];
  for (let i = 0; i < concepts.length; i += PARALLEL) {
    const batch = concepts.slice(i, i + PARALLEL);
    const results = await Promise.allSettled(
      batch.map((concept) => generateImagePromptForConcept({ concept, product }))
    );
    results.forEach((r, idx) => {
      const concept = batch[idx];
      if (r.status === 'fulfilled') {
        enriched.push({ ...concept, image_prompt: r.value });
      } else {
        console.error('[IDEATION] image prompt failed for concept:', concept.headline, r.reason);
        enriched.push({ ...concept, image_prompt: null });
      }
    });
  }

  // Insert all rows. We don't dedupe against existing concepts — each
  // ideation run produces a fresh batch and the UI shows them all.
  const rows = enriched.map((c) => ({
    product_id: opts.productId,
    awareness_level: c.awareness_level,
    headline: c.headline,
    description: c.description,
    hook: c.hook || null,
    cta: c.cta || null,
    image_prompt: c.image_prompt,
  }));

  const { error: insertErr } = await supabaseAdmin
    .from('ad_concepts')
    .insert(rows);
  if (insertErr) {
    throw new Error(`Failed to insert ad_concepts: ${insertErr.message}`);
  }

  return {
    inserted: rows.length,
    failed: enriched.filter((c) => !c.image_prompt).length,
  };
}
