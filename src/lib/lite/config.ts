const DEFAULT_APP_URL = "http://localhost:3000";
const DEFAULT_LINKS_TAB_NAME = "TenantMatch Links";
const DEFAULT_ZIP_TARGETS_TAB_NAME = "ZIP Targets";
const DEFAULT_DISCOVERED_LISTINGS_TAB_NAME = "Discovered Listings";
const DEFAULT_QUALIFIED_LISTINGS_TAB_NAME = "Qualified Listings";
const DEFAULT_BROKER_OUTREACH_QUEUE_TAB_NAME = "Broker Outreach Queue";
const DEFAULT_AUTOMATION_RUNS_TAB_NAME = "Automation Runs";

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

export function getLiteAdminLinkSecret(): string {
  const configuredSecret = process.env.LITE_ADMIN_LINK_SECRET?.trim() || process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (configuredSecret) {
    return configuredSecret;
  }

  if (isProductionRuntime()) {
    throw new Error("LITE_ADMIN_LINK_SECRET or STRIPE_WEBHOOK_SECRET must be configured in production.");
  }

  return "tenantmatch-lite-admin-dev-secret";
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
    zipTargetsTabName: process.env.LITE_ZIP_TARGETS_TAB_NAME?.trim() || DEFAULT_ZIP_TARGETS_TAB_NAME,
    discoveredListingsTabName:
      process.env.LITE_DISCOVERED_LISTINGS_TAB_NAME?.trim() || DEFAULT_DISCOVERED_LISTINGS_TAB_NAME,
    qualifiedListingsTabName:
      process.env.LITE_QUALIFIED_LISTINGS_TAB_NAME?.trim() || DEFAULT_QUALIFIED_LISTINGS_TAB_NAME,
    brokerOutreachQueueTabName:
      process.env.LITE_BROKER_OUTREACH_QUEUE_TAB_NAME?.trim() || DEFAULT_BROKER_OUTREACH_QUEUE_TAB_NAME,
    automationRunsTabName: process.env.LITE_AUTOMATION_RUNS_TAB_NAME?.trim() || DEFAULT_AUTOMATION_RUNS_TAB_NAME,
    automationSecret: process.env.CRON_SECRET?.trim() || process.env.LITE_AUTOMATION_SECRET?.trim() || null,
    automationTenantId: process.env.LITE_AUTOMATION_TENANT_ID?.trim() || null,
    discoveryDailyLimit: parseInteger(process.env.LITE_DISCOVERY_DAILY_LIMIT, 25),
    discoveryMaxValidationsPerRun: parseInteger(process.env.LITE_DISCOVERY_MAX_VALIDATIONS_PER_RUN, 18),
    discoveryValidationConcurrency: parseInteger(process.env.LITE_DISCOVERY_VALIDATION_CONCURRENCY, 3),
    googleServiceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim() || null,
    googleServiceAccountPrivateKey: normalizePrivateKey(process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) || null,
    gmailFromEmail: process.env.GMAIL_FROM_EMAIL?.trim() || null,
    gmailSenderName: process.env.GMAIL_SENDER_NAME?.trim() || null,
    gmailOauthClientId: process.env.GMAIL_OAUTH_CLIENT_ID?.trim() || null,
    gmailOauthClientSecret: process.env.GMAIL_OAUTH_CLIENT_SECRET?.trim() || null,
    gmailOauthRefreshToken: process.env.GMAIL_OAUTH_REFRESH_TOKEN?.trim() || null,
  };
}
