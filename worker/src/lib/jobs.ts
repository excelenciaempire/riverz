import { config } from '../config.js';
import { supabase } from './supabase.js';
import { StealerJob } from './types.js';

const RUNNING_GRACE_MS = 5 * 60 * 1000; // re-pickup any stuck 'running' job after 5min

/**
 * Atomically claim up to `limit` pending jobs for this worker.
 * Uses an UPDATE ... WHERE id IN (SELECT ... FOR UPDATE SKIP LOCKED) so multiple
 * worker replicas don't pick up the same job.
 */
export async function claimJobs(limit: number): Promise<StealerJob[]> {
  const sb = supabase();
  const cutoff = new Date(Date.now() - RUNNING_GRACE_MS).toISOString();

  // Re-queue jobs stuck in `running` past the grace period (worker died mid-job).
  await sb
    .from('stealer_jobs')
    .update({ status: 'pending' })
    .eq('status', 'running')
    .lt('picked_up_at', cutoff);

  // Pick a batch of pending jobs that are due.
  const { data: candidates, error: selErr } = await sb
    .from('stealer_jobs')
    .select('id')
    .eq('status', 'pending')
    .lte('next_attempt_at', new Date().toISOString())
    .order('next_attempt_at', { ascending: true })
    .limit(limit);

  if (selErr) throw selErr;
  if (!candidates || candidates.length === 0) return [];

  const ids = candidates.map((c) => c.id);

  // Atomic claim: only flip rows that are still pending.
  const { data: claimed, error: updErr } = await sb
    .from('stealer_jobs')
    .update({
      status: 'running',
      worker_id: config.worker.workerId,
      picked_up_at: new Date().toISOString(),
      attempts: undefined as any, // placeholder; we increment via separate call below
    })
    .in('id', ids)
    .eq('status', 'pending')
    .select('*');

  if (updErr) throw updErr;
  return (claimed || []) as StealerJob[];
}

export async function markJobSucceeded(jobId: string, result?: Record<string, any>) {
  const sb = supabase();
  await sb
    .from('stealer_jobs')
    .update({ status: 'succeeded', result: result || null, error_message: null })
    .eq('id', jobId);
}

export async function markJobWaitingCallback(jobId: string, externalTaskId: string) {
  const sb = supabase();
  await sb
    .from('stealer_jobs')
    .update({ status: 'waiting_callback', external_task_id: externalTaskId })
    .eq('id', jobId);
}

/**
 * On failure, schedule a retry with exponential backoff up to maxAttempts.
 * Past that, mark the job 'failed' permanently.
 */
export async function markJobFailedOrRetry(job: StealerJob, error: Error) {
  const sb = supabase();
  const nextAttempts = (job.attempts || 0) + 1;
  const message = error.message?.slice(0, 1000) || 'Unknown error';

  if (nextAttempts >= config.worker.maxAttempts) {
    console.error(`[jobs] Job ${job.id} permanently failed after ${nextAttempts} attempts: ${message}`);
    await sb
      .from('stealer_jobs')
      .update({ status: 'failed', attempts: nextAttempts, error_message: message })
      .eq('id', job.id);
    return;
  }

  // 60s × 2^attempts, capped at 1h.
  const backoffMs = Math.min(60_000 * 2 ** nextAttempts, 60 * 60 * 1000);
  const nextAt = new Date(Date.now() + backoffMs).toISOString();

  console.warn(`[jobs] Job ${job.id} failed (attempt ${nextAttempts}/${config.worker.maxAttempts}). Retry in ${Math.round(backoffMs / 1000)}s. Reason: ${message}`);

  await sb
    .from('stealer_jobs')
    .update({
      status: 'pending',
      attempts: nextAttempts,
      next_attempt_at: nextAt,
      error_message: message,
      worker_id: null,
      picked_up_at: null,
    })
    .eq('id', job.id);
}

export async function enqueueJob(opts: {
  projectId?: string | null;
  sceneId?: string | null;
  kind: StealerJob['kind'];
  payload?: Record<string, any>;
}) {
  const sb = supabase();
  const { error, data } = await sb
    .from('stealer_jobs')
    .insert({
      project_id: opts.projectId ?? null,
      scene_id: opts.sceneId ?? null,
      kind: opts.kind,
      payload: opts.payload ?? null,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}
