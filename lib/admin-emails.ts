/**
 * Admin allowlist resolver.
 *
 * Returns the merged list of admin emails: hardcoded owner emails (always
 * allowed even when no env var is set) + any addresses configured via
 * NEXT_PUBLIC_ADMIN_EMAILS.
 *
 * Add more co-owners to OWNER_EMAILS if a teammate needs permanent access
 * regardless of deployment env. For per-deploy admins, use the env var.
 */

const OWNER_EMAILS = ['riverzoficial@gmail.com'];

export function getAdminEmails(): string[] {
  const fromEnv = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const owners = OWNER_EMAILS.map((e) => e.toLowerCase());
  return Array.from(new Set([...owners, ...fromEnv]));
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return getAdminEmails().includes(email.toLowerCase());
}
