import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { randomBytes } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const API_VERSION = process.env.META_GRAPH_API_VERSION || 'v23.0';
// Only scopes that Graph v23 currently accepts. Three I tried earlier
// (pages_manage_ads, instagram_basic, read_insights) are rejected as
// "Invalid Scopes" in the OAuth dialog — they were either deprecated or
// renamed and are no longer grantable. We get equivalent capabilities via:
//   ads_management        — create campaigns + upload assets
//   ads_read              — list ads + read insights at the ad/account level
//                           (Marketing-API insights, replaces read_insights)
//   business_management   — list business-owned ad accounts + IG linking
//   pages_show_list       — pick a Facebook Page (also exposes the page's
//                           linked instagram_business_account → no separate
//                           instagram_basic needed)
//   pages_read_engagement — read page metadata for the picker
//   public_profile        — required minimum for /me
const SCOPES = [
  'ads_management',
  'ads_read',
  'business_management',
  'pages_show_list',
  'pages_read_engagement',
  'public_profile',
].join(',');

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
