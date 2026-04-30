# Shopify integration setup

This is the one-time setup that has to happen before any Riverz user can hit
"Conectar Shopify" in `/configuracion` and publish landings to their store.

## 1. Create the Shopify Partner app

1. Sign in at https://partners.shopify.com → **Apps** → **Create app** → **Create app manually**.
2. Name it (e.g. "Riverz Landing Publisher").
3. **App URL**: `https://riverzai.com/configuracion?tab=integrations`
4. **Allowed redirection URLs** (add all of these):
   - `https://riverzai.com/api/shopify/callback`
   - `https://riverzai.com/configuracion?tab=integrations`
5. Under **API credentials** copy the `Client ID` and `Client secret` — we set these as env vars below.

### Required scopes

Set the app's access scopes (under **App configuration → Access scopes**) to:

```
write_files,write_content
```

These are the minimum needed to upload images (Files API) and create
storefront pages (Pages API). Don't grant more — Shopify reviews larger
scope requests more strictly.

### Mandatory GDPR webhooks

Configure all three under **App configuration → Compliance webhooks**:

| Topic                   | Endpoint URL                                                       |
| ----------------------- | ------------------------------------------------------------------ |
| Customer data request   | `https://riverzai.com/api/shopify/webhooks/customers-data-request` |
| Customer data erasure   | `https://riverzai.com/api/shopify/webhooks/customers-redact`       |
| Shop data erasure       | `https://riverzai.com/api/shopify/webhooks/shop-redact`            |

### App-uninstalled webhook

Under **App configuration → Webhooks** (or via the Admin API after install)
subscribe `app/uninstalled` to:

```
https://riverzai.com/api/shopify/webhooks/app-uninstalled
```

This is what flips connection rows to `status = 'uninstalled'` when a
merchant removes the app from their admin — without it the next publish
attempt 401s in a confusing way.

## 2. Set environment variables

Add these to the Render environment (and `.env.local` for local dev):

```bash
# Required
SHOPIFY_API_KEY=<the client id from the Partner dashboard>
SHOPIFY_API_SECRET=<the client secret from the Partner dashboard>
SHOPIFY_OAUTH_REDIRECT_URI=https://riverzai.com/api/shopify/callback

# Optional (defaults shown)
SHOPIFY_API_VERSION=2025-01
SHOPIFY_SCOPES=write_files,write_content

# Already present for the Meta integration — Shopify reuses the same
# encryption key for stored access tokens, so nothing new to generate.
META_TOKEN_ENCRYPTION_KEY=<64-hex-char string from `openssl rand -hex 32`>
```

`NEXT_PUBLIC_APP_URL` should already be `https://riverzai.com` in prod —
the OAuth callback uses it to bounce the merchant back to the settings
page after a successful install.

## 3. Run the database migration

The integration adds two tables. Apply
`lib/supabase/shopify-connections-migration.sql` once against the prod
database:

```bash
psql "$SUPABASE_DB_URL" -f lib/supabase/shopify-connections-migration.sql
```

Or paste the file contents into the Supabase SQL editor.

## 4. Verify end-to-end

1. As a Riverz user, go to `/configuracion → Integraciones`.
2. Type your dev shop (`yourshop.myshopify.com`) → **Conectar Shopify**.
3. Approve the install in Shopify's UI.
4. You should be bounced back to settings with a green "Shopify conectado" toast.
5. Open `/landing-lab`, edit any landing, click **🛒 Publicar en Shopify**.
6. Wait ~20–40s while images upload to Files and the Page is created.
7. The public URL opens automatically (`yourshop.com/pages/<handle>`).

## 5. Distribution model

The app stays **unlisted** for now — merchants install via the Partner
dashboard's "Test on dev store" / a per-merchant install link. When you're
ready to put it on the Shopify App Store, you'll need:

- A privacy policy URL on `riverzai.com/privacy` covering Shopify data.
- App listing assets (icon, screenshots, copy).
- Pass Shopify's manual review (typically 1–2 weeks, picks at things
  like uninstall behavior and webhook reliability).

The code already complies with the post-install requirements (HMAC on
every webhook, GDPR endpoints respond ≤5s with 200), so the review path
is mostly about the listing page itself.
