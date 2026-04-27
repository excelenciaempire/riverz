import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { getVideoStatus, MetaAuthError } from '@/lib/meta-client';
import { decrypt } from '@/lib/crypto';
import type { UploadStatusResponse } from '@/types/meta';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const MAX_POLLS = 60;
const MIN_POLL_INTERVAL_MS = 3000;

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const idsParam = url.searchParams.get('ids') || '';
  const ids = idsParam.split(',').map((s) => s.trim()).filter(Boolean);
  if (ids.length === 0) {
    return NextResponse.json({ error: 'ids es requerido' }, { status: 400 });
  }
  if (ids.length > 100) {
    return NextResponse.json({ error: 'Máximo 100 ids por consulta' }, { status: 400 });
  }

  const { data: rows, error } = await supabaseAdmin
    .from('meta_uploads')
    .select('*')
    .in('id', ids)
    .eq('clerk_user_id', userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const processing = (rows || []).filter((r) => r.status === 'processing' && r.meta_asset_id);
  if (processing.length > 0) {
    const { data: connection } = await supabaseAdmin
      .from('meta_connections')
      .select('*')
      .eq('clerk_user_id', userId)
      .maybeSingle();

    if (connection && connection.status === 'active') {
      let token: string | null = null;
      try {
        token = decrypt({
          ciphertext: connection.access_token_ciphertext,
          iv: connection.access_token_iv,
          tag: connection.access_token_tag,
        });
      } catch {
        token = null;
      }

      if (token) {
        const now = Date.now();
        const pollable = processing.filter((r) => {
          if (!r.last_polled_at) return true;
          const last = new Date(r.last_polled_at).getTime();
          return now - last >= MIN_POLL_INTERVAL_MS;
        });

        for (const row of pollable) {
          if (row.poll_attempts >= MAX_POLLS) {
            await supabaseAdmin
              .from('meta_uploads')
              .update({ status: 'failed', error_message: 'timeout' })
              .eq('id', row.id);
            row.status = 'failed';
            row.error_message = 'timeout';
            continue;
          }
          try {
            const result = await getVideoStatus(token, row.meta_asset_id!);
            const newStatus =
              result.status === 'ready' ? 'ready' : result.status === 'error' ? 'failed' : 'processing';
            const update: Record<string, unknown> = {
              status: newStatus,
              poll_attempts: (row.poll_attempts || 0) + 1,
              last_polled_at: new Date().toISOString(),
            };
            if (newStatus === 'failed') update.error_message = result.errorMessage || 'Meta error';
            if (newStatus === 'ready') update.error_message = null;
            await supabaseAdmin.from('meta_uploads').update(update).eq('id', row.id);
            row.status = newStatus;
            row.poll_attempts = (row.poll_attempts || 0) + 1;
            row.last_polled_at = update.last_polled_at as string;
            if (newStatus === 'failed') row.error_message = update.error_message as string;
          } catch (err: any) {
            if (err instanceof MetaAuthError) {
              await supabaseAdmin
                .from('meta_connections')
                .update({ status: 'expired', last_error: err.message })
                .eq('clerk_user_id', userId);
              break;
            }
            // Soft fail this poll; row stays processing
          }
        }
      }
    }
  }

  const allDone = (rows || []).every((r) => r.status === 'ready' || r.status === 'failed');
  const response: UploadStatusResponse = {
    uploads: (rows || []) as UploadStatusResponse['uploads'],
    allDone,
  };
  return NextResponse.json(response);
}
