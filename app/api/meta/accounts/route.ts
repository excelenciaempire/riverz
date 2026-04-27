import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { listAdAccounts, MetaAuthError } from '@/lib/meta-client';
import { decrypt } from '@/lib/crypto';
import type { AccountsResponse } from '@/types/meta';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: connection, error } = await supabaseAdmin
    .from('meta_connections')
    .select('*')
    .eq('clerk_user_id', userId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!connection) {
    return NextResponse.json({ requiresReconnect: true, error: 'No hay conexión con Meta' }, { status: 401 });
  }
  if (connection.status !== 'active') {
    return NextResponse.json(
      { requiresReconnect: true, error: connection.last_error || 'La conexión con Meta está inactiva' },
      { status: 401 },
    );
  }

  let token: string;
  try {
    token = decrypt({
      ciphertext: connection.access_token_ciphertext,
      iv: connection.access_token_iv,
      tag: connection.access_token_tag,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: `No se pudo descifrar el token de Meta: ${err?.message || 'error'}` },
      { status: 500 },
    );
  }

  try {
    const accounts = await listAdAccounts(token);
    const response: AccountsResponse = {
      accounts,
      default_ad_account_id: connection.default_ad_account_id,
      fb_user_name: connection.fb_user_name,
    };
    return NextResponse.json(response);
  } catch (err: any) {
    if (err instanceof MetaAuthError) {
      await supabaseAdmin
        .from('meta_connections')
        .update({ status: 'expired', last_error: err.message })
        .eq('clerk_user_id', userId);
      return NextResponse.json(
        { requiresReconnect: true, error: err.message },
        { status: 401 },
      );
    }
    return NextResponse.json({ error: err?.message || 'Error en Meta API' }, { status: 502 });
  }
}
