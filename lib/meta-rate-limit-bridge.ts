/**
 * Connects metaFetch's usage reporter (in lib/meta-client.ts) with the
 * persistent cooldown store (in lib/meta-rate-limit.ts).
 *
 * Each Meta-aware route imports `bindMetaUsageReporter(userId)` once at
 * the top of the handler. From that point on, every Graph response
 * piped through metaFetch updates the cooldown row for the matching
 * (userId, ad_account_id) so the next request can pre-flight check
 * before hammering Graph again.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { setMetaUsageReporter } from '@/lib/meta-client';
import { setCooldown, postFlightUsage } from '@/lib/meta-rate-limit';

// codes → human-friendly label for the UI
const BUC_LABEL: Record<number, string> = {
  80000: 'Insights de anuncios',
  80001: 'Páginas',
  80002: 'Instagram',
  80003: 'Audiencia personalizada',
  80004: 'Administración de anuncios',
  80005: 'Generación de leads',
  80006: 'Messenger',
  80008: 'WhatsApp Business',
  80009: 'Catálogo (admin)',
  80014: 'Catálogo (lote)',
};

/**
 * Install a usage reporter scoped to one user. Returns an unbind function
 * the caller MUST invoke at the end of the handler so a cron job's user
 * doesn't leak into the next request.
 */
export function bindMetaUsageReporter(
  supabase: SupabaseClient,
  userId: string,
): () => void {
  setMetaUsageReporter((report) => {
    // Fire-and-forget: cooldown writes shouldn't block the in-flight request.
    void (async () => {
      try {
        if (report.errorCode && BUC_LABEL[report.errorCode]) {
          // Hard BUC throttle. Use estimated_time_to_regain_access from the
          // header when present, otherwise default to 60 minutes (Meta's
          // typical reset window for ad-account quotas).
          const minutes = report.snapshot?.estimatedTimeToRegainAccessMin || 60;
          const reason = `${BUC_LABEL[report.errorCode]}: ${report.errorMessage || 'rate limit'}`;
          await setCooldown(
            supabase,
            userId,
            report.snapshot?.adAccountId ?? null,
            minutes * 60,
            reason,
            report.snapshot,
          );
          return;
        }
        // Successful response — preventive cooldown when usage is high.
        await postFlightUsage(supabase, userId, report.snapshot);
      } catch {
        /* never throw out of a fire-and-forget */
      }
    })();
  });
  return () => setMetaUsageReporter(null);
}
