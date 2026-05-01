/**
 * Persistent rate-limit tracker for Meta Graph API calls.
 *
 * Why this exists:
 *   metaFetch() in lib/meta-client.ts already parses
 *   x-business-use-case-usage and sleeps inside a single request, but
 *   that information is lost between Vercel invocations. Once we burn
 *   through the BUC budget on /anuncios, every subsequent page load
 *   would still try Graph and either get a 80004 or push us deeper
 *   into the cooldown.
 *
 *   This module persists the cooldown into `meta_rate_limit_state`
 *   keyed by (clerk_user_id, ad_account_id) so:
 *     - The next Vercel invocation can pre-flight check before calling Graph.
 *     - The UI can render a clear "wait N min" banner with a real countdown.
 *     - Cron jobs (bulk transcribe, comments sync) bail out instead of
 *       hammering Meta when we know we're locked out.
 *
 * Cooldown sources (in priority order):
 *   1. Explicit error 80004 / 80000 / 80003 / 17 / 4 — read
 *      estimated_time_to_regain_access from the BUC header.
 *   2. Header usage > 90% on any of call_count / total_cputime / total_time
 *      → preventive 5-minute cooldown.
 *   3. Header usage > 75% → light 1-minute cooldown so concurrent
 *      requests don't tip the account into a hard block.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface RateLimitState {
  cooldownUntil: Date | null;
  reason: string | null;
  callCountPct: number | null;
  totalCpuPct: number | null;
  totalTimePct: number | null;
}

export class RateLimitedError extends Error {
  constructor(
    message: string,
    public retryAfterSec: number,
    public adAccountId: string | null,
  ) {
    super(message);
    this.name = 'RateLimitedError';
  }
}

const ACCOUNT_ID_BLANK = '';

function asPct(n: any): number | null {
  const v = Number(n);
  return Number.isFinite(v) ? Math.min(100, Math.max(0, Math.round(v))) : null;
}

/**
 * Parse the X-Business-Use-Case-Usage header into a flattened summary.
 * Returns the worst (highest call_count) ad-account entry so we can use
 * it as the cooldown anchor — even when the response covers multiple
 * accounts.
 */
export interface BucSnapshot {
  adAccountId: string;
  type: string;
  callCountPct: number | null;
  totalCpuPct: number | null;
  totalTimePct: number | null;
  estimatedTimeToRegainAccessMin: number;
}

export function parseBucHeader(headerValue: string | null): BucSnapshot | null {
  if (!headerValue) return null;
  let json: Record<string, any[]>;
  try {
    json = JSON.parse(headerValue);
  } catch {
    return null;
  }
  let worst: BucSnapshot | null = null;
  for (const [accountId, entries] of Object.entries(json)) {
    if (!Array.isArray(entries)) continue;
    for (const e of entries) {
      const callCount = asPct(e?.call_count);
      const cpu = asPct(e?.total_cputime);
      const time = asPct(e?.total_time);
      const score = Math.max(callCount ?? 0, cpu ?? 0, time ?? 0);
      const candidate: BucSnapshot = {
        adAccountId: accountId,
        type: String(e?.type ?? ''),
        callCountPct: callCount,
        totalCpuPct: cpu,
        totalTimePct: time,
        estimatedTimeToRegainAccessMin: Number(e?.estimated_time_to_regain_access ?? 0) || 0,
      };
      if (
        !worst ||
        score >
          Math.max(worst.callCountPct ?? 0, worst.totalCpuPct ?? 0, worst.totalTimePct ?? 0)
      ) {
        worst = candidate;
      }
    }
  }
  return worst;
}

function ensureAct(adAccountId: string | null | undefined): string {
  if (!adAccountId) return ACCOUNT_ID_BLANK;
  return adAccountId.startsWith('act_') ? adAccountId.slice(4) : adAccountId;
}

/**
 * Read the cached cooldown for (user, account). If `cooldown_until` is
 * still in the future, throws RateLimitedError so the caller bails
 * before touching Graph.
 *
 * Pass adAccountId=null for app-wide checks (e.g. /api/meta/accounts which
 * isn't tied to a single account yet). We fall back to the empty-string row.
 */
export async function assertNotRateLimited(
  supabase: SupabaseClient,
  userId: string,
  adAccountId: string | null,
): Promise<void> {
  const acct = ensureAct(adAccountId);
  const { data } = await supabase
    .from('meta_rate_limit_state')
    .select('cooldown_until, reason')
    .eq('clerk_user_id', userId)
    .in('ad_account_id', acct ? [acct, ACCOUNT_ID_BLANK] : [ACCOUNT_ID_BLANK])
    .order('cooldown_until', { ascending: false, nullsFirst: false })
    .limit(1);
  const row = data?.[0];
  if (!row?.cooldown_until) return;
  const until = new Date(row.cooldown_until);
  const now = Date.now();
  if (until.getTime() <= now) return;
  const retryAfterSec = Math.ceil((until.getTime() - now) / 1000);
  throw new RateLimitedError(
    row.reason || `Rate limit en pausa hasta ${until.toISOString()}.`,
    retryAfterSec,
    acct || null,
  );
}

/**
 * Persist a cooldown for (user, account). Used by:
 *   - metaFetch when Graph returns a BUC throttle error.
 *   - postFlightUsage when headers report a critically high score.
 */
export async function setCooldown(
  supabase: SupabaseClient,
  userId: string,
  adAccountId: string | null,
  durationSec: number,
  reason: string,
  snapshot?: BucSnapshot | null,
): Promise<void> {
  if (durationSec <= 0) return;
  const acct = ensureAct(adAccountId);
  const cooldown_until = new Date(Date.now() + durationSec * 1000).toISOString();
  await supabase
    .from('meta_rate_limit_state')
    .upsert(
      {
        clerk_user_id: userId,
        ad_account_id: acct,
        call_count_pct: snapshot?.callCountPct ?? null,
        total_cputime_pct: snapshot?.totalCpuPct ?? null,
        total_time_pct: snapshot?.totalTimePct ?? null,
        cooldown_until,
        reason,
        last_observed_at: new Date().toISOString(),
      },
      { onConflict: 'clerk_user_id,ad_account_id' },
    );
}

/**
 * Convenience: after a successful response, look at the BUC header. If
 * usage is high, set a preventive cooldown so concurrent calls don't
 * push us over.
 */
export async function postFlightUsage(
  supabase: SupabaseClient,
  userId: string,
  snapshot: BucSnapshot | null,
): Promise<void> {
  if (!snapshot) return;
  const max = Math.max(
    snapshot.callCountPct ?? 0,
    snapshot.totalCpuPct ?? 0,
    snapshot.totalTimePct ?? 0,
  );
  if (max < 75) return;
  // > 90% → 5 min preventive lock; 75-90% → 1 min light pause
  const seconds = max >= 90 ? 5 * 60 : 60;
  const reason = `Uso BUC ${max}% (${snapshot.type}); pausa ${Math.round(seconds / 60)} min`;
  await setCooldown(supabase, userId, snapshot.adAccountId, seconds, reason, snapshot);
}

/**
 * Clear a stale cooldown — called when we successfully complete a call
 * after the window expired. Optional housekeeping.
 */
export async function clearCooldownIfExpired(
  supabase: SupabaseClient,
  userId: string,
  adAccountId: string | null,
): Promise<void> {
  const acct = ensureAct(adAccountId);
  await supabase
    .from('meta_rate_limit_state')
    .update({ cooldown_until: null, reason: null })
    .eq('clerk_user_id', userId)
    .eq('ad_account_id', acct)
    .lt('cooldown_until', new Date().toISOString());
}
