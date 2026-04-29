import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { createVeoTask, type VeoModel, type VeoAspect } from '@/lib/kie-veo';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

function buildKieCallbackUrl(req: Request): string | undefined {
  // Prefer the explicit public URL (Render sets RENDER_EXTERNAL_URL automatically too).
  const explicit = process.env.NEXT_PUBLIC_APP_URL || process.env.RENDER_EXTERNAL_URL;
  let base = (explicit || '').replace(/\/+$/, '');
  if (!base) {
    // Fall back to deriving from the request — works as long as we're behind HTTPS.
    try {
      base = new URL(req.url).origin;
    } catch {
      return undefined;
    }
  }
  if (!/^https:\/\//i.test(base)) {
    // kie.ai will not call HTTP URLs reliably — skip the callback in that case.
    return undefined;
  }
  const url = new URL('/api/webhooks/kie', base);
  const secret = process.env.STEALER_WEBHOOK_SECRET || process.env.KIE_WEBHOOK_SECRET;
  if (secret) url.searchParams.set('secret', secret);
  return url.toString();
}

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

  // Submit each row to kie.ai inline so the user immediately sees `generating`
  // (or `failed` with a real error) instead of a forever-`pending` placeholder.
  // kie.ai's /veo/generate returns within a few seconds — well under the 60s
  // function budget. The actual rendering is async via the callBackUrl webhook.
  const callBackUrl = buildKieCallbackUrl(req);
  const imageUrls = [body.firstFrameUrl, body.lastFrameUrl].filter(Boolean) as string[];
  const submitResults = await Promise.allSettled(
    (inserted || []).map(async (row: any) => {
      const taskId = await createVeoTask({
        prompt,
        imageUrls,
        model: model as VeoModel,
        aspect_ratio: aspectRatio as VeoAspect,
        callBackUrl,
      });
      await supabaseAdmin
        .from('generations')
        .update({
          status: 'generating',
          input_data: { ...row.input_data, veoTaskId: taskId },
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id);
      return { id: row.id, taskId };
    }),
  );

  let submittedOk = 0;
  for (let i = 0; i < submitResults.length; i++) {
    const r = submitResults[i];
    const row = inserted![i];
    if (r.status === 'fulfilled') {
      submittedOk++;
    } else {
      const reason = r.reason?.message || String(r.reason || 'kie.ai rejected the task');
      console.error('[UGC_CHAT_SEND] createVeoTask failed:', reason);
      await supabaseAdmin
        .from('generations')
        .update({
          status: 'failed',
          error_message: reason.slice(0, 500),
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id);
    }
  }

  // If every submission failed, refund the user — they shouldn't pay for a
  // batch where kie.ai accepted zero tasks.
  if (submittedOk === 0) {
    await supabaseAdmin
      .from('user_credits')
      .update({ credits: credits.credits })
      .eq('clerk_user_id', userId);
  } else if (submittedOk < count) {
    // Partial failure — refund the cost of the failed tasks.
    const refund = costPerVideo * (count - submittedOk);
    await supabaseAdmin
      .from('user_credits')
      .update({ credits: credits.credits - totalCost + refund })
      .eq('clerk_user_id', userId);
  }

  return NextResponse.json({
    projectId,
    generations: inserted,
    submitted: submittedOk,
    costDeducted: costPerVideo * submittedOk,
  });
}
