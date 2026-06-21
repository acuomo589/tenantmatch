import assert from "node:assert/strict";
import test from "node:test";
import {
  MOCK_LISTING_ADDRESS,
  MOCK_LISTING_DETAILS_INPUT,
  MOCK_WORKBOOK_ROWS,
} from "../../src/lib/testing/mock-agentic-flow";
import { parseWorkbookCsv } from "../../src/lib/workbookCsv";

process.env.TIMPANI_MOCK_AGENTIC_FLOW = "1";

test("parser route returns a usable listing record in mock mode", async () => {
  const { POST } = await import("../../src/app/api/listings/parse/route");
  const response = await POST(
    new Request("http://localhost/api/listings/parse", {
      method: "POST",
      body: JSON.stringify({
        rawText: MOCK_LISTING_DETAILS_INPUT,
        address: MOCK_LISTING_ADDRESS,
      }),
    }),
  );

  assert.equal(response.status, 200);
  const payload = (await response.json()) as { listing?: { addressLine1?: string; city?: string; spaces?: unknown[] } };
  assert.equal(payload.listing?.addressLine1, MOCK_LISTING_ADDRESS);
  assert.ok(payload.listing?.city);
  assert.ok(Array.isArray(payload.listing?.spaces));
});

test("listing research route returns a complete analysis payload in mock mode", async () => {
  const { POST: parsePOST } = await import("../../src/app/api/listings/parse/route");
  const parseResponse = await parsePOST(
    new Request("http://localhost/api/listings/parse", {
      method: "POST",
      body: JSON.stringify({ rawText: MOCK_LISTING_DETAILS_INPUT, address: MOCK_LISTING_ADDRESS }),
    }),
  );
  const parsed = (await parseResponse.json()) as { listing: unknown };

  const { POST } = await import("../../src/app/api/listings/research/route");
  const response = await POST(
    new Request("http://localhost/api/listings/research", {
      method: "POST",
      body: JSON.stringify({ listing: parsed.listing }),
    }),
  );

  assert.equal(response.status, 200);
  const payload = (await response.json()) as { analysis?: { marketScore?: number; listingScore?: number; demandSignals?: string[] } };
  assert.equal(typeof payload.analysis?.marketScore, "number");
  assert.equal(typeof payload.analysis?.listingScore, "number");
  assert.ok(Array.isArray(payload.analysis?.demandSignals));
  assert.ok((payload.analysis?.demandSignals?.length ?? 0) >= 2);
});

test("explore options route returns scenarios in mock mode", async () => {
  const { POST: parsePOST } = await import("../../src/app/api/listings/parse/route");
  const parseResponse = await parsePOST(
    new Request("http://localhost/api/listings/parse", {
      method: "POST",
      body: JSON.stringify({ rawText: MOCK_LISTING_DETAILS_INPUT, address: MOCK_LISTING_ADDRESS }),
    }),
  );
  const parsed = (await parseResponse.json()) as { listing: unknown };

  const { POST } = await import("../../src/app/api/listings/explore-options/route");
  const response = await POST(
    new Request("http://localhost/api/listings/explore-options", {
      method: "POST",
      body: JSON.stringify({ listing: parsed.listing }),
    }),
  );

  assert.equal(response.status, 200);
  const payload = (await response.json()) as { analysis?: { scenarios?: unknown[]; finalVerdict?: string } };
  assert.ok(Array.isArray(payload.analysis?.scenarios));
  assert.ok((payload.analysis?.scenarios?.length ?? 0) >= 2);
  assert.ok(payload.analysis?.finalVerdict);
});

test("workbook route returns parseable CSV and non-empty rows in mock mode", async () => {
  const { POST: parsePOST } = await import("../../src/app/api/listings/parse/route");
  const parseResponse = await parsePOST(
    new Request("http://localhost/api/listings/parse", {
      method: "POST",
      body: JSON.stringify({ rawText: MOCK_LISTING_DETAILS_INPUT, address: MOCK_LISTING_ADDRESS }),
    }),
  );
  const parsed = (await parseResponse.json()) as { listing: unknown };

  const { POST } = await import("../../src/app/api/workbooks/from-listing/route");
  const response = await POST(
    new Request("http://localhost/api/workbooks/from-listing", {
      method: "POST",
      body: JSON.stringify({ listing: parsed.listing }),
    }),
  );

  assert.equal(response.status, 200);
  const payload = (await response.json()) as { csv?: string; rows?: typeof MOCK_WORKBOOK_ROWS };
  assert.ok(payload.csv);
  assert.ok(Array.isArray(payload.rows));
  assert.ok((payload.rows?.length ?? 0) >= 20);
  const reparsed = parseWorkbookCsv(payload.csv ?? "");
  assert.equal(reparsed.length, payload.rows?.length);
  assert.equal(reparsed[0]?.business_name, payload.rows?.[0]?.business_name);
});
