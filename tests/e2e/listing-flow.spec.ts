import { expect, test } from "@playwright/test";
import Stripe from "stripe";

test("admin processes sheet rows, preview opens once, and paid webhook unlocks full workbook", async ({ page }) => {
  await page.goto("/workspace");

  await expect(page.getByRole("heading", { name: /process sheet rows into paid workbook links/i })).toBeVisible();
  await page.getByRole("button", { name: /process new rows/i }).click();
  await expect(page.getByText(/processed 1 row/i)).toBeVisible();

  const paywallHref = await page.locator('a[href*="/r/"]').first().getAttribute("href");
  expect(paywallHref).toBeTruthy();
  const token = paywallHref!.split("/").pop()!;

  await page.goto(paywallHref!);
  await expect(page.getByRole("heading", { name: /875 Taylor Station Rd/i })).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.getByRole("button", { name: /unlock full workbook/i })).toBeVisible();

  const openedResponse = await page.request.post(`/api/lite/links/${token}/opened`);
  expect(openedResponse.ok()).toBeTruthy();
  await page.goto("/workspace");
  await expect(page.locator("tbody tr").first()).toContainText("OPENED");

  const payload = JSON.stringify({
    id: "evt_playwright_paid",
    object: "event",
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_playwright_paid",
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
        payment_intent: "pi_playwright_paid",
      },
    },
  });

  const signature = Stripe.webhooks.generateTestHeaderString({
    payload,
    secret: "whsec_test",
  });

  const webhookResponse = await page.request.post("/api/webhooks/stripe", {
    data: payload,
    headers: {
      "Content-Type": "application/json",
      "stripe-signature": signature,
    },
  });
  expect(webhookResponse.ok()).toBeTruthy();

  await page.goto(paywallHref!);
  await expect(page.getByRole("link", { name: /download csv/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /download pdf/i })).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(25);

  await page.goto("/workspace");
  await expect(page.locator("tbody tr").first()).toContainText("PAID");
  await expect(page.locator("tbody tr").first()).toContainText("$49.00");
});
