import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { resolveConnection } from '@/lib/meta-connection';
import { isPollable, pollSingleUpload } from '@/lib/meta-poll';
import type { MetaUpload, UploadStatusResponse } from '@/types/meta';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

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

  const uploads = (rows || []) as MetaUpload[];
  const processing = uploads.filter((r) => r.status === 'processing' && r.meta_asset_id);

  if (processing.length > 0) {
    const { data: connection } = await supabaseAdmin
      .from('meta_connections')
      .select('*')
      .eq('clerk_user_id', userId)
      .maybeSingle();

    if (connection) {
      const resolved = resolveConnection(connection);
      if (resolved.ok) {
        const now = Date.now();
        const pollable = processing.filter((r) => isPollable(r, now));
        for (const row of pollable) {
          const outcome = await pollSingleUpload(supabaseAdmin, row, resolved.token);
          if (outcome.kind === 'auth-error') {
            await supabaseAdmin
              .from('meta_connections')
              .update({ status: 'expired', last_error: outcome.message })
              .eq('clerk_user_id', userId);
            break;
          }
          if (outcome.kind === 'updated') {
            const idx = uploads.findIndex((u) => u.id === row.id);
            if (idx >= 0) uploads[idx] = outcome.row;
          }
        }
      } else if (resolved.markExpired) {
        await supabaseAdmin
          .from('meta_connections')
          .update({ status: 'expired', last_error: 'token_expired' })
          .eq('clerk_user_id', userId);
      }
    }
  }

  const allDone = uploads.every((r) => r.status === 'ready' || r.status === 'failed');
  const response: UploadStatusResponse = {
    uploads,
    allDone,
  };
  return NextResponse.json(response);
}
