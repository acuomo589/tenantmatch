import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import Stripe from "stripe";
import { getLiteLinkWithWorkbookByToken, listLiteLinkItems } from "../../src/lib/lite/service";
import { getMockLiteSheetSnapshot, resetMockLiteSheetValues } from "../../src/lib/lite/sheets";
import { createLiteAdminLinkSignature } from "../../src/lib/lite/url";
import { generateLiteWorkbookFromAddress } from "../../src/lib/lite/workbooks";

process.env.TENANTMATCH_MOCK_AGENTIC_FLOW = "1";
process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
process.env.STRIPE_SECRET_KEY = "sk_test_mock";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
process.env.GMAIL_FROM_EMAIL = "mike@tenantmatch.app";
process.env.GMAIL_SENDER_NAME = "Mike at TenantMatch";

beforeEach(() => {
  resetMockLiteSheetValues();
});

test("lite workbook generation returns exactly 25 rows in mock mode", async () => {
  const workbook = await generateLiteWorkbookFromAddress("875 Taylor Station Rd, Gahanna, OH 43230");

  assert.equal(workbook.rows.length, 25);
  assert.equal(workbook.rows[0]?.priority_rank, 1);
  assert.equal(workbook.rows[24]?.priority_rank, 25);
  assert.equal(
    workbook.csv.split(/\r?\n/, 1)[0],
    "business_name,category,property_type,city,state,distance_miles,tenant_fit_score_100,move_probability_1_10,priority_rank,fit_summary,rationale,owner_contact_name",
  );
  for (const row of workbook.rows) {
    assert.ok(row.property_type.length > 0);
    assert.ok(row.rationale.length > 0);
    assert.ok(row.rationale.length <= 300);
  }
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
  const archiveHeaders = snapshot["TenantMatch Links"]?.[0] ?? [];
  const workbookCsvIndex = archiveHeaders.indexOf("workbook_csv");
  const workbookCsvDataIndex = archiveHeaders.indexOf("workbook_csv_data");
  assert.ok(workbookCsvIndex >= 0);
  assert.ok(workbookCsvDataIndex >= 0);
  assert.match(snapshot["TenantMatch Links"]?.[1]?.[workbookCsvIndex] ?? "", /^http:\/\/localhost:3000\/a\/[^?]+\?sig=/);
  assert.match(snapshot["TenantMatch Links"]?.[1]?.[workbookCsvDataIndex] ?? "", /^business_name,category,property_type,city,state,/);

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

test("sheet processing normalizes legacy archive rows so workbook_csv shows the admin link", async () => {
  resetMockLiteSheetValues([
    ["broker_name", "email", "listing_address", "link"],
    ["Taylor Buyer", "buyer@example.com", "875 Taylor Station Rd, Gahanna, OH 43230", ""],
  ]);

  const { POST } = await import("../../src/app/api/lite/sheets/process/route");
  const firstResponse = await POST(new Request("http://localhost/api/lite/sheets/process", { method: "POST" }));
  assert.equal(firstResponse.status, 200);

  const seededSnapshot = getMockLiteSheetSnapshot();
  const archiveHeaders = seededSnapshot["TenantMatch Links"]?.[0] ?? [];
  const workbookCsvIndex = archiveHeaders.indexOf("workbook_csv");
  const workbookCsvDataIndex = archiveHeaders.indexOf("workbook_csv_data");

  assert.ok(workbookCsvIndex >= 0);
  assert.ok(workbookCsvDataIndex >= 0);

  const legacySnapshot = structuredClone(seededSnapshot);
  legacySnapshot["TenantMatch Links"][1][workbookCsvIndex] = legacySnapshot["TenantMatch Links"][1][workbookCsvDataIndex] ?? "";
  legacySnapshot["TenantMatch Links"][1][workbookCsvDataIndex] = "";
  resetMockLiteSheetValues(legacySnapshot);

  const secondResponse = await POST(new Request("http://localhost/api/lite/sheets/process", { method: "POST" }));
  assert.equal(secondResponse.status, 200);

  const normalizedSnapshot = getMockLiteSheetSnapshot();
  assert.match(
    normalizedSnapshot["TenantMatch Links"]?.[1]?.[workbookCsvIndex] ?? "",
    /^http:\/\/localhost:3000\/a\/[^?]+\?sig=/,
  );
  assert.match(
    normalizedSnapshot["TenantMatch Links"]?.[1]?.[workbookCsvDataIndex] ?? "",
    /^business_name,category,property_type,city,state,/,
  );
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
    assert.match(secondSnapshot["TenantMatch Links"]?.[1]?.[12] ?? "", /^https:\/\/tenantmatch\.app\/a\/rewriteToken123\?sig=/);
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
  assert.equal(
    (await csvResponse.text()).split(/\r?\n/, 1)[0],
    "business_name,category,property_type,city,state,distance_miles,tenant_fit_score_100,move_probability_1_10,priority_rank,fit_summary,rationale,owner_contact_name",
  );

  const { GET: pdfGET } = await import("../../src/app/r/[token]/download/pdf/route");
  const pdfResponse = await pdfGET(new Request("http://localhost/r/token/download/pdf"), {
    params: Promise.resolve({ token }),
  });
  assert.equal(pdfResponse.status, 200);
  assert.equal(pdfResponse.headers.get("content-type"), "application/pdf");
});

test("signed admin downloads work before payment and reject bad signatures", async () => {
  const { POST: processPOST } = await import("../../src/app/api/lite/sheets/process/route");
  await processPOST(new Request("http://localhost/api/lite/sheets/process", { method: "POST" }));

  const [link] = await listLiteLinkItems("00000000-0000-0000-0000-000000000001");
  const token = new URL(link.paywallUrl).pathname.split("/").pop() ?? "";
  const signature = createLiteAdminLinkSignature(token);

  const { GET: adminCsvGET } = await import("../../src/app/a/[token]/download/csv/route");
  const csvResponse = await adminCsvGET(new Request(`http://localhost/a/${token}/download/csv?sig=${signature}`), {
    params: Promise.resolve({ token }),
  });
  assert.equal(csvResponse.status, 200);
  assert.equal(
    (await csvResponse.text()).split(/\r?\n/, 1)[0],
    "business_name,category,property_type,city,state,distance_miles,tenant_fit_score_100,move_probability_1_10,priority_rank,fit_summary,rationale,owner_contact_name",
  );

  const badSignatureResponse = await adminCsvGET(new Request(`http://localhost/a/${token}/download/csv?sig=bad`), {
    params: Promise.resolve({ token }),
  });
  assert.equal(badSignatureResponse.status, 404);

  const { GET: adminPdfGET } = await import("../../src/app/a/[token]/download/pdf/route");
  const pdfResponse = await adminPdfGET(new Request(`http://localhost/a/${token}/download/pdf?sig=${signature}`), {
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

test("daily ZIP discovery promotes qualified listings, creates links, and queues broker drafts", async () => {
  resetMockLiteSheetValues({
    Sheet1: [["broker_name", "email", "listing_address", "link"]],
    "ZIP Targets": [
      ["zip", "active", "sequence", "status", "property_types", "daily_limit"],
      ["01749", "true", "1", "PENDING", "Retail, Industrial", "25"],
    ],
  });

  const { POST } = await import("../../src/app/api/lite/discovery/run/route");
  const response = await POST(new Request("http://localhost/api/lite/discovery/run", { method: "POST" }));
  assert.equal(response.status, 200);

  const payload = (await response.json()) as {
    summary?: {
      zip: string;
      candidateCount: number;
      qualifiedCount: number;
      promotedCount: number;
      processedCount: number;
      draftCount: number;
      errorCount: number;
    };
  };
  assert.equal(payload.summary?.zip, "01749");
  assert.equal(payload.summary?.candidateCount, 5);
  assert.equal(payload.summary?.qualifiedCount, 3);
  assert.equal(payload.summary?.promotedCount, 3);
  assert.equal(payload.summary?.processedCount, 3);
  assert.equal(payload.summary?.draftCount, 3);
  assert.equal(payload.summary?.errorCount, 0);

  const snapshot = getMockLiteSheetSnapshot();
  assert.equal(snapshot.Sheet1?.length, 4);
  assert.equal(snapshot["Broker Outreach Queue"]?.length, 4);
  assert.equal(snapshot["Discovered Listings"]?.length, 7);
  assert.equal(snapshot["Qualified Listings"]?.length, 3);

  const discoveredHeaders = snapshot["Discovered Listings"]?.[0] ?? [];
  const discoveryStatusIndex = discoveredHeaders.indexOf("discovery_status");
  const skipReasonIndex = discoveredHeaders.indexOf("skip_reason");
  const emailSourceTypeIndex = discoveredHeaders.indexOf("broker_email_source_type");
  const emailSourceUrlIndex = discoveredHeaders.indexOf("broker_email_source_url");
  const brokerEmailIndex = discoveredHeaders.indexOf("broker_email");
  const sourceUrlIndex = discoveredHeaders.indexOf("source_url");
  const processedRows = snapshot["Discovered Listings"]?.slice(1) ?? [];
  assert.equal(processedRows.filter((row) => row[discoveryStatusIndex] === "PROCESSED").length, 3);
  assert.equal(processedRows.filter((row) => row[discoveryStatusIndex] === "SKIPPED_DUPLICATE").length, 1);
  assert.equal(processedRows.filter((row) => row[discoveryStatusIndex] === "SKIPPED_NO_EMAIL").length, 1);
  assert.equal(processedRows.filter((row) => row[discoveryStatusIndex] === "SKIPPED_STALE").length, 1);
  assert.match(
    processedRows.find((row) => row[discoveryStatusIndex] === "SKIPPED_NO_EMAIL")?.[skipReasonIndex] ?? "",
    /trustworthy public broker email/i,
  );
  assert.equal(processedRows.filter((row) => row[emailSourceTypeIndex] === "broker_profile_page").length, 1);
  assert.equal(processedRows.filter((row) => row[emailSourceTypeIndex] === "brokerage_website_page").length, 1);
  assert.match(
    processedRows.find((row) => row[emailSourceTypeIndex] === "broker_profile_page")?.[emailSourceUrlIndex] ?? "",
    /westadvisors\.example\.com/,
  );
  assert.deepEqual(
    processedRows
      .filter((row) => row[sourceUrlIndex] === "https://crexi.example/hudson-industrial-1")
      .map((row) => row[brokerEmailIndex])
      .sort(),
    ["avery@example.com", "morgan@example.com"],
  );

  const qualifiedHeaders = snapshot["Qualified Listings"]?.[0] ?? [];
  const qualifiedStatusIndex = qualifiedHeaders.indexOf("status");
  const qualifiedBrokersIndex = qualifiedHeaders.indexOf("brokers");
  const qualifiedPaywallLinksIndex = qualifiedHeaders.indexOf("paywall_links");
  const qualifiedAdminLinksIndex = qualifiedHeaders.indexOf("admin_links");
  const qualifiedSourceUrlsIndex = qualifiedHeaders.indexOf("source_urls");
  const qualifiedRows = snapshot["Qualified Listings"]?.slice(1) ?? [];
  assert.equal(qualifiedRows.filter((row) => row[qualifiedStatusIndex] === "PROCESSED").length, 2);
  const groupedIndustrialRow = qualifiedRows.find((row) => (row[qualifiedBrokersIndex] ?? "").includes("avery@example.com"));
  assert.ok(groupedIndustrialRow);
  assert.match(groupedIndustrialRow?.[qualifiedBrokersIndex] ?? "", /morgan@example\.com/);
  assert.match(groupedIndustrialRow?.[qualifiedPaywallLinksIndex] ?? "", /avery@example\.com/);
  assert.match(groupedIndustrialRow?.[qualifiedPaywallLinksIndex] ?? "", /morgan@example\.com/);
  assert.match(groupedIndustrialRow?.[qualifiedAdminLinksIndex] ?? "", /\/a\//);
  assert.match(groupedIndustrialRow?.[qualifiedSourceUrlsIndex] ?? "", /hudson-industrial-1/);

  const zipHeaders = snapshot["ZIP Targets"]?.[0] ?? [];
  const zipStatusIndex = zipHeaders.indexOf("status");
  assert.equal(snapshot["ZIP Targets"]?.[1]?.[zipStatusIndex], "DONE");
});

test("mock discovery validation accepts a trusted secondary broker profile page email", async () => {
  const { discoverLiteZipCandidates, hasTrustedLiteBrokerEmail, validateLiteDiscoveredCandidate } = await import(
    "../../src/lib/lite/discovery"
  );

  const candidates = await discoverLiteZipCandidates({
    zip: "01749",
    propertyTypes: ["Retail", "Industrial"],
  });
  const candidate = candidates.find((row) => row.sourceUrl === "https://crexi.example/hudson-industrial-1");

  assert.ok(candidate);

  const validated = await validateLiteDiscoveredCandidate({
    zip: "01749",
    candidate,
  });

  assert.equal(validated.verifiedBrokerContacts.length, 2);
  assert.equal(validated.brokerEmailSourceType, "broker_profile_page");
  assert.match(validated.brokerEmailSourceUrl ?? "", /westadvisors\.example\.com/);
  assert.equal(hasTrustedLiteBrokerEmail(validated), true);
});

test("preferred broker selection chooses the first verified listing contact in listing order", async () => {
  const { selectPreferredLiteBrokerContact } = await import("../../src/lib/lite/discovery");

  const selected = selectPreferredLiteBrokerContact({
    listingContactNames: ["Leslie Cotter", "Andrew Jacob"],
    verifiedBrokerContacts: [
      {
        name: "Andrew Jacob",
        email: "ajacob@atlanticretail.com",
        emailSourceType: "broker_profile_page",
        emailSourceUrl: "https://atlanticretail.com/about/team/",
      },
      {
        name: "Leslie Cotter",
        email: "lcotter@atlanticretail.com",
        emailSourceType: "broker_profile_page",
        emailSourceUrl: "https://atlanticretail.com/about/team/",
      },
    ],
  });

  assert.equal(selected?.name, "Leslie Cotter");
  assert.equal(selected?.email, "lcotter@atlanticretail.com");
});

test("daily ZIP discovery respects the validation cap and reports truncation", async () => {
  const originalValidationCap = process.env.LITE_DISCOVERY_MAX_VALIDATIONS_PER_RUN;
  const originalValidationConcurrency = process.env.LITE_DISCOVERY_VALIDATION_CONCURRENCY;

  process.env.LITE_DISCOVERY_MAX_VALIDATIONS_PER_RUN = "1";
  process.env.LITE_DISCOVERY_VALIDATION_CONCURRENCY = "1";

  try {
    resetMockLiteSheetValues({
      Sheet1: [["broker_name", "email", "listing_address", "link"]],
      "ZIP Targets": [
        ["zip", "active", "sequence", "status", "property_types", "daily_limit"],
        ["01749", "true", "1", "PENDING", "Retail, Industrial", "25"],
      ],
    });

    const { POST } = await import("../../src/app/api/lite/discovery/run/route");
    const response = await POST(new Request("http://localhost/api/lite/discovery/run", { method: "POST" }));
    assert.equal(response.status, 200);

    const payload = (await response.json()) as {
      summary?: {
        candidateCount: number;
        qualifiedCount: number;
        promotedCount: number;
        processedCount: number;
        draftCount: number;
        notes?: string[];
      };
    };

    assert.equal(payload.summary?.candidateCount, 5);
    assert.equal(payload.summary?.qualifiedCount, 1);
    assert.equal(payload.summary?.promotedCount, 1);
    assert.equal(payload.summary?.processedCount, 1);
    assert.equal(payload.summary?.draftCount, 1);
    assert.match((payload.summary?.notes ?? []).join(" "), /Validation capped at 1 of 5/i);
  } finally {
    if (originalValidationCap == null) {
      delete process.env.LITE_DISCOVERY_MAX_VALIDATIONS_PER_RUN;
    } else {
      process.env.LITE_DISCOVERY_MAX_VALIDATIONS_PER_RUN = originalValidationCap;
    }

    if (originalValidationConcurrency == null) {
      delete process.env.LITE_DISCOVERY_VALIDATION_CONCURRENCY;
    } else {
      process.env.LITE_DISCOVERY_VALIDATION_CONCURRENCY = originalValidationConcurrency;
    }
  }
});

test("daily ZIP discovery reuses the same in-progress ZIP when daily limit is hit", async () => {
  resetMockLiteSheetValues({
    Sheet1: [["broker_name", "email", "listing_address", "link"]],
    "ZIP Targets": [
      ["zip", "active", "sequence", "status", "property_types", "daily_limit"],
      ["01749", "true", "1", "PENDING", "Retail, Industrial", "1"],
      ["01803", "true", "2", "PENDING", "Retail, Industrial", "25"],
    ],
  });

  const { POST } = await import("../../src/app/api/lite/discovery/run/route");
  const firstResponse = await POST(new Request("http://localhost/api/lite/discovery/run", { method: "POST" }));
  assert.equal(firstResponse.status, 200);

  let snapshot = getMockLiteSheetSnapshot();
  let zipHeaders = snapshot["ZIP Targets"]?.[0] ?? [];
  let zipStatusIndex = zipHeaders.indexOf("status");
  assert.equal(snapshot["ZIP Targets"]?.[1]?.[zipStatusIndex], "IN_PROGRESS");
  assert.equal(snapshot["Broker Outreach Queue"]?.length, 2);

  const secondResponse = await POST(new Request("http://localhost/api/lite/discovery/run", { method: "POST" }));
  assert.equal(secondResponse.status, 200);

  snapshot = getMockLiteSheetSnapshot();
  assert.equal(snapshot["Broker Outreach Queue"]?.length, 3);
  assert.equal(snapshot["ZIP Targets"]?.[1]?.[zipStatusIndex], "IN_PROGRESS");
});

test("approved broker outreach drafts send through the lite queue route", async () => {
  resetMockLiteSheetValues({
    Sheet1: [["broker_name", "email", "listing_address", "link"]],
    "ZIP Targets": [
      ["zip", "active", "sequence", "status", "property_types", "daily_limit"],
      ["01749", "true", "1", "PENDING", "Retail, Industrial", "25"],
    ],
  });

  const { POST: discoveryPOST } = await import("../../src/app/api/lite/discovery/run/route");
  await discoveryPOST(new Request("http://localhost/api/lite/discovery/run", { method: "POST" }));

  const seededSnapshot = getMockLiteSheetSnapshot();
  const queueHeaders = seededSnapshot["Broker Outreach Queue"]?.[0] ?? [];
  const approvalStatusIndex = queueHeaders.indexOf("approval_status");
  const approvedSnapshot = {
    ...seededSnapshot,
    "Broker Outreach Queue": (seededSnapshot["Broker Outreach Queue"] ?? []).map((row, index) =>
      index === 0 ? row : row.map((value, columnIndex) => (columnIndex === approvalStatusIndex ? "APPROVED" : value)),
    ),
  };
  resetMockLiteSheetValues(approvedSnapshot);

  const { POST: sendPOST } = await import("../../src/app/api/lite/outreach/process-approved/route");
  const response = await sendPOST(new Request("http://localhost/api/lite/outreach/process-approved", { method: "POST" }));
  assert.equal(response.status, 200);
  const payload = (await response.json()) as { sentCount?: number; failedCount?: number };
  assert.equal(payload.sentCount, 3);
  assert.equal(payload.failedCount, 0);

  const sentSnapshot = getMockLiteSheetSnapshot();
  const sentHeaders = sentSnapshot["Broker Outreach Queue"]?.[0] ?? [];
  const sendStatusIndex = sentHeaders.indexOf("send_status");
  const messageIdIndex = sentHeaders.indexOf("gmail_message_id");
  for (const row of sentSnapshot["Broker Outreach Queue"]?.slice(1) ?? []) {
    assert.equal(row[sendStatusIndex], "SENT");
    assert.match(row[messageIdIndex] ?? "", /^mock_gmail_/);
  }
});

test("run another listing appends a new intake row and returns a fresh link", async () => {
  const { POST: processPOST } = await import("../../src/app/api/lite/sheets/process/route");
  await processPOST(new Request("http://localhost/api/lite/sheets/process", { method: "POST" }));

  const [link] = await listLiteLinkItems("00000000-0000-0000-0000-000000000001");
  const token = new URL(link.paywallUrl).pathname.split("/").pop() ?? "";
  const signature = createLiteAdminLinkSignature(token);

  const { POST } = await import("../../src/app/api/lite/listings/request-another/route");
  const response = await POST(
    new Request("http://localhost/api/lite/listings/request-another", {
      method: "POST",
      body: JSON.stringify({
        token,
        adminSignature: signature,
        listingAddress: "250 Summer St, Boston, MA 02210",
        buyerEmail: "buyer@example.com",
        buyerName: "Taylor Buyer",
      }),
      headers: {
        "Content-Type": "application/json",
      },
    }),
  );
  assert.equal(response.status, 200);
  const payload = (await response.json()) as { url?: string; adminUrl?: string };
  assert.match(payload.url ?? "", /\/r\//);
  assert.match(payload.adminUrl ?? "", /\/a\//);

  const snapshot = getMockLiteSheetSnapshot();
  assert.equal(snapshot.Sheet1?.length, 3);
  assert.equal(snapshot.Sheet1?.[2]?.[2], "250 Summer St, Boston, MA 02210");
  assert.notEqual(snapshot.Sheet1?.[1]?.[3], snapshot.Sheet1?.[2]?.[3]);
});
