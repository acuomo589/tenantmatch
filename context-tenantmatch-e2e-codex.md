# TenantMatch End-to-End Context For A New Codex Agent

This document is the current-state handoff for the TenantMatch product flow as implemented in the repo today.

It is written for a new Codex agent that needs to understand:

- the real user journey from listing intake to outreach
- which AI steps are actually implemented
- the exact OpenAI prompts and request shapes
- the output contracts for each agentic action
- the pricing and entitlement logic
- the important gaps between product copy and code reality

If this document conflicts with the UI copy, treat the code as source of truth.

## 1. Product Summary

TenantMatch is a lean commercial real estate workflow app that lets a user:

1. add a listing
2. auto-research the market for that listing
3. explore repositioning or investment options
4. generate a workbook of target businesses
5. open outreach for one workbook row
6. find contact candidates
7. generate and send one outbound email

The current codebase also contains an older "thread/chat/run" tenant-matchmaker prototype. That legacy flow still exists, but it is not the primary listing-detail journey the UI is built around now.

## 2. Current Status At A Glance

Implemented now:

- Workspace listing index
- Listing intake via CSV upload
- Listing intake via ATTOM address/property search
- Listing intake via manual listing text + AI parser
- Automatic market research after listing add
- Listing detail overview editing
- Explore Options tab with structured CRE scenario analysis
- Workbook generation from listing context
- Outreach target creation from a workbook row
- Contact search through Apollo with seeded fallback contacts
- Outreach email generation with OpenAI
- Gmail send
- Pricing page, plan catalog, Stripe checkout/webhook scaffolding
- Tenant-scoped workspace persistence

Partially implemented:

- Listing counts and some plan logic exist, but the active listing-intake flow does not consume the `LISTINGS` entitlement
- Workbook row count is generated as 20+ rows, while the grid paginates at 25 rows
- Outreach shows multiple contacts, but only one selected contact is used for generation/send

Not implemented:

- Proposal generation logic
- Proposal persistence
- Proposal OpenAI route
- Proposal count logic

## 3. Primary File Map

Main UI:

- `src/app/workspace/page.tsx`
- `src/components/workspace/add-listing-modal.tsx`
- `src/components/workspace/workspace-shell.tsx`
- `src/app/listings/[address]/page.tsx`
- `src/app/pricing/page.tsx`

Main client state:

- `src/lib/workspace-client.ts`
- `src/lib/workbookCsv.ts`

Main AI routes:

- `src/app/api/listings/parse/route.ts`
- `src/lib/ai/runStructuredListingParser.ts`
- `src/app/api/listings/research/route.ts`
- `src/app/api/listings/explore-options/route.ts`
- `src/app/api/workbooks/from-listing/route.ts`
- `src/app/api/outreach/generate-email/route.ts`

Non-OpenAI provider routes:

- `src/app/api/outreach/contacts/search/route.ts`
- `src/lib/apollo/client.ts`
- `src/app/api/outreach/send/route.ts`
- `src/app/api/attom/property-v1/[operation]/route.ts`

Pricing and entitlement logic:

- `src/lib/billing/plans.ts`
- `src/lib/billing/entitlements.ts`
- `src/app/api/billing/usage/route.ts`
- `src/app/api/billing/checkout/route.ts`
- `src/app/api/webhooks/stripe/route.ts`
- `src/lib/auth/provisioning.ts`

Prompt assets:

- `workbook-prompt.txt`
- `src/lib/ai/prompt.ts` (legacy flow only)

Legacy prototype flow:

- `src/app/api/run/route.ts`
- `src/app/api/chat/route.ts`
- `src/lib/ai/runBasePrompt.ts`
- `src/lib/store.ts`

## 4. 25-Row Agentic Action Matrix

This is the cleanest row-by-row summary of the live journey and its adjacent logic.

| # | Stage | Trigger / UI | Route / File | Model / Provider | Input | Output | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Landing | `/` hero page | `src/app/page.tsx` | none | anonymous visit | CTA to signup/signin/pricing | live |
| 2 | Pricing | `/pricing` | `src/app/pricing/page.tsx` | none | plan catalog | Free / Plus / Pro cards | live |
| 3 | Workspace empty state | `/workspace` with no listings | `src/app/workspace/page.tsx` | none | hydrated workspace state | single `Add Listing` CTA | live |
| 4 | Add Listing chooser | modal root | `src/components/workspace/add-listing-modal.tsx` | none | user picks mode | upload, search, or details path | live |
| 5 | CSV intake | `Upload CSV` | same modal | none | CSV lines of addresses | `ListingRecord[]` | live |
| 6 | ATTOM search intake | `Search Address API` | same modal + ATTOM proxy | ATTOM | ZIP or address query | ATTOM candidates mapped to `ListingRecord[]` | live |
| 7 | Manual details intake | `Submit Listing Details` | same modal | OpenAI parser or regex fallback | address + raw listing text | parsed `ListingRecord` | live |
| 8 | Listing parse API | manual details submit | `POST /api/listings/parse` | OpenAI `AI_LISTING_PARSER_MODEL` | `rawText`, `address` | `{ listing }` | live |
| 9 | Parser fallback | manual details failure path | `parseListingDetailsToRecord()` | none | raw LoopNet-like text | best-effort `ListingRecord` | live |
| 10 | Add listing to workspace | `onAdd()` | `useWorkspaceData.addListings()` | none | `ListingRecord[]` | state append + status message | live |
| 11 | Auto market research kickoff | after add | `generateListingResearchForListing()` | OpenAI `AI_LISTING_RESEARCH_MODEL` | listing object | `ListingResearchResult` | live |
| 12 | Listing research API | background after add | `POST /api/listings/research` | OpenAI + `web_search` | listing JSON | `{ analysis }` | live |
| 13 | Workspace list page | listing index | `src/app/workspace/page.tsx` | none | hydrated state | cards with counts and metadata | live |
| 14 | Listing detail hero | click one listing | `src/app/listings/[address]/page.tsx` | none | selected listing | hero, stats, tabs, actions | live |
| 15 | Overview editing | Overview tab save | `updateListing()` | none | summary, highlights, notes | updated `ListingRecord` | live |
| 16 | Explore Options trigger | `Explore options` button | `generateExploreOptionsForListing()` | OpenAI `AI_EXPLORE_OPTIONS_MODEL` | listing object | `ExploreOptionsResult` | live |
| 17 | Explore Options API | Options tab generation | `POST /api/listings/explore-options` | OpenAI structured output | listing JSON | `{ analysis }` with 2-4 scenarios | live |
| 18 | Workbook trigger | `Create Workbook` button | `createWorkbookForListing()` | OpenAI `AI_WORKBOOK_MODEL` then fallback model | listing object | `WorkbookResult` | live |
| 19 | Workbook API | workbook generation | `POST /api/workbooks/from-listing` | OpenAI freeform CSV | listing JSON | `{ csv, rows }` | live |
| 20 | Workbook normalization | after workbook response | `parseWorkbookCsv()` | deterministic local code | CSV text | sorted `WorkbookRow[]` | live |
| 21 | Proposal tab | `Proposals` tab | `src/app/listings/[address]/page.tsx` | none | explore result presence only | placeholder copy | placeholder only |
| 22 | Outreach target open | workbook `Contact` button | `openOutreachForRow()` | none | workbook + row | `OutreachTarget` | live |
| 23 | Contact enrichment | outreach open or load more | `POST /api/outreach/contacts/search` | Apollo + seeded fallback | business name, city, state, category | contacts list, pagination flags | live |
| 24 | Outreach email generation | `Generate email` | `POST /api/outreach/generate-email` | OpenAI `AI_OUTREACH_EMAIL_MODEL` | listing + workbook row + selected contact | `{ subject, body }` | live |
| 25 | Email send | `Send via Gmail` | `POST /api/outreach/send` | Gmail API | to, subject, body | Gmail message id | live |

## 5. Real User Journey

### 5.1 Listings Page Layout

Route:

- `/workspace`

Layout:

- top bar: `Listings` label and `Add Listing` button
- empty state: centered `Add Listing` button only
- listing cards: one card per listing

Card columns:

- listing display title
- city / state / postal code
- building type
- last edited
- workbook count
- proposal count
- outreach count

Important current logic:

- `proposalCount` is hard-coded to `0`
- clicking a card navigates to `/listings/[address]`
- cards are based on client workspace state, not a server query of normalized listing tables

### 5.2 Add Listing Modal

The add-listing modal has three entry paths:

1. `Upload CSV`
2. `Search Address API`
3. `Submit Listing Details`

#### Upload CSV path

Expected input:

- CSV where each non-empty row is basically an address line
- header row is optional if first line starts with `address`

Behavior:

- parses locally in browser
- creates minimal `ListingRecord`
- does not call OpenAI

#### ATTOM search path

Expected input:

- ZIP like `02108`
- or full address like `90 Broad St, New York NY 10004`

Behavior:

- calls `/api/attom/property-v1/address`
- if `commercialOnly` and query is ZIP, it fans out across five ATTOM property types:
  - `COMMERCIAL (NEC)`
  - `COMMERCIAL BUILDING`
  - `OFFICE BUILDING`
  - `RETAIL TRADE`
  - `INDUSTRIAL (NEC)`
- for ZIP commercial search it can request up to 3 pages of 100 results per type
- ATTOM results are deduped by `attomId` or address
- mapped to `ListingRecord`

Defaults assigned from ATTOM mapping:

- `source: "ATTOM"`
- `listingType: "FOR_SALE"`
- `lifecycleStatus: "ACTIVE"`

#### Manual listing details path

Expected input:

- address string
- raw pasted listing text

Behavior:

- first tries `POST /api/listings/parse`
- if parser fails, falls back to local LoopNet-style regex parsing

Current parser fallback can extract:

- listing ID
- listing type
- date on market
- last updated
- building size
- lot size
- rental rate
- lease term
- owner provisions
- spaces
- features
- disclosures
- contacts
- tenants

### 5.3 Automatic Market Research

After `addListings()` appends listings to workspace state, it automatically runs market research sequentially for each new listing.

Behavior:

- each listing triggers `POST /api/listings/research`
- result is stored in `listingResearchByListing[listing.id]`
- returned `analysis.listingSummary` overwrites the listing's existing `listingSummary` if present

This means:

- a manually entered summary can be replaced by the AI research summary
- market research is part of the intake flow, not a manual later step

### 5.4 Listing Detail Page Layout

Route:

- `/listings/[address]`

Hero area:

- editable title
- subtitle with city/state/postal
- location blurb
- meta chips:
  - building type
  - listing mode
  - last updated
  - research status
  - options status

Hero action buttons:

- `Explore options`
- `Create Workbook`
- `...` menu with `Delete listing`

Hero stats:

- available size
- lot size
- property type
- market score
- listing score

Tab rail:

- `Overview`
- `Options`
- `Workbooks`
- `Proposals`
- `Outreach`

### 5.5 Overview Tab

Editable sections:

- listing summary
- highlights
- notes

Save behavior:

- writes back to `ListingRecord`
- highlights are merged into `features`
- notes are merged into `disclosures`
- notes are also copied into `constraints`

### 5.6 Explore Options Tab

Trigger:

- user clicks `Explore options` in hero
- or re-runs from same button later

Rendered result:

- summary tab
- one tab per scenario

Summary tab shows:

- property snapshot
- final verdict
- developer summary
- red flags

Scenario tab shows:

- scenario name
- why it fits
- scope / margin / entitlement / financeability tags
- metric grid:
  - target tenant / buyer
  - timeline
  - hard cost / SF
  - total project cost
  - soft costs
  - contingency
  - revenue model
  - exit strategy
  - operator skill
  - exit flipability
- lists:
  - what must be true
  - build-out scope
  - incentives
  - kill points

Important current rule:

- explore options are stored as one latest result per listing, not as a version history

### 5.7 Workbook Tab

Trigger:

- user clicks `Create Workbook`

Rendered result:

- workbook selector
- `Export CSV` button
- AG Grid table

Columns:

- `priority_rank`
- `business_name`
- `category`
- `city`
- `state`
- `distance_miles`
- `tenant_fit_score_100`
- `move_probability_1_10`
- `fit_summary`
- `owner_contact_name`
- action column with `Contact`

Important current row-count reality:

- workbook prompt asks for minimum 20 and target 25-40 rows
- route enforces `MIN_WORKBOOK_ROWS = 20`
- AG Grid paginates at `25` rows per page

For a new Codex agent, if the canonical target is "25 rows", align these three places together:

1. `workbook-prompt.txt`
2. `MIN_WORKBOOK_ROWS`
3. UI copy and tests

### 5.8 Proposal Tab

Current implementation:

- pure placeholder card
- if explore options exist: `Turn the selected option into proposal language for this listing.`
- otherwise: `Explore options first to generate the inputs for a proposal.`

There is:

- no proposal route
- no proposal model call
- no proposal storage
- no proposal count

Recommended interpretation for a new Codex agent:

- the intended proposal input is the selected explore-options scenario
- the proposal stage should sit between options and outreach

Recommended proposal output contract is provided later in this document under "Recommended Future Contract".

### 5.9 Outreach Tab

Trigger:

- user opens workbook row action `Contact`

Outreach target creation behavior:

- creates one `OutreachTarget` per `workbookId + business_name`
- seeds metadata from workbook row
- seeds 3 fallback contacts
- sets `selectedContactId` to the first contact
- immediately tries provider-backed contact enrichment

Rendered outreach layout:

- target selector
- metrics for target company
- "Why this target is on the list"
- email composer
- suggested contacts

Metrics shown:

- business
- category
- location
- distance
- fit
- move probability
- business age
- industry
- parent company
- revenue
- HQ address
- listing

Contact behavior:

- Apollo returns up to 3 contacts per request
- `Load more` can paginate
- if Apollo is unavailable or returns none, fallback seeded contacts remain

One recommended contact rule:

- operationally, TenantMatch works with one selected contact at a time
- canonical recommended contact is:
  - `contacts.find(c => c.id === selectedContactId)`
  - fallback to `contacts[0]`

Email behavior:

- `Generate email` uses listing + workbook row + selected contact
- `Send via Gmail` sends only to the selected contact's email

## 6. OpenAI Calls And Prompts

All active OpenAI calls hit:

- `POST https://api.openai.com/v1/responses`

Shared auth:

- `Authorization: Bearer ${OPENAI_API_KEY}`

AI env defaults:

- `AI_ANALYSIS_MODEL`: `gpt-4.1-mini`
- `AI_LISTING_PARSER_MODEL`: `o3-mini`
- `AI_LISTING_RESEARCH_MODEL`: `gpt-5.4`
- `AI_WORKBOOK_MODEL`: `gpt-5.4`
- `AI_EXPLORE_OPTIONS_MODEL`: `gpt-5.4`
- `AI_OUTREACH_EMAIL_MODEL`: `gpt-4o`

### 6.1 Listing Parser

Route:

- `POST /api/listings/parse`

Implementation file:

- `src/lib/ai/runStructuredListingParser.ts`

Model:

- `AI_LISTING_PARSER_MODEL`, default `o3-mini`

Request shape:

```json
{
  "model": "o3-mini",
  "input": [
    {
      "role": "system",
      "content": "Extract commercial listing details into strict JSON. Prefer concrete values from text. Set addressLine1 to the street address. For locationDescription, capture the strongest location/access phrase from the source text (e.g., near highways, routes, turnpike, transit, or logistics corridors). Also extract ownerProvisions as what ownership is willing to offer the right tenant (e.g., free rent, TI allowance, landlord buildout, rent ramp, flexible term) and leaseTermYears when explicitly stated. Leave missing fields empty."
    },
    {
      "role": "user",
      "content": "Explicit listing address: ...\\n\\n<raw listing text>"
    }
  ],
  "text": {
    "format": {
      "type": "json_schema",
      "name": "listing_structured_parser",
      "schema": "...",
      "strict": false
    }
  },
  "max_output_tokens": 3000
}
```

Important notes:

- schema is `strict: false`
- parser retries up to 2 times
- if `output_parsed` is missing, code falls back to parsing JSON text
- explicit address overrides model-parsed address fields after normalization

Parser output contract:

```ts
type ParsedListing = {
  title?: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  squareFootage?: number;
  lotSizeAcres?: number;
  propertyClass?: string;
  listingType?: "FOR_LEASE" | "FOR_SALE" | "BOTH";
  locationDescription?: string;
  listingSummary?: string;
  ownerProvisions?: string;
  leaseTermYears?: number;
  features?: Array<{ featureValueText?: string }>;
  disclosures?: Array<{ text?: string }>;
};
```

Normalized app output:

- full `ListingRecordLike` with `source: "AI_PARSE"`
- empty `spaces`, `contacts`, `tenants`
- `constraints` copied from disclosures

### 6.2 Listing Market Research

Route:

- `POST /api/listings/research`

Model:

- `AI_LISTING_RESEARCH_MODEL`, default `gpt-5.4`

System prompt:

```text
You are a commercial real estate market research analyst.

Use the uploaded listing details and live web research to assess the greater-area market for this asset.
Return strict JSON only.
Be concise, commercial, and evidence-based.
Separate observed facts from inference.
```

User prompt template:

```text
Analyze this listing for the UI using current web research.

Address: <listingAddress>

Listing JSON:
<stringified listing>

Tasks:
- Research current market health in the greater area for this asset's location, building type, size band, and likely occupier or buyer profile.
- Produce a marketScore from 0-100 for the broader market.
- Produce a listingScore from 0-100 for this specific listing within that market.
- Write a short listingSummary that blends the uploaded facts with what the market research implies.
- Keep the analysis specific to this property and this geography, not a generic city summary.
- Do not invent building facts. If something is unknown, state the assumption and lower confidence.

Scoring guidance:
- marketScore = strength of the broader market right now for this kind of asset in this greater area.
- listingScore = strength of this specific listing relative to that market, based on its known details.
- Be willing to score low.
- 90-100 exceptional, 75-89 strong, 60-74 workable, 40-59 challenged, 0-39 weak.

Return strict JSON only.
```

Extra OpenAI settings:

- `reasoning: { effort: "low" }`
- `max_output_tokens: 2400`
- tool:
  - `web_search`
  - approximate `country: US`
  - listing city/state passed as approximate user location

Structured output:

```ts
type ListingResearchAnalysis = {
  listingSummary: string;
  marketScore: number;
  listingScore: number;
  marketRationale: string;
  listingRationale: string;
  demandSignals: string[];
  headwinds: string[];
  assumptions: string[];
  confidence: "Low" | "Medium" | "High";
};
```

### 6.3 Explore Options

Route:

- `POST /api/listings/explore-options`

Model:

- `AI_EXPLORE_OPTIONS_MODEL`, default `gpt-5.4`

System prompt:

```text
You are a senior commercial real estate developer, zoning analyst, adaptive-reuse specialist, and credit-focused real estate underwriter.

Your task is to return a decision-grade investment analysis in STRICT JSON matching the provided schema.

Rules:
- Be blunt and commercial.
- Distinguish known facts from assumptions.
- Use practical ranges; avoid fake precision.
- Return 2-4 realistic scenarios only.
- Exclude speculative or legally implausible paths.
- Keep each field concise and useful for UI cards.
- Do not include markdown.
```

User prompt template:

```text
Address: <listingAddress>

Listing context JSON:
<stringified listing>

Analyze this property now and return strict JSON only.
```

Extra OpenAI settings:

- `reasoning: { effort: "low" }`
- `max_output_tokens: 3200`
- `text.verbosity: "low"`
- strict JSON schema

Structured output:

```ts
type ExploreOptionsAnalysis = {
  propertySnapshot: string;
  finalVerdict: "Strong candidate" | "Worth exploring" | "Only works with subsidy or basis reset" | "Pass";
  developerSummary: string;
  redFlags: string[];
  scenarios: ExploreOptionsScenario[];
};

type ExploreOptionsScenario = {
  id: string;
  name: string;
  whyItFits: string;
  whatMustBeTrue: string[];
  scopeLevel: "Light reposition" | "Heavy rehab" | "Gut renovation" | "Partial demo" | "Teardown";
  entitlementDifficulty: "Low" | "Medium" | "High";
  operatorSkillRequired: string;
  exitFlipability: string;
  timeline: string;
  financeability: "Low" | "Medium" | "High";
  hardCostPerSfUsd: string;
  softCostPct: string;
  contingencyPct: string;
  totalProjectCostLowUsd: string;
  totalProjectCostHighUsd: string;
  targetTenantOrBuyer: string;
  revenueModel: string;
  exitStrategy: string;
  marginView: "Strong" | "Thin" | "Negative/speculative";
  buildOutScope: string[];
  incentives: string[];
  killPoints: string[];
};
```

### 6.4 Workbook Generation

Route:

- `POST /api/workbooks/from-listing`

Models:

- primary: `AI_WORKBOOK_MODEL`, default `gpt-5.4`
- fallback: `AI_ANALYSIS_MODEL`, default `gpt-4.1-mini`

Prompt source:

- full system prompt loaded from `workbook-prompt.txt`
- exact prompt is reproduced in Appendix A below

User content attempts:

1. `<listingAddress> + executeSuffix`
2. `Property address: ... + Listing context JSON + executeSuffix`
3. same two attempts again with fallback model

Execute suffix:

```text
ADDRESS IS PROVIDED. Execute now and return ONLY CSV rows with the required header. Do not ask for more input.
```

Repair mode prompt suffix:

```text
You are now in CSV repair mode.
Fix only CSV formatting/schema issues while preserving the original tenant intent.
Return ONLY CSV, with the exact required headers and valid CSV escaping.
Do not add commentary.
```

OpenAI request shape:

```json
{
  "model": "gpt-5.4",
  "input": [
    { "role": "system", "content": "<workbook prompt text>" },
    { "role": "user", "content": "<attempt-specific user content>" }
  ],
  "max_output_tokens": 5000
}
```

Important behavior:

- this is not structured output JSON; it is freeform CSV
- the route tries up to 4 generation attempts
- each bad CSV can trigger a repair attempt
- route requires at least 20 rows

Workbook output contract:

```ts
type WorkbookRow = {
  business_name: string;
  category: string;
  city: string;
  state: string;
  distance_miles: number;
  tenant_fit_score_100: number;
  move_probability_1_10: number;
  priority_rank: number;
  fit_summary: string;
  owner_contact_name: string;
};
```

Normalization rules:

- headers must match exactly
- `fit_summary` trimmed to 400 chars
- empty `owner_contact_name` becomes `N/A`
- rows are sorted by deterministic score:

```ts
score = tenant_fit_score_100 * 0.6 + move_probability_1_10 * 4
```

Important nuance:

- backend sorts by recomputed score
- backend does not overwrite `priority_rank`
- if the model's `priority_rank` differs from the formula, displayed rank and row order can drift

### 6.5 Outreach Email Generation

Route:

- `POST /api/outreach/generate-email`

Model:

- `AI_OUTREACH_EMAIL_MODEL`, default `gpt-4o`

System prompt:

```text
You are an outreach email agent for commercial real estate leasing. Generate a concise, professional outbound email tailored to one target business. Return STRICT JSON only with keys: subject (string), body (string). Body must be plain text, no markdown. Keep under 300 words.
```

User payload content:

The route stringifies this JSON and sends it as the user prompt:

```json
{
  "request": "Generate a first-touch leasing outreach email",
  "listing": {
    "title": "...",
    "address": "...",
    "propertyClass": "...",
    "listingSummary": "...",
    "ownerProvisions": "...",
    "leaseTermYears": 10
  },
  "targetBusiness": {
    "business_name": "...",
    "category": "...",
    "city": "...",
    "state": "...",
    "distance_miles": 4.8,
    "tenant_fit_score_100": 88,
    "move_probability_1_10": 6,
    "priority_rank": 76.8,
    "fit_summary": "...",
    "owner_contact_name": "N/A"
  },
  "selectedContact": {
    "name": "...",
    "title": "...",
    "email": "..."
  },
  "styleReference": "Start with location + opportunity, mention fit based on operational context, mention owner flexibility/provisions when available, and close with a specific CTA for a quick call this week."
}
```

OpenAI settings:

- strict JSON schema
- `max_output_tokens: 1200`
- up to 2 retries if payload is invalid

Output contract:

```ts
type OutreachEmail = {
  subject: string;
  body: string;
};
```

### 6.6 Legacy Thread / Chat Flow

Routes:

- `POST /api/run`
- `POST /api/chat`

These are older than the current listing journey.

They use:

- `src/lib/ai/runBasePrompt.ts`
- `src/lib/ai/prompt.ts`

Legacy prompt base:

```text
You are a commercial real estate tenant matchmaker.

Return ONLY CSV with this exact header order:
business_name,category,tenant_fit_score_100,move_probability_1_10,priority_rank,fit_summary,owner_contact_name

Rules:
- Return 20-30 rows.
- Realistic business names only (no placeholders like "ABC Co").
- tenant_fit_score_100 must be integer 0-100.
- move_probability_1_10 must be integer 1-10.
- fit_summary max 400 chars.
- owner_contact_name should be N/A when unknown.
- No markdown, no prose before or after CSV.
```

This legacy flow is useful context, but it is not the main listing-detail product path.

## 7. Output Structures By Agentic Action

### 7.1 ListingRecord

Canonical app object:

```ts
type ListingRecord = {
  id: string;
  title: string;
  customTitle?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  squareFootage?: number;
  noi?: number;
  capRate?: number;
  pricePerSquareFoot?: number;
  daysOnMarket?: number;
  attomId?: string;
  sourceListingId?: string;
  source?: string;
  propertyClass?: string;
  lotSizeAcres?: number;
  heroImageUrl?: string;
  locationDescription?: string;
  listingSummary?: string;
  ownerProvisions?: string;
  leaseTermYears?: number;
  rawDetails?: string;
  rentalRatePerSfYr?: number;
  listingType?: "FOR_LEASE" | "FOR_SALE" | "BOTH";
  lifecycleStatus?: "ACTIVE" | "OFF_MARKET";
  dateOnMarket?: string;
  lastUpdatedAtSource?: string;
  spaces: ListingSpaceRecord[];
  disclosures: ListingDisclosureRecord[];
  features: ListingFeatureRecord[];
  constraints: string[];
  contacts: ListingContactRecord[];
  tenants: ListingTenantRecord[];
};
```

### 7.2 ListingResearchResult

```ts
type ListingResearchResult = {
  listingId: string;
  createdAt: string;
  analysis: ListingResearchAnalysis;
};
```

### 7.3 ExploreOptionsResult

```ts
type ExploreOptionsResult = {
  listingId: string;
  createdAt: string;
  analysis: ExploreOptionsAnalysis;
};
```

### 7.4 WorkbookResult

```ts
type WorkbookResult = {
  id: string;
  listingId: string;
  listingTitle: string;
  createdAt: string;
  csv: string;
  rows: WorkbookRow[];
};
```

### 7.5 OutreachContact

```ts
type OutreachContact = {
  id: string;
  name: string;
  title: string;
  email?: string;
  confidence: "high" | "medium" | "low";
};
```

### 7.6 OutreachTarget

```ts
type OutreachTarget = {
  id: string;
  listingId: string;
  workbookId: string;
  workbookRow: WorkbookRow;
  businessAgeYears?: number;
  industry?: string;
  parentCompany?: string;
  estimatedRevenue?: string;
  hqAddress?: string;
  contacts: OutreachContact[];
  selectedContactId?: string;
  emailSubject: string;
  emailBody: string;
  generatingEmail?: boolean;
  sendingEmail?: boolean;
  contactsLoading?: boolean;
  contactsHasMore?: boolean;
  contactsCursor?: string | null;
  lastSendStatus?: "idle" | "sent" | "failed";
  lastSendMessage?: string;
};
```

### 7.7 Contact Search Output

Provider-backed route response:

```ts
type ContactSearchResponse = {
  contacts: OutreachContact[];
  hasMore: boolean;
  nextCursor: string | null;
};
```

Degraded fallback response if Apollo access is blocked:

```ts
type ProviderUnavailableContactResponse = {
  contacts: [];
  hasMore: false;
  nextCursor: null;
  providerStatus: "unavailable";
  providerMessage: string;
};
```

### 7.8 Proposal Output

Current state:

- not implemented

Recommended future contract:

```ts
type ProposalDraft = {
  listingId: string;
  scenarioId: string;
  proposalTitle: string;
  executiveSummary: string;
  recommendedPlay: string;
  whyThisWorks: string;
  capexLowUsd: string;
  capexHighUsd: string;
  targetTenantOrBuyer: string;
  timeline: string;
  financingView: string;
  keyRisks: string[];
  killPoints: string[];
  nextActions: string[];
};
```

Recommended proposal input:

- `ListingRecord`
- `ListingResearchResult`
- selected `ExploreOptionsScenario`

Recommended place in flow:

- after Explore Options
- before Outreach

## 8. Pricing And Entitlement Logic

### 8.1 Plan Catalog

Defined in `src/lib/billing/plans.ts`.

| Plan | Price | Listings | Contacts | Workbooks | Workbook Rows / Month |
| --- | --- | --- | --- | --- | --- |
| Free | $0 | 3 | 25 | 1 | 100 |
| Plus | $99 | 25 | 500 | 20 | 5000 |
| Pro | $299 | 200 | 5000 | 200 | 50000 |

### 8.2 Default Provisioning

On first tenant provisioning:

- plan catalog is seeded
- tenant is created
- owner membership is created
- primary project is created
- active Free subscription is created

### 8.3 Where Usage Is Actually Consumed

Current usage consumption points:

- `WORKBOOKS`
  - consumed in `POST /api/workbooks/from-listing`
- `WORKBOOK_ROWS`
  - consumed in `POST /api/workbooks/from-listing`
  - also consumed in legacy `POST /api/chat`
- `CONTACTS`
  - consumed in `POST /api/outreach/contacts/search`
- `LISTINGS`
  - consumed in legacy `POST /api/run`

### 8.4 Important Pricing Gaps

Gap 1:

- the active new listing flow in `useWorkspaceData.addListings()` does not consume `LISTINGS`
- result: plan limits for listings are not enforced on the main workspace listing flow

Gap 2:

- proposal stage does not exist, so it has no cost or quota model

Gap 3:

- if the app is being used without Supabase tenant context, workbook entitlement checks are skipped because the route only consumes quotas when tenant context exists

Gap 4:

- seeded fallback contacts do not consume `CONTACTS`; only provider-returned contacts do

## 9. Important Nuances And Risks

1. Proposal copy exists in the landing page and listing tabs, but proposal generation is not implemented.

2. The workbook target count is conceptually 25-ish, but the hard route minimum is 20.

3. `priority_rank` is model-supplied, but row ordering is recomputed locally from fit and move probability.

4. Listing research automatically overwrites `listingSummary`.

5. Contact recommendation is conceptually "one selected contact", but the UI still presents a small stack of choices.

6. The active listing workflow persists in a tenant-scoped `workspaceState.stateJson` blob plus localStorage; it is not yet normalized into first-class listing/workbook/outreach tables.

7. Apollo search is defensive and tries multiple endpoints and auth header/body permutations because provider behavior may vary.

8. The landing page promise "From listing upload to proposals and outbound emails" is aspirational for proposals, but real for outbound emails.

9. The older `run/chat/thread` prototype still exists and can confuse a new agent if not explicitly treated as legacy.

## 10. Recommended Canonical Contract For The Next Codex Agent

If you are the next agent extending TenantMatch, use these rules:

1. Treat the listing-detail flow as the primary product path:
   - intake
   - auto research
   - options
   - workbook
   - proposal
   - outreach

2. Treat `Proposals` as the next missing feature to build, not as already implemented.

3. If product wants "25 rows", make that canonical everywhere:
   - workbook prompt minimum/target
   - route validation
   - UI expectations

4. Treat `selectedContactId` as the single recommended contact for generation and sending.

5. If enforcing plan limits is important, add `LISTINGS` consumption to the active listing-add flow.

6. Preserve OpenAI structured output for:
   - listing parser
   - listing research
   - explore options
   - outreach email

7. Keep workbook generation repairable:
   - freeform CSV generation
   - deterministic parse
   - repair pass on malformed CSV

8. Keep source-of-truth priority:
   - code behavior
   - then this context doc
   - then older foundation docs
   - then UI marketing copy

## Appendix A: Exact Workbook Prompt

This is the exact prompt loaded from `workbook-prompt.txt` today.

```text
You are a commercial real estate tenant matchmaker.

Your job is to take a property address, determine its type, and return a ranked list of real businesses that are strong leasing candidates.

---

INPUT
- A single property address

---

NO ADDRESS HANDLING
If no address is provided, respond:
"Please provide the property address you'd like analyzed."
Do not proceed.

---

STEP 1: DETERMINE PROPERTY TYPE (CRITICAL)

Infer from:
- Location + trade area
- Road type / visibility
- Nearby tenants
- Site characteristics

Classify into ONE:
- Industrial
- Retail
- Office
- Restaurant / Hospitality
- Mixed-use

If uncertain:
- choose best-fit + optional secondary

---

STEP 2: PROPERTY + ECONOMIC MODEL (BY TYPE)

You must evaluate how tenants make money, what blocks them, and what unlocks a deal.

INDUSTRIAL
- Econ: throughput - (rent + logistics + labor)
- Requires: clear height, loading, power, yard, zoning
- Core driver: operations must work
- Incentive leverage:
  - Corp -> expansion rights, power upgrades, BTS, term certainty
  - Local -> phased occupancy, step-ups, shared yard
- Rule: if ops fail -> no deal (incentives secondary)

RETAIL
- Econ: traffic x conversion x ticket
- Requires: frontage, visibility, parking, co-tenancy
- Core driver: revenue upside from location
- Incentive leverage:
  - Corp -> % rent, co-tenancy guarantees, signage, exclusivity
  - Local -> free rent (3-9 mo), low deposit, LL buildout, flexible term
- Rule: if visibility/traffic fail -> no deal

OFFICE
- Econ: flexibility + cost predictability (post-COVID)
- Requires: layout, parking, accessibility
- Core driver: risk reduction
- Incentive leverage:
  - Corp -> contraction/expansion options, termination rights, high TI, plug-and-play
  - SMB -> gross leases, turnkey space, free rent
- Rule: flexibility > rent

MEDICAL (subtype of office if applicable)
- Econ: patient flow + payer mix - buildout cost
- Requires: plumbing, electrical, compliance, layout
- Core driver: CAPEX + infrastructure
- Incentive leverage:
  - Corp -> BTS, long-term stability, infrastructure investment
  - Independent -> high TI, LL buildout, delayed rent start, long abatement
- Rule: no TI -> no deal

RESTAURANT
- Econ: turnover x seats x location - (buildout + labor + rent)
- Requires: venting, grease trap, utilities, zoning
- Core driver: high failure risk + capital intensity
- Incentive leverage:
  - Corp -> high TI, % rent, exclusivity, infrastructure
  - Independent -> 6-12 mo free rent, rent ramp, LL kitchen buildout, key money
- Rule: highest concessions required

---

STEP 3: BUILD TENANT UNIVERSE

- ONLY real businesses within 30 miles
- Minimum 20, target 25-40
- No placeholders

Tenant types by category:
- Industrial -> manufacturing, logistics, food production
- Retail -> boutiques, services, regional chains
- Office -> legal, finance, insurance, medical
- Restaurant -> local operators, franchisees

---

STEP 4: TENANT EVALUATION MODEL

For each tenant, evaluate in this order:

1. Operational Fit
   - Can the business physically operate here?

2. Revenue Fit
   - Does this location improve their revenue?

3. Friction
   - Buildout cost, time, relocation risk

4. Incentive Sensitivity
   - What concessions are required to unlock the deal:
     - Free rent
     - TI (tenant improvement allowance)
     - Flexible terms
     - LL buildout / infrastructure
     - % rent / step-ups
   - If listing context includes ownerProvisions and/or leaseTermYears, explicitly use them in incentive feasibility and fit ranking.

5. Move Drivers
   - Expansion
   - Lease rollover
   - Constraints in current space

6. Failure Constraints
   - Explicit reasons deal fails

---

STEP 5: SCORING

tenant_fit_score_100
- Blend of ops fit, revenue upside, constraint compatibility, incentive feasibility

move_probability_1_10
- Driven by growth, friction, expansion patterns, category churn

---

STEP 6: RANKING

priority_rank =
tenant_fit_score x 0.6 + move_probability x 4

Sort descending.

---

STEP 7: OUTPUT FORMAT (STRICT)

Output ONLY CSV.

Fields (in exact order):

business_name
category
city
state
distance_miles
tenant_fit_score_100
move_probability_1_10
priority_rank
fit_summary (<=400 chars)
owner_contact_name (or N/A)

---

FIT SUMMARY REQUIREMENTS

Each summary must include:
- Why this tenant fits
- What constraint they have
- What incentive unlocks the deal
- Positioning angle

---

GLOBAL LOGIC

You are NOT matching space.

You are identifying:
Which businesses have constraints this property can solve - and what it takes to get them to say yes.

All outputs must reflect:
FIT x MOTIVATION x INCENTIVES

---

CROSS-VARIABLE INTELLIGENCE

- Tenant type:
  - Corp -> lower risk, less flexible
  - Local -> cash constrained, incentive-sensitive

- Rigidity:
  - High (medical, restaurant) -> high TI required
  - Low (office, some retail) -> flexibility matters more

- TAM sensitivity:
  - High (retail, restaurant) -> location > rent
  - Low (industrial, office) -> cost/ops > location
```
