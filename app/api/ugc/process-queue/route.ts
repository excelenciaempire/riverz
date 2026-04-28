import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { createVeoTask, getVeoTask, downloadToBuffer, type VeoModel, type VeoAspect } from '@/lib/kie-veo';

export const runtime = 'nodejs';
export const maxDuration = 120;
export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const MIN_POLL_INTERVAL_MS = 4000;
const MAX_POLL_ATTEMPTS = 90; // ~6 min at 4s
const PARALLEL_LIMIT = 4;

export async function POST(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const isCron =
    !!cronSecret && req.headers.get('authorization') === `Bearer ${cronSecret}`;
  if (!isCron) {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let projectId: string | undefined;
  try {
    const body = await req.json();
    projectId = body?.projectId;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }
  if (!projectId) return NextResponse.json({ error: 'projectId es requerido' }, { status: 400 });

  const { data: rows, error } = await supabaseAdmin
    .from('generations')
    .select('*')
    .eq('project_id', projectId)
    .eq('type', 'ugc_video')
    .in('status', ['pending_generation', 'generating']);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!rows || rows.length === 0) {
    return NextResponse.json({ ...(await summarize(projectId)) });
  }

  const work: Promise<void>[] = [];
  for (let i = 0; i < rows.length; i += PARALLEL_LIMIT) {
    const batch = rows.slice(i, i + PARALLEL_LIMIT);
    work.push(
      Promise.allSettled(batch.map((r: any) => processOne(r, projectId!))).then(() => undefined),
    );
  }
  await Promise.all(work);

  return NextResponse.json({ ...(await summarize(projectId)) });
}

async function processOne(row: any, projectId: string) {
  try {
    if (row.status === 'pending_generation') {
      const taskId = await createVeoTask({
        prompt: row.input_data.prompt,
        imageUrls: [row.input_data.firstFrameUrl, row.input_data.lastFrameUrl].filter(Boolean) as string[],
        model: (row.input_data.model as VeoModel) || 'veo3_fast',
        aspect_ratio: (row.input_data.aspectRatio as VeoAspect) || '9:16',
      });
      await supabaseAdmin
        .from('generations')
        .update({
          status: 'generating',
          input_data: { ...row.input_data, veoTaskId: taskId },
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id);
      row.status = 'generating';
      row.input_data = { ...row.input_data, veoTaskId: taskId };
    }

    if (row.status !== 'generating' || !row.input_data?.veoTaskId) return;

    // Light poll: at most a few attempts per tick. The cron will re-tick.
    const attempts = (row.input_data.pollAttempts || 0) as number;
    if (attempts >= MAX_POLL_ATTEMPTS) {
      await supabaseAdmin
        .from('generations')
        .update({ status: 'failed', error_message: 'Veo timeout' })
        .eq('id', row.id);
      return;
    }
    const lastPolled = row.input_data.lastPolledAt
      ? new Date(row.input_data.lastPolledAt).getTime()
      : 0;
    if (Date.now() - lastPolled < MIN_POLL_INTERVAL_MS) return;

    const info = await getVeoTask(row.input_data.veoTaskId);
    const updateBase: Record<string, unknown> = {
      input_data: {
        ...row.input_data,
        pollAttempts: attempts + 1,
        lastPolledAt: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    };

    if (info.status === 'failed') {
      await supabaseAdmin
        .from('generations')
        .update({ ...updateBase, status: 'failed', error_message: `Veo failed (code=${info.rawCode})` })
        .eq('id', row.id);
      return;
    }

    if (info.status === 'success' && info.videoUrl) {
      let resultUrl = info.videoUrl;
      try {
        const buffer = await downloadToBuffer(info.videoUrl);
        const fileName = `${projectId}/${row.id}_${Date.now()}.mp4`;
        const { error: upErr } = await supabaseAdmin.storage
          .from('generations')
          .upload(fileName, buffer, { contentType: 'video/mp4', upsert: true });
        if (!upErr) {
          const { data } = supabaseAdmin.storage.from('generations').getPublicUrl(fileName);
          if (data?.publicUrl) resultUrl = data.publicUrl;
        }
      } catch (e) {
        // fall back to kie url
      }
      await supabaseAdmin
        .from('generations')
        .update({
          ...updateBase,
          status: 'completed',
          result_url: resultUrl,
          error_message: null,
        })
        .eq('id', row.id);
      return;
    }

    // still generating — only update poll counters
    await supabaseAdmin.from('generations').update(updateBase).eq('id', row.id);
  } catch (err: any) {
    console.error('[UGC_PROCESS_QUEUE] row', row.id, 'failed:', err?.message || err);
    await supabaseAdmin
      .from('generations')
      .update({ status: 'failed', error_message: err?.message || 'unknown error' })
      .eq('id', row.id);
  }
}

async function summarize(projectId: string) {
  const { data } = await supabaseAdmin
    .from('generations')
    .select('status')
    .eq('project_id', projectId)
    .eq('type', 'ugc_video');
  const counts = { pending_generation: 0, generating: 0, completed: 0, failed: 0 } as Record<string, number>;
  for (const row of data || []) counts[row.status] = (counts[row.status] || 0) + 1;
  const total = (data || []).length;
  const done = counts.completed + counts.failed;
  return {
    success: true,
    progress: {
      total,
      completed: counts.completed,
      failed: counts.failed,
      generating: counts.generating,
      pending: counts.pending_generation,
      percentage: total > 0 ? Math.round((counts.completed / total) * 100) : 0,
      isComplete: done === total,
    },
  };
}
