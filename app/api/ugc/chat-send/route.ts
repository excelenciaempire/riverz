import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const MAX_COUNT = 4;
const ALLOWED_MODELS = new Set(['veo3', 'veo3_fast', 'veo3_lite']);
const ALLOWED_ASPECTS = new Set(['16:9', '9:16', 'Auto']);

interface ChatSendBody {
  prompt: string;
  firstFrameUrl?: string | null;
  lastFrameUrl?: string | null;
  model?: 'veo3' | 'veo3_fast' | 'veo3_lite';
  aspectRatio?: '16:9' | '9:16' | 'Auto';
  count?: number;
  projectId?: string | null; // append to an existing chat session
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: ChatSendBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const prompt = (body.prompt || '').trim();
  if (!prompt) return NextResponse.json({ error: 'prompt es requerido' }, { status: 400 });
  if (prompt.length > 2000)
    return NextResponse.json({ error: 'prompt demasiado largo (máx 2000)' }, { status: 400 });

  const model = body.model && ALLOWED_MODELS.has(body.model) ? body.model : 'veo3_fast';
  const aspectRatio = body.aspectRatio && ALLOWED_ASPECTS.has(body.aspectRatio) ? body.aspectRatio : '9:16';
  const count = Math.max(1, Math.min(MAX_COUNT, Math.floor(body.count || 1)));

  // Validate any provided frame URL is on our Supabase storage host (basic SSRF protection).
  const allowedHost = (() => {
    try {
      return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).host;
    } catch {
      return null;
    }
  })();
  for (const url of [body.firstFrameUrl, body.lastFrameUrl].filter(Boolean) as string[]) {
    if (!allowedHost) break;
    try {
      if (new URL(url).host !== allowedHost) {
        return NextResponse.json({ error: `URL no permitida: ${url}` }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: `URL inválida: ${url}` }, { status: 400 });
    }
  }

  // Pricing
  const { data: pricing } = await supabaseAdmin
    .from('pricing_config')
    .select('credits_cost')
    .eq('mode', 'ugc')
    .eq('is_active', true)
    .maybeSingle();
  const costPerVideo = pricing?.credits_cost ?? 100;
  const totalCost = costPerVideo * count;

  // Credit check + deduct atomically via RPC if available; otherwise read-then-update.
  const { data: credits } = await supabaseAdmin
    .from('user_credits')
    .select('credits')
    .eq('clerk_user_id', userId)
    .maybeSingle();
  if (!credits || credits.credits < totalCost) {
    return NextResponse.json(
      { error: `Créditos insuficientes (necesitas ${totalCost}, tienes ${credits?.credits ?? 0})` },
      { status: 402 },
    );
  }

  // Resolve or create the chat project.
  let projectId = body.projectId || null;
  if (projectId) {
    const { data: existing } = await supabaseAdmin
      .from('projects')
      .select('id, clerk_user_id')
      .eq('id', projectId)
      .eq('clerk_user_id', userId)
      .maybeSingle();
    if (!existing) projectId = null; // fall through to create
  }

  if (!projectId) {
    const name = prompt.length > 60 ? prompt.slice(0, 60) + '…' : prompt;
    const { data: project, error: projError } = await supabaseAdmin
      .from('projects')
      .insert({
        clerk_user_id: userId,
        name,
        type: 'ugc_chat',
        status: 'processing',
      })
      .select()
      .single();
    if (projError || !project) {
      return NextResponse.json({ error: projError?.message || 'No se pudo crear el chat' }, { status: 500 });
    }
    projectId = project.id;
  }

  // Insert N generation rows.
  const inputData = {
    prompt,
    firstFrameUrl: body.firstFrameUrl || null,
    lastFrameUrl: body.lastFrameUrl || null,
    model,
    aspectRatio,
  };
  const rows = Array.from({ length: count }, (_, i) => ({
    clerk_user_id: userId,
    project_id: projectId,
    type: 'ugc_video',
    status: 'pending_generation' as const,
    cost: costPerVideo,
    input_data: { ...inputData, index: i + 1, total: count },
  }));
  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('generations')
    .insert(rows)
    .select('id, status, input_data');
  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // Deduct credits.
  await supabaseAdmin
    .from('user_credits')
    .update({ credits: credits.credits - totalCost })
    .eq('clerk_user_id', userId);

  // Fire-and-forget: kick off the queue immediately.
  const cronSecret = process.env.CRON_SECRET;
  const appOrigin = process.env.NEXT_PUBLIC_APP_URL;
  if (cronSecret && appOrigin && projectId) {
    fetch(`${appOrigin}/api/ugc/process-queue`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cronSecret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ projectId }),
    }).catch((err) => console.error('[UGC_CHAT_SEND] kickoff failed:', err?.message || err));
  }

  return NextResponse.json({
    projectId,
    generations: inserted,
    costDeducted: totalCost,
  });
}
