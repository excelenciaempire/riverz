import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import {
  listAdAccounts,
  listPages,
  listInstagramAccountsForPage,
  MetaAuthError,
} from '@/lib/meta-client';
import { resolveConnection } from '@/lib/meta-connection';
import type { AccountsResponse } from '@/types/meta';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/**
 * Returns the user's Meta context: ad accounts + the saved defaults
 * (cuenta + page + IG). On the first hit after a fresh OAuth (or any
 * time defaults are missing) it auto-discovers and persists sane
 * defaults so the dashboard never shows an unconfigured state:
 *   - default_ad_account_id  → first ad account
 *   - default_page_id        → first page that has IG, else first page
 *   - default_instagram_id   → IG linked to that page (if any)
 *
 * Failures during auto-discovery are swallowed so a transient page/IG
 * Graph error never blocks the connection itself from showing up.
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: connection, error } = await supabaseAdmin
    .from('meta_connections')
    .select('*')
    .eq('clerk_user_id', userId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const resolved = resolveConnection(connection);
  if (!resolved.ok) {
    if (resolved.markExpired) {
      await supabaseAdmin
        .from('meta_connections')
        .update({ status: 'expired', last_error: 'token_expired' })
        .eq('clerk_user_id', userId);
    }
    const body: Record<string, unknown> = { error: resolved.error };
    if (resolved.requiresReconnect) body.requiresReconnect = true;
    return NextResponse.json(body, { status: resolved.status });
  }

  try {
    const accounts = await listAdAccounts(resolved.token);

    // Snapshot of defaults — may be mutated below if we auto-discover.
    let defaults = {
      default_ad_account_id: connection!.default_ad_account_id as string | null,
      default_page_id: connection!.default_page_id as string | null,
      default_page_name: connection!.default_page_name as string | null,
      default_instagram_id: connection!.default_instagram_id as string | null,
      default_instagram_username: connection!.default_instagram_username as string | null,
    };

    const needsAdAccount = !defaults.default_ad_account_id && accounts.length > 0;
    const needsPage = !defaults.default_page_id;
    const needsAutoDiscover = needsAdAccount || needsPage;

    if (needsAutoDiscover) {
      const updates: Record<string, string | null> = {};

      if (needsAdAccount) {
        updates.default_ad_account_id = accounts[0].id;
        defaults.default_ad_account_id = accounts[0].id;
      }

      if (needsPage) {
        try {
          const pages = await listPages(resolved.token);
          if (pages.length > 0) {
            // Prefer a page that already has Instagram linked — that's the
            // combo the user almost always wants for ads on both surfaces.
            const preferred = pages.find((p) => p.has_instagram) || pages[0];
            updates.default_page_id = preferred.id;
            updates.default_page_name = preferred.name;
            defaults.default_page_id = preferred.id;
            defaults.default_page_name = preferred.name;

            if (preferred.has_instagram) {
              try {
                const igs = await listInstagramAccountsForPage(resolved.token, preferred.id);
                if (igs.length > 0) {
                  updates.default_instagram_id = igs[0].id;
                  updates.default_instagram_username = igs[0].username;
                  defaults.default_instagram_id = igs[0].id;
                  defaults.default_instagram_username = igs[0].username;
                }
              } catch {
                /* IG discovery is best-effort */
              }
            }
          }
        } catch {
          /* page discovery is best-effort */
        }
      }

      if (Object.keys(updates).length > 0) {
        await supabaseAdmin
          .from('meta_connections')
          .update(updates)
          .eq('clerk_user_id', userId);
      }
    }

    const response: AccountsResponse = {
      accounts,
      ...defaults,
      fb_user_name: connection!.fb_user_name,
    };
    return NextResponse.json(response);
  } catch (err: any) {
    if (err instanceof MetaAuthError) {
      await supabaseAdmin
        .from('meta_connections')
        .update({ status: 'expired', last_error: err.message })
        .eq('clerk_user_id', userId);
      return NextResponse.json(
        { requiresReconnect: true, error: err.message },
        { status: 401 },
      );
    }
    return NextResponse.json({ error: err?.message || 'Error en Meta API' }, { status: 502 });
  }
}
