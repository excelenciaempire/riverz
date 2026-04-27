import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

/**
 * GET /api/admin/check-access
 * Returns whether the current Clerk user is an admin.
 *
 * Locked-down on purpose: NEVER returns the admin email list, the user's email,
 * or any environment-variable contents. The dashboard only needs a boolean.
 */
export async function GET() {
  try {
    const { userId, sessionClaims } = await auth();

    if (!userId) {
      return NextResponse.json({ isAdmin: false }, { status: 401 });
    }

    const userEmail = (sessionClaims?.email as string | undefined)?.toLowerCase() || null;
    const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    const isAdmin = !!userEmail && adminEmails.includes(userEmail);

    return NextResponse.json({ isAdmin });
  } catch (error: any) {
    console.error('[admin/check-access] error:', error);
    return NextResponse.json({ isAdmin: false }, { status: 500 });
  }
}
