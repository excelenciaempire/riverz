import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { analyzeWithGemini3Pro, type GeminiMessage } from '@/lib/kie-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const TRANSCRIPT_TRUNCATE = 800;
const ADS_PER_GROUP = 25;

interface AdLite {
  meta_ad_id: string;
  ad_name: string | null;
  campaign_name: string | null;
  transcript: string | null;
  primary_text: string | null;
  headline: string | null;
  cta: string | null;
  is_winner: boolean | null;
  insights: any;
  comments_summary: string | null;
}

function fmtAd(a: AdLite): string {
  const ins = a.insights || {};
  const parts = [
    `# ${a.ad_name || a.meta_ad_id} (${a.campaign_name || '—'})`,
    a.is_winner === true
      ? 'Marcado: WINNER'
      : a.is_winner === false
        ? 'Marcado: NO FUNCIONA'
        : 'Sin marcar',
    `Spend: ${ins.spend ?? '—'} · CTR: ${ins.ctr ?? '—'} · ROAS: ${ins.roas ?? '—'} · Compras: ${ins.purchases ?? 0}`,
    a.headline ? `Headline: ${a.headline}` : '',
    a.primary_text ? `Texto: ${a.primary_text.slice(0, 300)}` : '',
    a.cta ? `CTA: ${a.cta}` : '',
    a.transcript
      ? `Transcript:\n${a.transcript.slice(0, TRANSCRIPT_TRUNCATE)}`
      : 'Transcript: (no disponible)',
    a.comments_summary ? `Comentarios: ${a.comments_summary.slice(0, 300)}` : '',
  ].filter(Boolean);
  return parts.join('\n');
}

function buildPrompt(winners: AdLite[], losers: AdLite[], unmarked: AdLite[]): string {
  return `Eres analista senior de Meta Ads en e-commerce DTC. Te paso un resumen de los anuncios de UNA marca.
Tu trabajo: extraer patrones del WINNERS vs LOSERS para que el equipo creativo escriba el próximo anuncio con base en data, no en intuición.

WINNERS (${winners.length}):
${winners.map(fmtAd).join('\n\n---\n\n') || '(ninguno)'}

LOSERS (${losers.length}):
${losers.map(fmtAd).join('\n\n---\n\n') || '(ninguno)'}

SIN MARCAR (${unmarked.length} — ignora si los marcados arriba bastan):
${unmarked.map(fmtAd).join('\n\n---\n\n') || '(ninguno)'}

Devuelve EXCLUSIVAMENTE un JSON válido con esta estructura. NO incluyas \`\`\`json ni texto antes o después:

{
  "winner_patterns": {
    "hooks": ["..."],                  // 3-6 hooks visuales/verbales que se repiten
    "lengths": { "median_seconds": 0, "range": [0, 0] },  // 0 si solo hay imágenes
    "ctas": ["..."],
    "angles": ["..."],                  // 3-6 ángulos de venta usados
    "common_phrases": ["..."]           // frases que aparecen en >=2 winners
  },
  "loser_patterns": { /* misma estructura */ },
  "comparison": "1-3 oraciones explicando la diferencia clave entre winners y losers",
  "comments_themes": ["..."],           // temas recurrentes en comentarios (puede ser [])
  "brief": "Brief listo-para-pegar del próximo anuncio: hook + ángulo + estructura + CTA + duración. Máximo 8 líneas. Apóyate solo en lo que funcionó."
}`;
}

function safeParseJson(text: string): any | null {
  // Strip markdown fences if Gemini decides to add them despite instructions.
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // Try to grab the first balanced { ... } block
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

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const url = new URL(req.url);
  const adAccountId = url.searchParams.get('adAccountId');
  if (!adAccountId) {
    return NextResponse.json({ error: 'adAccountId requerido' }, { status: 400 });
  }

  const { data: rows, error } = await supabaseAdmin
    .from('meta_ad_intel')
    .select(
      'meta_ad_id, ad_name, campaign_name, transcript, primary_text, headline, cta, is_winner, insights, comments_summary',
    )
    .eq('clerk_user_id', userId)
    .eq('ad_account_id', adAccountId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!rows || rows.length === 0) {
    return NextResponse.json(
      { error: 'No hay anuncios en esta cuenta. Carga la lista primero.' },
      { status: 400 },
    );
  }

  const ads = rows as AdLite[];
  const bySpend = (a: AdLite, b: AdLite) =>
    (Number(b.insights?.spend) || 0) - (Number(a.insights?.spend) || 0);
  const winners = ads.filter((a) => a.is_winner === true).sort(bySpend).slice(0, ADS_PER_GROUP);
  const losers = ads.filter((a) => a.is_winner === false).sort(bySpend).slice(0, ADS_PER_GROUP);
  const unmarked = ads.filter((a) => a.is_winner == null).sort(bySpend).slice(0, ADS_PER_GROUP);

  if (winners.length === 0 && losers.length === 0) {
    return NextResponse.json(
      {
        error:
          'Aún no marcaste ningún anuncio como winner ni como no-funciona. Marca al menos algunos para que la IA pueda comparar.',
      },
      { status: 400 },
    );
  }

  const prompt = buildPrompt(winners, losers, unmarked);
  const messages: GeminiMessage[] = [
    {
      role: 'system',
      content:
        'Eres un analista de Meta Ads. Devuelves SIEMPRE JSON válido, sin texto extra. Nunca incluyes ```json fences.',
    },
    { role: 'user', content: prompt },
  ];

  let raw: string;
  try {
    raw = String(await analyzeWithGemini3Pro(messages, { temperature: 0.3, maxTokens: 12000 }));
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'kie.ai/Gemini falló' },
      { status: 502 },
    );
  }

  const parsed = safeParseJson(raw);
  if (!parsed) {
    return NextResponse.json(
      { error: 'Gemini no devolvió JSON parseable.', raw: raw.slice(0, 1000) },
      { status: 502 },
    );
  }

  const brief: string | null = typeof parsed.brief === 'string' ? parsed.brief : null;
  const dna_data = {
    winner_patterns: parsed.winner_patterns ?? null,
    loser_patterns: parsed.loser_patterns ?? null,
    comparison: parsed.comparison ?? null,
    comments_themes: parsed.comments_themes ?? null,
  };

  const upsertRow = {
    clerk_user_id: userId,
    ad_account_id: adAccountId,
    winner_count: winners.length,
    loser_count: losers.length,
    unmarked_count: unmarked.length,
    dna_data,
    brief,
    generated_at: new Date().toISOString(),
  };
  const { data: saved, error: upsertErr } = await supabaseAdmin
    .from('meta_brand_dna')
    .upsert(upsertRow, { onConflict: 'clerk_user_id,ad_account_id' })
    .select('*')
    .maybeSingle();
  if (upsertErr) return NextResponse.json({ error: upsertErr.message }, { status: 500 });

  return NextResponse.json({ dna: saved });
}

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const url = new URL(req.url);
  const adAccountId = url.searchParams.get('adAccountId');
  if (!adAccountId) {
    return NextResponse.json({ error: 'adAccountId requerido' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('meta_brand_dna')
    .select('*')
    .eq('clerk_user_id', userId)
    .eq('ad_account_id', adAccountId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ dna: data });
}
