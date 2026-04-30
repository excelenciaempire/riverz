import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { resolveConnection } from '@/lib/meta-connection';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export interface AuthedMetaContext {
  userId: string;
  token: string;
  connection: any;
  supabase: typeof supabaseAdmin;
}

export type MetaAuthResult =
  | { ok: true; ctx: AuthedMetaContext }
  | { ok: false; response: NextResponse };

/**
 * Single helper used by every Meta-aware route:
 *  - 401 if not signed in
 *  - 401 + requiresReconnect if no connection / expired
 *  - flips the row to 'expired' when token is past TTL
 *  - returns decrypted token + supabase admin client when ok
 */
export async function getMetaContext(): Promise<MetaAuthResult> {
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const { data: connection, error } = await supabaseAdmin
    .from('meta_connections')
    .select('*')
    .eq('clerk_user_id', userId)
    .maybeSingle();

  if (error) {
    return { ok: false, response: NextResponse.json({ error: error.message }, { status: 500 }) };
  }

  const resolved = resolveConnection(connection);
  if (!resolved.ok) {
    if (resolved.markExpired) {
      await supabaseAdmin
        .from('meta_connections')
        .update({ status: 'expired', last_error: 'token_expired' })
        .eq('clerk_user_id', userId);
    }
    const body: Record<string, unknown> = { error: resolved.error };
    if (resolved.requiresReconnect) body.requiresReconnect = true;
    return { ok: false, response: NextResponse.json(body, { status: resolved.status }) };
  }

  return {
    ok: true,
    ctx: { userId, token: resolved.token, connection, supabase: supabaseAdmin },
  };
}

export async function markConnectionExpired(userId: string, message: string): Promise<void> {
  await supabaseAdmin
    .from('meta_connections')
    .update({ status: 'expired', last_error: message })
    .eq('clerk_user_id', userId);
}

export { supabaseAdmin };
