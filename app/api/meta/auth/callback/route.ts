import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { exchangeCodeForToken, getLongLivedToken, getMe } from '@/lib/meta-client';
import { encrypt } from '@/lib/crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

function buildRedirect(req: Request, params: Record<string, string>): NextResponse {
  const base = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
  const url = new URL('/campanas/meta', base);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = NextResponse.redirect(url);
  res.cookies.delete('meta_oauth_state');
  return res;
}

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  const errorDescription = url.searchParams.get('error_description');

  if (error) {
    return buildRedirect(req, { error: errorDescription || error });
  }

  if (!code || !state) {
    return buildRedirect(req, { error: 'Faltan parámetros de OAuth' });
  }

  const cookieHeader = req.headers.get('cookie') || '';
  const stateCookie = cookieHeader
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith('meta_oauth_state='))
    ?.split('=')[1];

  if (!stateCookie || stateCookie !== state) {
    return buildRedirect(req, { error: 'state inválido' });
  }

  const redirectUri = process.env.META_OAUTH_REDIRECT_URI!;
  try {
    const short = await exchangeCodeForToken(code, redirectUri);
    const long = await getLongLivedToken(short.access_token);
    const me = await getMe(long.access_token);
    const encrypted = encrypt(long.access_token);
    const expiresAt = long.expires_in
      ? new Date(Date.now() + long.expires_in * 1000).toISOString()
      : null;

    const { error: upsertError } = await supabaseAdmin
      .from('meta_connections')
      .upsert(
        {
          clerk_user_id: userId,
          fb_user_id: me.id,
          fb_user_name: me.name,
          access_token_ciphertext: encrypted.ciphertext,
          access_token_iv: encrypted.iv,
          access_token_tag: encrypted.tag,
          token_expires_at: expiresAt,
          scopes: [
            'ads_management',
            'ads_read',
            'business_management',
            'pages_show_list',
            'pages_read_engagement',
            'public_profile',
          ],
          status: 'active',
          last_error: null,
        },
        { onConflict: 'clerk_user_id' },
      );

    if (upsertError) {
      return buildRedirect(req, { error: `No se pudo guardar la conexión: ${upsertError.message}` });
    }

    return buildRedirect(req, { connected: '1' });
  } catch (err: any) {
    const message = err?.message || 'Error desconocido al conectar con Meta';
    return buildRedirect(req, { error: message });
  }
}
