# Riverz Security Notes

## Threat model

- **Browser**: Clerk handles auth. Cookies are SameSite=Lax by default — that's correct for our login flow.
- **API routes**: every server route validates Clerk session. Admin endpoints use `lib/admin-auth.requireAdmin()` to gate access by email allowlist (`NEXT_PUBLIC_ADMIN_EMAILS`).
- **Database**: Supabase Postgres with RLS enabled on every user-owned table. Server routes use the service-role key, which bypasses RLS — that's fine because every server route filters by `clerk_user_id`. Never use the service-role key client-side.
- **Storage**: Supabase Storage. The `stealer` bucket is private (signed URLs only). `generations` is public-read because users need to download their own results without auth gymnastics; row keys are UUIDs (unguessable). Avatars/templates are public on purpose.
- **External AI**: kie.ai (Claude, Veo, Nano Banana), OpenAI (Whisper), ElevenLabs (TTS). All are server-side calls keyed by env vars.

## Hardening already applied (commit history)

| Surface | Mitigation | Where |
|---|---|---|
| Hardcoded API keys in source | Removed every fallback; `KIE_API_KEY` is now mandatory | `lib/kie-client.ts`, `app/api/ai/**` |
| Setup files with leaked secrets | Deleted from repo + `.gitignore` patterns added | root |
| Admin endpoints without admin check | `lib/admin-auth.requireAdmin()` applied | `app/api/admin/**` |
| `check-access` leaking admin email list | Returns only `{ isAdmin: boolean }` | `app/api/admin/check-access/route.ts` |
| Credit deduction race | Optimistic concurrency with `eq('credits', current)` retry loop | `app/api/credits/deduct/route.ts`, `app/api/static-ads/clone/route.ts` |
| SSRF via image fetch | Hostname allowlist + private-IP block on `imageUrlToBase64` and `downloadImage` | `lib/kie-client.ts` |
| Prompt-injection via product fields | `injectVariables` neutralizes `{}`, strips control chars, caps length | `lib/get-ai-prompt.ts` |
| Stealer ingest accepting any MIME | Allowlist of video MIMEs + 500 MB cap | `app/api/stealer/ingest/route.ts` |
| Missing security headers | CSP, HSTS, X-Frame-Options, Permissions-Policy in `next.config.ts` | `next.config.ts` |
| `Math.random()` fallback in token gen | Removed; throws if Web Crypto missing | `lib/security.ts` |
| No rate limiting on expensive AI routes | `rateLimit()` wrapper on clone, edit, stealer ingest | various |
| Stealer scenes/jobs/assets without RLS | RLS + owner-read policies | `lib/supabase/stealer-migration.sql` |

## Manual rotations the operator must do

These secrets were exposed in earlier commits or in this conversation transcript.
**They must be rotated before any of the hardening above matters.**

1. **Stripe webhook secret** (`whsec_…`) — was in `STRIPE_ENV_VARS.txt` until commit removing it. Rotate in Stripe Dashboard → Developers → Webhooks → reveal & roll. Update `STRIPE_WEBHOOK_SECRET` on Vercel + Render.
2. **Stripe live secret key** (`sk_live_…`) — visible in plaintext to anyone reading this transcript. Rotate in Stripe Dashboard → API keys → reveal & roll. Update `STRIPE_SECRET_KEY` everywhere.
3. **Clerk live secret key** (`sk_live_…`) — same. Clerk Dashboard → API Keys → rotate. Update `CLERK_SECRET_KEY`.
4. **Clerk webhook secret** (`whsec_…`) — Clerk Dashboard → Webhooks → rotate. Update `CLERK_WEBHOOK_SECRET`.
5. **Supabase service role JWT** — Supabase project → Settings → API → "Reset" service role key. Update `SUPABASE_SERVICE_ROLE_KEY` everywhere (Vercel + Render + worker when deployed).
6. **kie.ai API key** — generate a fresh one at https://kie.ai/api-key, set as `KIE_API_KEY` everywhere, then revoke all earlier keys (`174d2…ccc2b` and `81b33…be706`).
7. **Render API token** — was pasted in chat. Rotate at https://dashboard.render.com/u/settings → API Keys.
8. **GitHub PAT** — was pasted in early conversation. Revoke at https://github.com/settings/tokens.
9. **droidapps / ffmpeg API key** found inside the deleted `UGC_RIVERZ.json` n8n export — if still in use, rotate.

After rotating each, do a fresh production deploy on Vercel and Render so the new value flows through.

## Optional follow-ups (not yet implemented)

- **Webhook HMAC** instead of query-param secret on `/api/webhooks/kie`. kie.ai does not currently sign callbacks; if they add it, switch from `?secret=` to header HMAC.
- **Cleanup git history**: `git filter-repo --invert-paths --paths-from-file leaky-files.txt` to scrub `STRIPE_ENV_VARS.txt`, `install.ps1`, `UGC_RIVERZ.json`, etc. from every old commit. Followed by `git push --force` (dangerous — coordinate with anyone else with clones first).
- **CSP report-only mode** during a week to find legitimate violations before flipping to enforce.
- **Move admin allowlist from `NEXT_PUBLIC_ADMIN_EMAILS` to Clerk Organizations** for proper RBAC.
- **Replace in-memory rate-limiter with Upstash Redis** so limits hold across multiple Vercel instances.

## Reporting a vulnerability

Email security@riverzai.com (or DM the founder directly). Please don't open a public issue.
