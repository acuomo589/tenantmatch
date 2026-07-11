# TenantMatch Run Book

TenantMatch is a local, CLI-driven, sheet-backed workflow.

- The Google Sheet is the operating system.
- Your local repo runs discovery, promotion, workbook generation, and draft creation.
- The hosted app at `https://tenantmatch.app` serves public links, admin links, Stripe checkout, and Stripe webhooks.

## What Runs Where

- Local CLI runs the core workflow.
- `localhost:3000` is optional for local UI development.
- `tenantmatch.app` must be deployed with matching code for generated `/r/{token}` and `/a/{token}` links to open correctly.

## Main Sheet Tabs

- `Intake tab`
  Add or receive rows to process into preview/paywall links.
  Configure this explicitly with `LITE_GOOGLE_SHEET_TAB_NAME=Intake`; the app should never guess the first tab.
- `TenantMatch Links`
  Archive and source of truth for token, payment state, workbook backup data, paywall link, and admin link.
- `ZIP Targets`
  Controls which ZIP gets processed next.
- `Qualified Listings`
  Main review tab. One row per listing with grouped brokers and links.
- `Discovered Listings`
  Raw append-only processing log for discovery, skips, promotions, and generated links.
- `Broker Outreach Queue`
  Holds broker email drafts for review and approval.
- `Automation Runs`
  Daily job log with counts and errors.

## Daily Flow

1. The system selects the first active ZIP marked `PENDING` or `IN_PROGRESS`.
2. It researches public Retail and Industrial listings for that ZIP.
3. It skips stale listings, duplicates, wrong property types, and listings without a trustworthy broker email.
4. It promotes up to `25` qualified listings into the intake tab.
5. It runs the existing Lite processor for those new rows.
6. It creates:
   - a public paywall link at `/r/{token}`
   - a signed admin link at `/a/{token}?sig=...`
7. It creates one outreach draft per processed listing in `Broker Outreach Queue`.
8. You review drafts in the sheet and set `approval_status` to `APPROVED`.
9. The send route sends only `APPROVED` and `UNSENT` rows from `Mike at TenantMatch <mike@tenantmatch.app>`.

## ZIP Progression Rule

- If a ZIP produces `25` qualified promotions, it stays `IN_PROGRESS` and runs again next day.
- If a ZIP produces fewer than `25`, it is marked `DONE`.
- On the next run, the system moves to the next active ZIP.

## Operator Tasks

### Add ZIPs

Use `ZIP Targets` with these fields:

- `zip`
- `active`
- `sequence`
- `status`
- `daily_limit`
- `last_run_at`
- `last_qualified_count`
- `completed_at`
- `notes`

### Review Drafts

Work in `Broker Outreach Queue`.

- Edit `subject` and `body` as needed.
- Change `approval_status` from `DRAFT` to `APPROVED` when ready.
- Leave `send_status` alone; the app manages it.

### Inspect Results

Use:

- `Qualified Listings` as the main operator review surface
- `Discovered Listings` to see what was found, skipped, or promoted
- `Automation Runs` to see run counts and failures
- `TenantMatch Links` to confirm workbook state, token, and payment status

## Manual Commands

Run locally:

```bash
npm run dev
```

Run discovery locally for one ZIP:

```bash
npm run discovery -- 01749
```

Run more than the safe default one listing:

```bash
npm run discovery -- 01749 --limit 25
```

Run a no-cost in-memory smoke test:

```bash
npm run discovery -- 01749 --mock --limit 1 --max-validations 1
```

Optional hosted link check after generation:

```bash
npm run discovery -- 01749 --limit 1 --check-links
```

Send approved outreach manually:

```bash
curl -X POST https://tenantmatch.app/api/lite/outreach/process-approved \
  -H "Authorization: Bearer YOUR_AUTOMATION_SECRET"
```

Run contract tests:

```bash
npm run test:contracts
```

## Required Production Env

- `APP_URL` or `NEXT_PUBLIC_APP_URL`
- `LITE_GOOGLE_SHEET_URL`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`
- `OPENAI_API_KEY`
- `AI_USE_MOCK=0`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `LITE_AUTOMATION_SECRET` or `CRON_SECRET`
- `LITE_AUTOMATION_TENANT_ID`
- `GMAIL_FROM_EMAIL`
- `GMAIL_SENDER_NAME`
- `GMAIL_OAUTH_CLIENT_ID`
- `GMAIL_OAUTH_CLIENT_SECRET`
- `GMAIL_OAUTH_REFRESH_TOKEN`

## Common Problems

### No links generated

Check:

- sheet service-account permissions
- `LITE_GOOGLE_SHEET_URL`
- `APP_URL` or `NEXT_PUBLIC_APP_URL`
- OpenAI key and model settings
- app logs

### Payment succeeds but workbook does not unlock

Check:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- Stripe webhook delivery logs
- hosted app logs

### Outreach emails do not send

Check:

- row is `APPROVED`
- row is still `UNSENT`
- Gmail OAuth env vars are present
- `Broker Outreach Queue.error`

### Discovery is thin for a ZIP

Usually means:

- public web inventory was sparse
- pages were stale
- broker email was missing or low confidence
- duplicates were filtered out

## Current v1 Scope

- One ZIP per day
- Up to `25` qualified promotions per day
- Property types: `Retail` and `Industrial`
- Draft review happens in Google Sheets
- Repeat purchase path is `Run another listing`, not subscription
