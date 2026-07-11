import fs from "node:fs";
import path from "node:path";
import process from "node:process";

type CliOptions = {
  zip: string;
  limit: number;
  maxValidations: number;
  concurrency: number;
  checkLinks: boolean;
  mock: boolean;
};

type ImportedModule<T> = T | { default: T };

function unwrapModule<T extends Record<string, unknown>>(module: ImportedModule<T>): T {
  return "default" in module ? (module.default as T) : (module as T);
}

function unquoteEnvValue(value: string): string {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function loadLocalEnv(): void {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) {
    throw new Error(`Missing ${envPath}. Run from the tenantmatch repo or recreate .env.local first.`);
  }

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    if (process.env[key]) continue;

    process.env[key] = unquoteEnvValue(rawValue).replace(/\\n/g, "\n");
  }
}

function readInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function takeFlagValue(args: string[], index: number, flag: string): { value: string; consumed: number } {
  const current = args[index];
  const inlinePrefix = `${flag}=`;
  if (current.startsWith(inlinePrefix)) {
    return { value: current.slice(inlinePrefix.length), consumed: 1 };
  }

  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${flag}.`);
  }

  return { value, consumed: 2 };
}

function printHelp(): void {
  console.log(`
TenantMatch local discovery runner

Usage:
  npm run discovery -- 01749
  npm run discovery -- 01749 --limit 25

Options:
  --limit <n>             Promoted/processed listing cap. Default: 1.
  --max-validations <n>   Candidate validation cap. Default: 8.
  --concurrency <n>       Validation concurrency. Default: 2.
  --check-links           Fetch generated hosted links after the run.
  --mock                  Use in-memory mock sheet/AI flow.
  --help                  Show this help.
`.trim());
}

function parseArgs(argv: string[]): CliOptions {
  if (!argv.length || argv.includes("--help") || argv.includes("-h")) {
    printHelp();
    process.exit(0);
  }

  const zip = argv.find((arg) => !arg.startsWith("--"));
  if (!zip || !/^\d{5}$/.test(zip)) {
    throw new Error("First argument must be a 5-digit ZIP code, e.g. `npm run discovery -- 01749`.");
  }

  let limit = readInteger(process.env.LITE_DISCOVERY_CLI_LIMIT, 1);
  let maxValidations = readInteger(process.env.LITE_DISCOVERY_CLI_MAX_VALIDATIONS, 8);
  let concurrency = readInteger(process.env.LITE_DISCOVERY_CLI_CONCURRENCY, 2);
  let checkLinks = false;
  let mock = false;

  for (let index = 0; index < argv.length; ) {
    const arg = argv[index];
    if (!arg.startsWith("--")) {
      index += 1;
      continue;
    }

    if (arg === "--check-links") {
      checkLinks = true;
      index += 1;
      continue;
    }

    if (arg === "--mock") {
      mock = true;
      index += 1;
      continue;
    }

    if (arg === "--limit" || arg.startsWith("--limit=")) {
      const { value, consumed } = takeFlagValue(argv, index, "--limit");
      limit = readInteger(value, limit);
      index += consumed;
      continue;
    }

    if (arg === "--max-validations" || arg.startsWith("--max-validations=")) {
      const { value, consumed } = takeFlagValue(argv, index, "--max-validations");
      maxValidations = readInteger(value, maxValidations);
      index += consumed;
      continue;
    }

    if (arg === "--concurrency" || arg.startsWith("--concurrency=")) {
      const { value, consumed } = takeFlagValue(argv, index, "--concurrency");
      concurrency = readInteger(value, concurrency);
      index += consumed;
      continue;
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  return {
    zip,
    limit,
    maxValidations,
    concurrency,
    checkLinks,
    mock,
  };
}

function elapsed(startedAt: number): string {
  return `${((Date.now() - startedAt) / 1000).toFixed(1)}s`;
}

function formatData(data: Record<string, unknown> | undefined): string {
  if (!data) return "";

  const printable = Object.entries(data)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => {
      const rendered = Array.isArray(value) ? value.join(",") : String(value);
      return `${key}=${rendered}`;
    });

  return printable.length ? ` | ${printable.join(" ")}` : "";
}

async function smokeCheckLinks(links: Array<{ paywallLink: string; adminLink: string }>): Promise<void> {
  for (const link of links) {
    for (const [label, url] of [
      ["paywall", link.paywallLink],
      ["admin", link.adminLink],
    ] as const) {
      const safeUrl = url.replace(/sig=[^&]+/, "sig=REDACTED");
      try {
        const response = await fetch(url, { redirect: "manual" });
        console.log(`[check] ${label} ${response.status} ${safeUrl}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : "unknown fetch error";
        console.log(`[check] ${label} failed ${safeUrl} | ${message}`);
      }
    }
  }
}

async function main(): Promise<void> {
  loadLocalEnv();
  const options = parseArgs(process.argv.slice(2));

  if (options.mock) {
    process.env.TENANTMATCH_MOCK_AGENTIC_FLOW = "1";
  }

  process.env.LITE_DISCOVERY_DAILY_LIMIT = String(options.limit);
  process.env.LITE_DISCOVERY_MAX_VALIDATIONS_PER_RUN = String(options.maxValidations);
  process.env.LITE_DISCOVERY_VALIDATION_CONCURRENCY = String(options.concurrency);

  const [{ runLiteZipDiscovery }, { getLiteFallbackTenantId }, { getLiteAppUrl }] = await Promise.all([
    import("../src/lib/lite/automation").then(unwrapModule),
    import("../src/lib/lite/store").then(unwrapModule),
    import("../src/lib/lite/config").then(unwrapModule),
  ]);

  const startedAt = Date.now();
  const links: Array<{
    address: string;
    brokerName: string | null;
    brokerEmail: string | null;
    paywallLink: string;
    adminLink: string;
  }> = [];

  console.log(`[start] zip=${options.zip} limit=${options.limit} maxValidations=${options.maxValidations} concurrency=${options.concurrency}`);

  const appUrl = getLiteAppUrl();
  const request = new Request(`${appUrl}/api/lite/discovery/run`, { method: "POST" });
  const summary = await runLiteZipDiscovery({
    tenantId: getLiteFallbackTenantId(),
    request,
    zipOverride: options.zip,
    dailyLimitOverride: options.limit,
    logger(event) {
      console.log(`[${elapsed(startedAt)}] ${event.stage}: ${event.message}${formatData(event.data)}`);

      if (event.stage === "finalize" && event.message === "Workbook link ready.") {
        links.push({
          address: String(event.data?.address ?? ""),
          brokerName: event.data?.brokerName == null ? null : String(event.data.brokerName),
          brokerEmail: event.data?.brokerEmail == null ? null : String(event.data.brokerEmail),
          paywallLink: String(event.data?.paywallLink ?? ""),
          adminLink: String(event.data?.adminLink ?? ""),
        });
      }
    },
  });

  console.log("");
  console.log("Summary");
  console.log(`  zip: ${summary.zip}`);
  console.log(`  candidates: ${summary.candidateCount}`);
  console.log(`  qualified: ${summary.qualifiedCount}`);
  console.log(`  promoted: ${summary.promotedCount}`);
  console.log(`  processed: ${summary.processedCount}`);
  console.log(`  drafts: ${summary.draftCount}`);
  console.log(`  errors: ${summary.errorCount}`);
  if (summary.notes.length) {
    console.log(`  notes: ${summary.notes.join(" | ")}`);
  }

  if (links.length) {
    console.log("");
    console.log("Generated links");
    for (const link of links) {
      console.log(`  ${link.address}`);
      console.log(`  broker: ${link.brokerName || "N/A"} <${link.brokerEmail || "N/A"}>`);
      console.log(`  paywall: ${link.paywallLink}`);
      console.log(`  admin: ${link.adminLink}`);
    }
  }

  if (options.checkLinks && links.length) {
    console.log("");
    await smokeCheckLinks(links);
  }

  if (summary.errorCount > 0 || summary.processedCount === 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("");
  console.error("Discovery run failed");
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});
