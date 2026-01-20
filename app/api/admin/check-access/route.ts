import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const { userId, sessionClaims } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const userEmail = sessionClaims?.email as string | undefined;
    const adminEmails = process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(',').map(e => e.trim().toLowerCase()) || [];
    const isAdmin = userEmail ? adminEmails.includes(userEmail.toLowerCase()) : false;

    return NextResponse.json({
      userId,
      email: userEmail,
      adminEmails,
      isAdmin,
      envVarExists: !!process.env.NEXT_PUBLIC_ADMIN_EMAILS,
      envVarValue: process.env.NEXT_PUBLIC_ADMIN_EMAILS,
    });
  } catch (error: any) {
    console.error('Error checking admin access:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

