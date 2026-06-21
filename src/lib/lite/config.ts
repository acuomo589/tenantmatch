const DEFAULT_APP_URL = "http://localhost:3000";
const DEFAULT_LINKS_TAB_NAME = "TenantMatch Links";

function isLocalHostname(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1";
}

export function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production";
}

function parseInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function normalizePrivateKey(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;

  const unquoted =
    (trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))
      ? trimmed.slice(1, -1)
      : trimmed;

  return unquoted
    .replace(/\\\r?\n/g, "\n")
    .replace(/\\\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\\$/g, "")
    .trim();
}

export function parseSpreadsheetId(sheetUrl: string): string | null {
  const match = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match?.[1] ?? null;
}

export function getLiteAppUrl(): string {
  const configuredUrl = process.env.APP_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (!configuredUrl) {
    if (isProductionRuntime()) {
      throw new Error("APP_URL or NEXT_PUBLIC_APP_URL must be configured in production.");
    }

    return DEFAULT_APP_URL;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(configuredUrl);
  } catch {
    throw new Error("APP_URL or NEXT_PUBLIC_APP_URL must be a valid absolute URL.");
  }

  if (isProductionRuntime()) {
    if (isLocalHostname(parsedUrl.hostname)) {
      throw new Error("APP_URL or NEXT_PUBLIC_APP_URL cannot point to localhost in production.");
    }

    if (parsedUrl.protocol !== "https:") {
      throw new Error("APP_URL or NEXT_PUBLIC_APP_URL must use https in production.");
    }
  }

  return parsedUrl.toString().replace(/\/$/, "");
}

export function getLiteConfig() {
  const sheetUrl = process.env.LITE_GOOGLE_SHEET_URL?.trim() ?? "";

  return {
    appUrl: getLiteAppUrl(),
    priceCents: parseInteger(process.env.LITE_LINK_PRICE_CENTS, 4900),
    currency: (process.env.LITE_LINK_CURRENCY?.trim().toLowerCase() || "usd"),
    previewRowCount: parseInteger(process.env.LITE_PREVIEW_ROW_COUNT, 1),
    googleSheetUrl: sheetUrl,
    googleSpreadsheetId: sheetUrl ? parseSpreadsheetId(sheetUrl) : null,
    googleSheetTabName: process.env.LITE_GOOGLE_SHEET_TAB_NAME?.trim() || null,
    googleLinksTabName: process.env.LITE_GOOGLE_LINKS_TAB_NAME?.trim() || DEFAULT_LINKS_TAB_NAME,
    googleServiceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim() || null,
    googleServiceAccountPrivateKey: normalizePrivateKey(process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) || null,
  };
}
