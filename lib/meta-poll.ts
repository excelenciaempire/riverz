import type { SupabaseClient } from '@supabase/supabase-js';
import { getVideoStatus, MetaAuthError } from '@/lib/meta-client';
import type { MetaUpload } from '@/types/meta';

export const MAX_POLLS = 60;
export const MIN_POLL_INTERVAL_MS = 3000;

export type PollOutcome =
  | { kind: 'auth-error'; message: string }
  | { kind: 'updated'; row: MetaUpload }
  | { kind: 'skipped' };

export function isPollable(row: Pick<MetaUpload, 'last_polled_at'>, now: number = Date.now()): boolean {
  if (!row.last_polled_at) return true;
  const last = new Date(row.last_polled_at).getTime();
  return now - last >= MIN_POLL_INTERVAL_MS;
}

export async function pollSingleUpload(
  supabase: SupabaseClient,
  row: MetaUpload,
  token: string,
): Promise<PollOutcome> {
  if (row.status !== 'processing' || !row.meta_asset_id) {
    return { kind: 'skipped' };
  }

  if ((row.poll_attempts || 0) >= MAX_POLLS) {
    await supabase
      .from('meta_uploads')
      .update({ status: 'failed', error_message: 'timeout' })
      .eq('id', row.id);
    return {
      kind: 'updated',
      row: { ...row, status: 'failed', error_message: 'timeout' },
    };
  }

  try {
    const result = await getVideoStatus(token, row.meta_asset_id);
    const newStatus =
      result.status === 'ready' ? 'ready' : result.status === 'error' ? 'failed' : 'processing';
    const update: Record<string, unknown> = {
      status: newStatus,
      poll_attempts: (row.poll_attempts || 0) + 1,
      last_polled_at: new Date().toISOString(),
    };
    if (newStatus === 'failed') update.error_message = result.errorMessage || 'Meta error';
    if (newStatus === 'ready') update.error_message = null;

    await supabase.from('meta_uploads').update(update).eq('id', row.id);

    return {
      kind: 'updated',
      row: {
        ...row,
        status: newStatus,
        poll_attempts: (row.poll_attempts || 0) + 1,
        last_polled_at: update.last_polled_at as string,
        error_message: (update.error_message as string | null | undefined) ?? row.error_message,
      },
    };
  } catch (err: any) {
    if (err instanceof MetaAuthError) {
      return { kind: 'auth-error', message: err.message };
    }
    return { kind: 'skipped' };
  }
}
