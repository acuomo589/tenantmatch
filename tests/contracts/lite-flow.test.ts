import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import Stripe from "stripe";
import { getLiteLinkWithWorkbookByToken, listLiteLinkItems } from "../../src/lib/lite/service";
import { getMockLiteSheetSnapshot, resetMockLiteSheetValues } from "../../src/lib/lite/sheets";
import { generateLiteWorkbookFromAddress } from "../../src/lib/lite/workbooks";

process.env.TIMPANI_MOCK_AGENTIC_FLOW = "1";
process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
process.env.STRIPE_SECRET_KEY = "sk_test_mock";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";

beforeEach(() => {
  resetMockLiteSheetValues();
});

test("lite workbook generation returns exactly 25 rows in mock mode", async () => {
  const workbook = await generateLiteWorkbookFromAddress("875 Taylor Station Rd, Gahanna, OH 43230");

  assert.equal(workbook.rows.length, 25);
  assert.equal(workbook.rows[0]?.priority_rank, 1);
  assert.equal(workbook.rows[24]?.priority_rank, 25);
  assert.match(workbook.csv, /^business_name,category,city,state,/);
});

test("sheet processing creates one workbook, reuses duplicate buyer rows, and is idempotent", async () => {
  resetMockLiteSheetValues([
    ["broker_name", "email", "listing_address", "link"],
    ["Taylor Buyer", "buyer@example.com", "875 Taylor Station Rd, Gahanna, OH 43230", ""],
    ["", "buyer@example.com", "875 Taylor Station Rd, Gahanna, OH 43230", ""],
    ["Missing Email", "", "875 Taylor Station Rd, Gahanna, OH 43230", ""],
    ["Existing Buyer", "existing@example.com", "999 Existing Way, Columbus, OH 43004", "https://existing.example/link"],
  ]);

  const { POST } = await import("../../src/app/api/lite/sheets/process/route");
  const firstResponse = await POST(new Request("http://localhost/api/lite/sheets/process", { method: "POST" }));
  assert.equal(firstResponse.status, 200);
  const firstPayload = (await firstResponse.json()) as {
    summary?: {
      createdWorkbooks: number;
      createdLinks: number;
      reusedLinks: number;
      invalidRows: number;
      updatedRows: number;
      errors?: Array<{ rowNumber: number; message: string }>;
    };
  };
  assert.equal(firstPayload.summary?.createdWorkbooks, 1);
  assert.equal(firstPayload.summary?.createdLinks, 1);
  assert.equal(firstPayload.summary?.reusedLinks, 1);
  assert.equal(firstPayload.summary?.invalidRows, 1);
  assert.equal(firstPayload.summary?.updatedRows, 2);
  assert.equal(firstPayload.summary?.errors?.length, 1);

  const links = await listLiteLinkItems("00000000-0000-0000-0000-000000000001");
  assert.equal(links.length, 1);
  assert.match(links[0]?.paywallUrl ?? "", /\/r\//);

  const snapshot = getMockLiteSheetSnapshot();
  assert.equal(snapshot["TenantMatch Links"]?.length, 2);
  assert.equal(snapshot["TenantMatch Links"]?.[0]?.[0], "tenant_id");

  const secondResponse = await POST(new Request("http://localhost/api/lite/sheets/process", { method: "POST" }));
  assert.equal(secondResponse.status, 200);
  const secondPayload = (await secondResponse.json()) as { summary?: { processedRows: number; updatedRows: number; invalidRows: number; skippedRows: number } };
  assert.equal(secondPayload.summary?.processedRows, 2);
  assert.equal(secondPayload.summary?.updatedRows, 0);
  assert.equal(secondPayload.summary?.invalidRows, 1);
  assert.equal(secondPayload.summary?.skippedRows, 0);
});

test("sheet processing creates link column when the configured sheet only has broker, email, and listing address", async () => {
  resetMockLiteSheetValues([
    ["broker_name", "email", "listing_address"],
    ["Taylor Buyer", "buyer@example.com", "875 Taylor Station Rd, Gahanna, OH 43230"],
  ]);

  const { POST } = await import("../../src/app/api/lite/sheets/process/route");
  const response = await POST(new Request("http://localhost/api/lite/sheets/process", { method: "POST" }));

  assert.equal(response.status, 200);
  const payload = (await response.json()) as { summary?: { processedRows: number; updatedRows: number; createdLinks: number } };
  assert.equal(payload.summary?.processedRows, 1);
  assert.equal(payload.summary?.updatedRows, 1);
  assert.equal(payload.summary?.createdLinks, 1);

  const snapshot = getMockLiteSheetSnapshot();
  assert.equal(snapshot.Sheet1?.[0]?.[3], "link");
  assert.equal(snapshot.Sheet1?.[0]?.[4], "error");
  assert.equal(snapshot["TenantMatch Links"]?.[0]?.[1], "token");
});

test("sheet processing can be limited to the first blank-link row", async () => {
  resetMockLiteSheetValues([
    ["broker_name", "email", "listing_address", "link"],
    ["Taylor Buyer", "buyer@example.com", "875 Taylor Station Rd, Gahanna, OH 43230", ""],
    ["Second Buyer", "second@example.com", "1100 Main St, Columbus, OH 43215", ""],
  ]);

  const { POST } = await import("../../src/app/api/lite/sheets/process/route");
  const firstResponse = await POST(new Request("http://localhost/api/lite/sheets/process?limit=1", { method: "POST" }));

  assert.equal(firstResponse.status, 200);
  const firstPayload = (await firstResponse.json()) as { summary?: { processedRows: number; updatedRows: number; createdLinks: number } };
  assert.equal(firstPayload.summary?.processedRows, 1);
  assert.equal(firstPayload.summary?.updatedRows, 1);
  assert.equal(firstPayload.summary?.createdLinks, 1);

  const secondResponse = await POST(new Request("http://localhost/api/lite/sheets/process", { method: "POST" }));
  const secondPayload = (await secondResponse.json()) as { summary?: { processedRows: number; updatedRows: number; createdLinks: number } };
  assert.equal(secondPayload.summary?.processedRows, 2);
  assert.equal(secondPayload.summary?.updatedRows, 1);
  assert.equal(secondPayload.summary?.createdLinks, 1);
});

test("sheet processing backfills the archive tab for an existing preview link", async () => {
  resetMockLiteSheetValues([
    ["broker_name", "email", "listing_address", "link"],
    ["Taylor Buyer", "buyer@example.com", "875 Taylor Station Rd, Gahanna, OH 43230", "http://localhost:3000/r/existingToken123"],
  ]);

  const { POST } = await import("../../src/app/api/lite/sheets/process/route");
  const response = await POST(new Request("http://localhost/api/lite/sheets/process", { method: "POST" }));
  assert.equal(response.status, 200);

  const payload = (await response.json()) as { summary?: { processedRows: number; createdLinks: number; reusedLinks: number; updatedRows: number } };
  assert.equal(payload.summary?.processedRows, 1);
  assert.equal(payload.summary?.createdLinks, 0);
  assert.equal(payload.summary?.reusedLinks, 1);
  assert.equal(payload.summary?.updatedRows, 0);

  const stored = await getLiteLinkWithWorkbookByToken("existingToken123");
  assert.equal(stored?.buyerEmail, "buyer@example.com");

  const snapshot = getMockLiteSheetSnapshot();
  assert.equal(snapshot["TenantMatch Links"]?.[1]?.[1], "existingToken123");
  assert.equal(snapshot.Sheet1?.[1]?.[3], "http://localhost:3000/r/existingToken123");
});

test("sheet processing rewrites existing links to the configured canonical domain", async () => {
  const originalAppUrl = process.env.APP_URL;
  const originalPublicAppUrl = process.env.NEXT_PUBLIC_APP_URL;

  process.env.APP_URL = "https://tenantmatch.app";
  process.env.NEXT_PUBLIC_APP_URL = "https://tenantmatch.app";

  try {
    resetMockLiteSheetValues([
      ["broker_name", "email", "listing_address", "link"],
      ["Taylor Buyer", "buyer@example.com", "875 Taylor Station Rd, Gahanna, OH 43230", ""],
    ]);

    const { POST } = await import("../../src/app/api/lite/sheets/process/route");
    await POST(new Request("http://localhost/api/lite/sheets/process", { method: "POST" }));

    const firstSnapshot = getMockLiteSheetSnapshot();
    const localhostLink = firstSnapshot.Sheet1?.[1]?.[3] ?? "";
    assert.match(localhostLink, /^https:\/\/tenantmatch\.app\/r\//);

    resetMockLiteSheetValues([
      ["broker_name", "email", "listing_address", "link"],
      ["Taylor Buyer", "buyer@example.com", "875 Taylor Station Rd, Gahanna, OH 43230", "http://localhost:3000/r/rewriteToken123"],
    ]);

    await POST(new Request("http://localhost/api/lite/sheets/process", { method: "POST" }));
    const secondSnapshot = getMockLiteSheetSnapshot();
    assert.equal(secondSnapshot.Sheet1?.[1]?.[3], "https://tenantmatch.app/r/rewriteToken123");
    assert.equal(secondSnapshot["TenantMatch Links"]?.[1]?.[2], "https://tenantmatch.app/r/rewriteToken123");
  } finally {
    if (typeof originalAppUrl === "undefined") {
      delete process.env.APP_URL;
    } else {
      process.env.APP_URL = originalAppUrl;
    }

    if (typeof originalPublicAppUrl === "undefined") {
      delete process.env.NEXT_PUBLIC_APP_URL;
    } else {
      process.env.NEXT_PUBLIC_APP_URL = originalPublicAppUrl;
    }
  }
});

test("matching webhook payment unlocks csv and pdf downloads", async () => {
  const { POST: processPOST } = await import("../../src/app/api/lite/sheets/process/route");
  await processPOST(new Request("http://localhost/api/lite/sheets/process", { method: "POST" }));

  const [link] = await listLiteLinkItems("00000000-0000-0000-0000-000000000001");
  const token = new URL(link.paywallUrl).pathname.split("/").pop() ?? "";

  const eventPayload = JSON.stringify({
    id: "evt_test_paid",
    object: "event",
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_test_paid",
        object: "checkout.session",
        metadata: {
          kind: "lite_link",
          liteLinkToken: token,
          buyerEmail: "buyer@example.com",
        },
        customer_details: {
          email: "buyer@example.com",
          name: "Taylor Buyer",
        },
        amount_total: 4900,
        payment_intent: "pi_test_paid",
      },
    },
  });

  const signature = Stripe.webhooks.generateTestHeaderString({
    payload: eventPayload,
    secret: process.env.STRIPE_WEBHOOK_SECRET!,
  });

  const { POST: webhookPOST } = await import("../../src/app/api/webhooks/stripe/route");
  const webhookResponse = await webhookPOST(
    new Request("http://localhost/api/webhooks/stripe", {
      method: "POST",
      body: eventPayload,
      headers: {
        "stripe-signature": signature,
      },
    }),
  );
  assert.equal(webhookResponse.status, 200);

  const stored = await getLiteLinkWithWorkbookByToken(token);
  assert.equal(stored?.status, "PAID");
  assert.equal(stored?.amountPaidCents, 4900);

  const { GET: csvGET } = await import("../../src/app/r/[token]/download/csv/route");
  const csvResponse = await csvGET(new Request("http://localhost/r/token/download/csv"), {
    params: Promise.resolve({ token }),
  });
  assert.equal(csvResponse.status, 200);
  assert.match(await csvResponse.text(), /^business_name,category,city,state,/);

  const { GET: pdfGET } = await import("../../src/app/r/[token]/download/pdf/route");
  const pdfResponse = await pdfGET(new Request("http://localhost/r/token/download/pdf"), {
    params: Promise.resolve({ token }),
  });
  assert.equal(pdfResponse.status, 200);
  assert.equal(pdfResponse.headers.get("content-type"), "application/pdf");
});

test("mismatched webhook email does not unlock the link", async () => {
  const { POST: processPOST } = await import("../../src/app/api/lite/sheets/process/route");
  await processPOST(new Request("http://localhost/api/lite/sheets/process", { method: "POST" }));

  const [link] = await listLiteLinkItems("00000000-0000-0000-0000-000000000001");
  const token = new URL(link.paywallUrl).pathname.split("/").pop() ?? "";

  const eventPayload = JSON.stringify({
    id: "evt_test_failed",
    object: "event",
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_test_failed",
        object: "checkout.session",
        metadata: {
          kind: "lite_link",
          liteLinkToken: token,
          buyerEmail: "buyer@example.com",
        },
        customer_details: {
          email: "someone-else@example.com",
          name: "Wrong Buyer",
        },
        amount_total: 4900,
        payment_intent: "pi_test_failed",
      },
    },
  });

  const signature = Stripe.webhooks.generateTestHeaderString({
    payload: eventPayload,
    secret: process.env.STRIPE_WEBHOOK_SECRET!,
  });

  const { POST: webhookPOST } = await import("../../src/app/api/webhooks/stripe/route");
  const webhookResponse = await webhookPOST(
    new Request("http://localhost/api/webhooks/stripe", {
      method: "POST",
      body: eventPayload,
      headers: {
        "stripe-signature": signature,
      },
    }),
  );
  assert.equal(webhookResponse.status, 200);

  const stored = await getLiteLinkWithWorkbookByToken(token);
  assert.equal(stored?.status, "FAILED");

  const { GET: csvGET } = await import("../../src/app/r/[token]/download/csv/route");
  const csvResponse = await csvGET(new Request("http://localhost/r/token/download/csv"), {
    params: Promise.resolve({ token }),
  });
  assert.equal(csvResponse.status, 403);
});

test("opened endpoint marks the lite link as opened", async () => {
  const { POST: processPOST } = await import("../../src/app/api/lite/sheets/process/route");
  await processPOST(new Request("http://localhost/api/lite/sheets/process", { method: "POST" }));

  const [link] = await listLiteLinkItems("00000000-0000-0000-0000-000000000001");
  const token = new URL(link.paywallUrl).pathname.split("/").pop() ?? "";

  const { POST: openedPOST } = await import("../../src/app/api/lite/links/[token]/opened/route");
  const openedResponse = await openedPOST(new Request("http://localhost/api/lite/links/token/opened", { method: "POST" }), {
    params: Promise.resolve({ token }),
  });
  assert.equal(openedResponse.status, 200);

  const stored = await getLiteLinkWithWorkbookByToken(token);
  assert.equal(stored?.status, "OPENED");
  assert.ok(stored?.openedAt);
});
