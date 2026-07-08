# TenantMatch

Sheet-driven paid workbook link flow for commercial real estate teams:

- Add `broker_name`, `email`, and `listing_address` rows to a Google Sheet
- Click **Process new rows** in `/workspace`
- Write the buyer-specific paywall URL back into the row's `link` column, creating that column if needed
- Show 1 preview row before payment
- Unlock full CSV + PDF after Stripe checkout
- Optionally run an autonomous daily ZIP discovery flow that fills the intake sheet and drafts broker outreach in adjacent tabs

## Run locally

1. Install dependencies:

```bash
npm install
```

2. Copy env file:

```bash
cp .env.example .env.local
```

3. Start dev server:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Env notes

- `APP_URL` is the optional server-only canonical URL; if unset, the app falls back to `NEXT_PUBLIC_APP_URL`.
- `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` enable auth.
- `DATABASE_URL` is still used for auth, subscriptions, and workspace state, but TenantMatch link persistence now lives in Google Sheets.
- `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` enable lite payment checkout + webhook syncing.
- `LITE_ADMIN_LINK_SECRET` optionally signs `/a/:token` admin workbook links separately; if unset, the app reuses `STRIPE_WEBHOOK_SECRET`.
- `NEXT_PUBLIC_APP_URL` must be a public `https://...` URL in production so generated buyer links are not written as `localhost`.
- `LITE_LINK_PRICE_CENTS` controls the default one-time buyer price.
- `LITE_GOOGLE_SHEET_URL` points at the Google Sheet used for both the intake queue and the archive tab.
- `LITE_GOOGLE_SHEET_TAB_NAME` optionally chooses the intake tab; otherwise the first tab is used.
- `LITE_GOOGLE_LINKS_TAB_NAME` controls the archive tab used for workbook backups and payment state.
- `LITE_ZIP_TARGETS_TAB_NAME`, `LITE_DISCOVERED_LISTINGS_TAB_NAME`, `LITE_BROKER_OUTREACH_QUEUE_TAB_NAME`, and `LITE_AUTOMATION_RUNS_TAB_NAME` control the auxiliary automation tabs.
- `LITE_DISCOVERY_DAILY_LIMIT` sets the default daily promotion cap per ZIP.
- `LITE_DISCOVERY_MAX_VALIDATIONS_PER_RUN` caps how many discovered candidates are fully validated in one automation run.
- `LITE_DISCOVERY_VALIDATION_CONCURRENCY` controls how many candidate validations run at once.
- `LITE_AUTOMATION_SECRET` or `CRON_SECRET` protects the automation routes; `LITE_AUTOMATION_TENANT_ID` pins scheduled runs to the correct tenant when no interactive user is present.
- `GOOGLE_SERVICE_ACCOUNT_EMAIL` + `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` enable server-side Google Sheets read/write access.
- `AI_USE_MOCK=1` uses deterministic mock CSV output (default in example).
- Set `AI_USE_MOCK=0` + `OPENAI_API_KEY` (or legacy `OPEN_API_KEY`) to call OpenAI.
- `TENANTMATCH_MOCK_AGENTIC_FLOW` must stay unset or `0` in production. The legacy `TIMPANI_MOCK_AGENTIC_FLOW` name is still accepted for compatibility.
- `AI_WORKBOOK_MODEL` controls workbook generation model (default `gpt-5.4`).
- `AI_SITE_CONTEXT_MODEL` controls optional screenshot-to-context extraction (default `gpt-5.4`).
- `GMAIL_FROM_EMAIL`, `GMAIL_SENDER_NAME`, `GMAIL_OAUTH_CLIENT_ID`, `GMAIL_OAUTH_CLIENT_SECRET`, and `GMAIL_OAUTH_REFRESH_TOKEN` power the autonomous broker-outreach send flow.
- Set `LANGSMITH_TRACING=true` + `LANGSMITH_API_KEY` to capture agent/LLM traces in LangSmith.
- Optional `LANGSMITH_PROJECT` controls project name in LangSmith (defaults to `tenantmatch`).

## Production checklist

Before going live, make sure all of the following are true:

- `APP_URL` or `NEXT_PUBLIC_APP_URL` is set to your public production domain, for example `https://tenantmatch.yourdomain.com`
- `LITE_GOOGLE_SHEET_URL` points at the production spreadsheet and the service account can edit both tabs
- `STRIPE_SECRET_KEY` is a live `sk_live_...` key
- `STRIPE_WEBHOOK_SECRET` matches the webhook endpoint configured for `POST /api/webhooks/stripe`
- `LITE_ADMIN_LINK_SECRET` is optional but recommended if you want admin links signed with a separate secret
- `LITE_AUTOMATION_SECRET` or `CRON_SECRET` is set before enabling scheduled discovery/send jobs
- `LITE_AUTOMATION_TENANT_ID` is set if Supabase auth is enabled and cron runs need a fixed tenant context
- Gmail OAuth refresh-token credentials are set for `mike@tenantmatch.app`
- `AI_USE_MOCK=0`
- `TENANTMATCH_MOCK_AGENTIC_FLOW` is unset or `0`
- Google Sheets service account credentials are set
- `OPENAI_API_KEY` is set

Example deploy step for non-lite schema changes:

```bash
npx prisma migrate deploy
```

## API routes

- `POST /api/lite/sheets/process` → scan the configured Google Sheet and write new paywall links back to blank `link` cells
- `GET /api/lite/links` → list recent lite links for the admin dashboard
- `POST /api/lite/links/:token/opened` → mark first buyer page view
- `POST /api/lite/links/:token/checkout` → create one-time Stripe checkout for a lite link
- `POST /api/lite/discovery/run` → select one ZIP target, discover public listings, promote qualified rows into intake, generate links, and queue broker outreach drafts
- `POST /api/lite/outreach/process-approved` → send approved broker-outreach queue rows using Gmail OAuth
- `POST /api/lite/listings/request-another` → create a fresh intake row and preview link from a paid/admin workbook page
- `POST /api/webhooks/stripe` → sync subscription status from Stripe events
- `GET /r/:token` → public lite paywall/unlock page
- `GET /r/:token/download/csv` → paid CSV download
- `GET /r/:token/download/pdf` → paid PDF download
- `GET /a/:token?sig=...` → signed admin workbook view with full rows and downloads

## Google Sheet columns

The launch sheet can use these headers:

- `listing_address` for the property address
- `email` for the buyer/broker email
- `broker_name` for the optional display name
- `listing_title`, `property_type`, `zip`, and `source_url` are optional operator metadata columns used by the autonomous discovery flow
- `site_context` for optional copied listing/site evidence
- `site_context_image_urls` for optional public image URLs or local image paths during manual/local runs
- `force_regenerate` to force a fresh workbook instead of reusing the cached address result
- `link` for the generated paywall URL

If the `link` header is missing, the processor adds it in the next column during the first run.

The parser also accepts the earlier generic aliases `address`, `buyer_email`, and `buyer_name`.

## Notes

- In mock mode (`TENANTMATCH_MOCK_AGENTIC_FLOW=1`), workbook generation, sheet rows, and lite link persistence all fall back to deterministic in-memory fixtures so the flow can be tested without live external services.
- The automation routes are ready for Vercel cron or another scheduler, but no schedule is enabled by default in repo config; set the secret envs first, then attach your preferred scheduler.
