/**
 * API key management — CRUD del usuario actual.
 *
 * - GET  /api/api-keys                 → lista (sin hash, sólo prefix + meta)
 * - POST /api/api-keys                 → crea, devuelve token plaintext UNA vez
 *   Body: { name }
 *
 * Revocación es DELETE en /api/api-keys/{id}.
 */

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/server';
import { issueApiKey } from '@/lib/auth/api-key';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('api_keys')
    .select('id, name, key_prefix, last_used_at, created_at, revoked_at')
    .eq('clerk_user_id', userId)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ keys: data ?? [] });
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { name?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* empty */
  }
  const name = (body.name || 'Untitled').trim().slice(0, 80);

  const issued = issueApiKey();
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('api_keys')
    .insert({
      clerk_user_id: userId,
      name,
      key_prefix: issued.prefix,
      key_hash: issued.hash,
    })
    .select('id, name, key_prefix, created_at')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // El plaintext solo viaja UNA vez en esta respuesta.
  return NextResponse.json({ key: data, token: issued.token });
}
