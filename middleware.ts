import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// 🎨 PREVIEW MODE: Set to true to disable authentication and see the UI
// ⚠️ CAMBIAR A FALSE una vez tengas .env.local configurado
const PREVIEW_MODE = false;

const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks(.*)',
  '/api/meta/upload/cron-poll',
]);

export default clerkMiddleware(async (auth, request) => {
  // PREVIEW MODE: Allow all routes without authentication
  if (PREVIEW_MODE) {
    return NextResponse.next();
  }

  const { userId } = await auth();

  // Allow public routes
  if (isPublicRoute(request)) {
    return NextResponse.next();
  }

  // Protect all other routes - require authentication
  if (!userId) {
    // Use APP_URL to avoid Render internal URL (localhost:10000)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.url;
    const pathname = new URL(request.url).pathname;
    const signInUrl = new URL('/sign-in', baseUrl);
    signInUrl.searchParams.set('redirect_url', `${baseUrl}${pathname}`);
    return NextResponse.redirect(signInUrl);
  }

  // Allow authenticated users to access all routes
  // Admin check will be done in the page component
  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};

