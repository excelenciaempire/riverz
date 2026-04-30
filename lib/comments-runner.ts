/**
 * Comments mining — pulls page-post comments for an ad and runs them
 * through Gemini to extract sentiment + recurring objections + questions.
 *
 * Used by both `POST /api/meta/ads/[adId]/comments` (on-demand) and the
 * weekly cron `app/api/meta/comments/cron-poll/route.ts`.
 *
 * Persists the structured analysis into:
 *   meta_ad_intel.comments_summary    (one-paragraph human read)
 *   meta_ad_intel.comments_insights   (structured JSON for the UI)
 *   meta_ad_intel.comments_synced_at  (so we can age-out stale rows)
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getStoryComments, MetaAuthError, type MetaComment } from '@/lib/meta-client';
import { analyzeWithGemini3Pro, type GeminiMessage } from '@/lib/kie-client';
import type { MetaCommentsInsights } from '@/types/meta';

const COMMENTS_PROMPT = `Eres un experto en marketing de respuesta directa.
Te paso los comentarios de un anuncio de Meta. Tu trabajo: clasificar el sentimiento,
extraer las objeciones recurrentes (lo que frena la compra) y las dudas más comunes.

Devuelve EXCLUSIVAMENTE un JSON válido con esta estructura. No incluyas \`\`\`json
ni texto antes o después:

{
  "summary": "Resumen de 1-3 oraciones del sentimiento general + lo más importante.",
  "insights": {
    "total": <int>,
    "sentiment": {
      "positive": <int>, "negative": <int>, "question": <int>, "neutral": <int>
    },
    "top_objections": ["...", "..."],
    "top_questions":  ["...", "..."],
    "praise":         ["...", "..."]
  }
}`;

function safeParseJson(text: string): any | null {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {
        /* ignore */
      }
    }
    return null;
  }
}

export type CommentsOutcome =
  | { kind: 'ok'; total: number }
  | { kind: 'no-comments' }
  | { kind: 'no-story' }
  | { kind: 'auth-error'; message: string }
  | { kind: 'failed'; message: string };

export async function runCommentsForAd(
  supabase: SupabaseClient,
  userId: string,
  adId: string,
  storyId: string | null,
  token: string,
): Promise<CommentsOutcome> {
  if (!storyId) return { kind: 'no-story' };

  let comments: MetaComment[];
  try {
    comments = await getStoryComments(token, storyId, 200);
  } catch (err: any) {
    if (err instanceof MetaAuthError) {
      return { kind: 'auth-error', message: err.message };
    }
    return { kind: 'failed', message: err?.message || 'Graph error' };
  }

  if (comments.length === 0) {
    // Still flag synced so the cron doesn't keep retrying empty posts.
    await supabase
      .from('meta_ad_intel')
      .update({ comments_synced_at: new Date().toISOString() })
      .eq('clerk_user_id', userId)
      .eq('meta_ad_id', adId);
    return { kind: 'no-comments' };
  }

  // Cap context: 100 comments × ~300 chars is plenty for sentiment work.
  const sample = comments
    .slice(0, 100)
    .map((c) => `- ${c.message.replace(/\s+/g, ' ').slice(0, 300)}`)
    .join('\n');

  const messages: GeminiMessage[] = [
    {
      role: 'system',
      content: 'Devuelves SIEMPRE JSON válido. Nunca incluyes ```json fences ni texto extra.',
    },
    { role: 'user', content: `${COMMENTS_PROMPT}\n\nCOMENTARIOS:\n${sample}` },
  ];

  let raw: string;
  try {
    raw = String(await analyzeWithGemini3Pro(messages, { temperature: 0.2, maxTokens: 2000 }));
  } catch (err: any) {
    return { kind: 'failed', message: err?.message || 'kie.ai/Gemini falló' };
  }

  const parsed = safeParseJson(raw);
  if (!parsed) return { kind: 'failed', message: 'Gemini no devolvió JSON parseable' };

  const summary: string | null = typeof parsed.summary === 'string' ? parsed.summary : null;
  const insights: MetaCommentsInsights | null = parsed.insights ?? null;

  if (insights && typeof insights === 'object') {
    insights.total = comments.length;
  }

  await supabase
    .from('meta_ad_intel')
    .update({
      comments_summary: summary,
      comments_insights: insights,
      comments_synced_at: new Date().toISOString(),
    })
    .eq('clerk_user_id', userId)
    .eq('meta_ad_id', adId);

  return { kind: 'ok', total: comments.length };
}
