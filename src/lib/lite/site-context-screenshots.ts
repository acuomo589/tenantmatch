import { createHash } from "node:crypto";
import { mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { isMockAgenticFlowEnabled } from "@/lib/testing/mock-agentic-flow";

type CaptureArgs = {
  inputAddress: string;
  listingTitle?: string | null;
  propertyType?: string | null;
  sourceUrl?: string | null;
  screenshotDir?: string | null;
};

type CaptureResult = {
  imageRefs: string[];
  hint: string | null;
};

function safeSlug(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "site"
  );
}

function hashValue(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 10);
}

function isHttpUrl(value: string | null | undefined): value is string {
  if (!value) return false;

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function buildMapSearchUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

export async function captureLiteSiteContextScreenshots(args: CaptureArgs): Promise<CaptureResult> {
  if (isMockAgenticFlowEnabled()) {
    return { imageRefs: [], hint: null };
  }

  let playwright: typeof import("playwright");
  try {
    playwright = await import("playwright");
  } catch {
    return {
      imageRefs: [],
      hint: "Playwright was not available, so no automated visual site screenshots were captured.",
    };
  }

  const screenshotRoot =
    args.screenshotDir?.trim() || path.join(os.tmpdir(), "tenantmatch-site-context-screenshots");
  await mkdir(screenshotRoot, { recursive: true });

  const slug = safeSlug(args.inputAddress);
  const runId = `${Date.now()}-${hashValue(args.inputAddress)}`;
  let browser: Awaited<ReturnType<typeof playwright.chromium.launch>>;
  try {
    browser = await playwright.chromium.launch({ headless: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown browser launch error";
    return {
      imageRefs: [],
      hint: `Playwright Chromium could not launch, so no automated visual site screenshots were captured: ${message.slice(0, 180)}`,
    };
  }

  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(20_000);

  const imageRefs: string[] = [];
  const notes: string[] = [];

  async function capturePage(label: string, url: string): Promise<void> {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await page.waitForTimeout(3000);
      const outputPath = path.join(screenshotRoot, `${slug}-${runId}-${label}.png`);
      await page.screenshot({ path: outputPath, fullPage: false });
      imageRefs.push(outputPath);
      notes.push(`${label} screenshot: ${url}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown capture error";
      notes.push(`${label} screenshot failed: ${message.slice(0, 180)}`);
    }
  }

  try {
    if (isHttpUrl(args.sourceUrl)) {
      await capturePage("listing", args.sourceUrl);
    }

    await capturePage("map", buildMapSearchUrl(args.inputAddress));
  } finally {
    await page.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }

  const hint = [
    "Automated visual site-context capture for TenantMatch.",
    `Address: ${args.inputAddress}`,
    args.listingTitle ? `Listing title: ${args.listingTitle}` : "",
    args.propertyType ? `Discovery property type: ${args.propertyType}` : "",
    "Use screenshots to identify physical envelope, same-site tenants, adjacent uses, parking, frontage, building condition, and retail/restaurant viability. If maps/listing screenshots are blocked or unclear, mark confidence low rather than guessing.",
    ...notes,
  ]
    .filter(Boolean)
    .join("\n");

  return { imageRefs, hint };
}
