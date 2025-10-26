import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';

// 🎨 PREVIEW MODE: Set to true to disable authentication and see the UI
// ⚠️ CAMBIAR A FALSE una vez tengas .env.local configurado
const PREVIEW_MODE = false;

const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks(.*)',
  '/admin$', // Solo la página de login del admin es pública
]);

const isAdminRoute = createRouteMatcher([
  '/admin/dashboard(.*)',
  '/api/admin(.*)',
]);

async function isAdminUser(email: string): Promise<boolean> {
  const adminEmails = process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(',').map(e => e.trim().toLowerCase()) || [];
  return adminEmails.includes(email.toLowerCase());
}

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
    const signInUrl = new URL('/sign-in', request.url);
    signInUrl.searchParams.set('redirect_url', request.url);
    return NextResponse.redirect(signInUrl);
  }

  // Check admin routes
  if (isAdminRoute(request)) {
    const user = await currentUser();
    const userEmail = user?.emailAddresses[0]?.emailAddress;

    if (!userEmail || !(await isAdminUser(userEmail))) {
      // Redirect to unauthorized page
      return NextResponse.redirect(new URL('/admin/unauthorized', request.url));
    }
  }

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

