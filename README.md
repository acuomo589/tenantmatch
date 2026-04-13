# Timpani Lean Machine Prototype

Ultra-lean Next.js prototype focused on experience first:

- Empty state with centered **Add Listing** CTA
- Stepper intake modal:
  1. Address + radius + property type
  2. Tenant type filters
  3. Tenant specs / constraints
  4. Owner incentives
- Run base prompt -> CSV -> deterministic normalize/rerank -> grid
- Side-pane chat refinement that mutates prompt and re-runs
- Thread clone support
- Provider config with mock mode fallback

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

- `AI_USE_MOCK=1` uses deterministic mock CSV output (default in example).
- Set `AI_USE_MOCK=0` + `OPENAI_API_KEY` (or legacy `OPEN_API_KEY`) to call OpenAI.
- `AI_LISTING_PARSER_MODEL` controls structured listing parse model (default `o3-mini`).
- `AI_WORKBOOK_MODEL` controls workbook generation model (default `gpt-5.4`).
- Set `LANGSMITH_TRACING=true` + `LANGSMITH_API_KEY` to capture agent/LLM traces in LangSmith.
- Optional `LANGSMITH_PROJECT` controls project name in LangSmith (defaults to `timpani-proto`).
- `AI_PROVIDER=vertex` is scaffolded but intentionally not wired in this proto.
- `ATTOM_API_KEY` enables ATTOM Property API proxy routes.
- Optional `ATTOM_BASE_URL` defaults to `https://api.gateway.attomdata.com`.

## API routes

- `POST /api/run` → create/update thread run
- `POST /api/chat` → append user message, mutate prompt, rerun
- `GET /api/threads` → list threads
- `GET /api/threads/:threadId` → fetch thread
- `POST /api/threads/:threadId/clone` → clone thread
- `GET /api/attom/property-v1/:operation` → proxy ATTOM Property V1 operations (`address`, `detail`, `basicprofile`, etc.)
- `POST /api/listings/parse` → parse listing detail text into structured listing JSON (AI-first with fallback in UI)
- `POST /api/workbooks/from-listing` → run `workbook-prompt.txt` against listing context and return workbook CSV + parsed rows

## Schema

`schema.prisma` has been simplified to a lean model (`Project`, `Thread`, `Run`, `Message`) aligned to this prototype direction.
