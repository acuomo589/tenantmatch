# Timpani Lite

Sheet-driven paid workbook link flow for commercial real estate teams:

- Add `broker_name`, `email`, and `listing_address` rows to a Google Sheet
- Click **Process new rows** in `/workspace`
- Write the buyer-specific paywall URL back into the row's `link` column, creating that column if needed
- Show 1 preview row before payment
- Unlock full CSV + PDF after Stripe checkout

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
- `DATABASE_URL` is still used for auth, subscriptions, and workspace state, but Timpani Lite link persistence now lives in Google Sheets.
- `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` enable lite payment checkout + webhook syncing.
- `NEXT_PUBLIC_APP_URL` must be a public `https://...` URL in production so generated buyer links are not written as `localhost`.
- `LITE_LINK_PRICE_CENTS` controls the default one-time buyer price.
- `LITE_GOOGLE_SHEET_URL` points at the Google Sheet used for both the intake queue and the archive tab.
- `LITE_GOOGLE_SHEET_TAB_NAME` optionally chooses the intake tab; otherwise the first tab is used.
- `LITE_GOOGLE_LINKS_TAB_NAME` controls the archive tab used for workbook backups and payment state.
- `GOOGLE_SERVICE_ACCOUNT_EMAIL` + `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` enable server-side Google Sheets read/write access.
- `AI_USE_MOCK=1` uses deterministic mock CSV output (default in example).
- Set `AI_USE_MOCK=0` + `OPENAI_API_KEY` (or legacy `OPEN_API_KEY`) to call OpenAI.
- `TIMPANI_MOCK_AGENTIC_FLOW` must stay unset or `0` in production.
- `AI_WORKBOOK_MODEL` controls workbook generation model (default `gpt-5.4`).
- Set `LANGSMITH_TRACING=true` + `LANGSMITH_API_KEY` to capture agent/LLM traces in LangSmith.
- Optional `LANGSMITH_PROJECT` controls project name in LangSmith (defaults to `timpani-proto`).

## Production checklist

Before going live, make sure all of the following are true:

- `APP_URL` or `NEXT_PUBLIC_APP_URL` is set to your public production domain, for example `https://tenantmatch.yourdomain.com`
- `LITE_GOOGLE_SHEET_URL` points at the production spreadsheet and the service account can edit both tabs
- `STRIPE_SECRET_KEY` is a live `sk_live_...` key
- `STRIPE_WEBHOOK_SECRET` matches the webhook endpoint configured for `POST /api/webhooks/stripe`
- `AI_USE_MOCK=0`
- `TIMPANI_MOCK_AGENTIC_FLOW` is unset or `0`
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
- `POST /api/webhooks/stripe` → sync subscription status from Stripe events
- `GET /r/:token` → public lite paywall/unlock page
- `GET /r/:token/download/csv` → paid CSV download
- `GET /r/:token/download/pdf` → paid PDF download

## Google Sheet columns

The launch sheet can use these headers:

- `listing_address` for the property address
- `email` for the buyer/broker email
- `broker_name` for the optional display name
- `link` for the generated paywall URL

If the `link` header is missing, the processor adds it in the next column during the first run.

The parser also accepts the earlier generic aliases `address`, `buyer_email`, and `buyer_name`.

## Notes

- In mock mode (`TIMPANI_MOCK_AGENTIC_FLOW=1`), workbook generation, sheet rows, and lite link persistence all fall back to deterministic in-memory fixtures so the flow can be tested without live external services.
