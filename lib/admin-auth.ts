import { auth, currentUser } from '@clerk/nextjs/server';
import { isAdminEmail } from './admin-emails';

export interface AdminCheckResult {
  ok: boolean;
  userId: string | null;
  email: string | null;
  reason?: 'unauthenticated' | 'no_email' | 'not_admin';
}

/**
 * Reusable admin check. Used by every /api/admin/** route that mutates state
 * or reads sensitive cross-tenant data.
 *
 * Returns ok=true only when:
 *  - the request has a valid Clerk session
 *  - the user has a primary email
 *  - that email is in the admin allowlist (lib/admin-emails: hardcoded
 *    OWNER_EMAILS + NEXT_PUBLIC_ADMIN_EMAILS env)
 *
 * Never returns the admin list to callers — only the boolean.
 */
export async function requireAdmin(): Promise<AdminCheckResult> {
  const { userId } = await auth();
  if (!userId) return { ok: false, userId: null, email: null, reason: 'unauthenticated' };

  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress?.toLowerCase() || null;
  if (!email) return { ok: false, userId, email: null, reason: 'no_email' };

  if (!isAdminEmail(email)) {
    return { ok: false, userId, email, reason: 'not_admin' };
  }

  return { ok: true, userId, email };
}
