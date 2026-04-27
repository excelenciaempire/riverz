import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { randomBytes } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const API_VERSION = process.env.META_GRAPH_API_VERSION || 'v23.0';
const SCOPES = 'ads_management,business_management,public_profile';

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const appId = process.env.META_APP_ID;
  const redirectUri = process.env.META_OAUTH_REDIRECT_URI;
  if (!appId || !redirectUri) {
    return NextResponse.json(
      { error: 'Meta OAuth no está configurado en el servidor (faltan META_APP_ID o META_OAUTH_REDIRECT_URI).' },
      { status: 500 },
    );
  }

  const state = randomBytes(32).toString('hex');

  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    scope: SCOPES,
    response_type: 'code',
    state,
  });

  const authorizeUrl = `https://www.facebook.com/${API_VERSION}/dialog/oauth?${params.toString()}`;

  const res = NextResponse.redirect(authorizeUrl);
  res.cookies.set('meta_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 10,
    path: '/',
  });
  return res;
}
