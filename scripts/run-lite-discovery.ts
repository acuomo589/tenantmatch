import fs from "node:fs";
import path from "node:path";
import process from "node:process";

type CliOptions = {
  zips: string[];
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
  npm run discovery -- 01608 01604 01605 --limit 25
  npm run discovery -- --zips 01608,01604,01605 --limit 25

Options:
  --zips <list>           Comma-separated ZIP list. Positional ZIPs also work.
  --limit <n>             Promoted/processed listing cap. Default: 1.
  --max-validations <n>   Candidate validation cap. Default: 8.
  --concurrency <n>       Validation concurrency. Default: 2.
  --check-links           Fetch generated hosted links after the run.
  --mock                  Use in-memory mock sheet/AI flow.
  --help                  Show this help.
`.trim());
}

function normalizeArgv(argv: string[]): string[] {
  const normalized: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    if (
      argv[index] === "--" &&
      ["limit", "max-validations", "concurrency", "zips"].includes((argv[index + 1] ?? "").trim())
    ) {
      normalized.push(`--${argv[index + 1]}`);
      index += 1;
      continue;
    }

    normalized.push(argv[index]);
  }

  return normalized;
}

function parseArgs(argv: string[]): CliOptions {
  argv = normalizeArgv(argv);

  if (!argv.length || argv.includes("--help") || argv.includes("-h")) {
    printHelp();
    process.exit(0);
  }

  const zips: string[] = [];

  let limit = readInteger(process.env.LITE_DISCOVERY_CLI_LIMIT, 1);
  let maxValidations = readInteger(process.env.LITE_DISCOVERY_CLI_MAX_VALIDATIONS, 8);
  let concurrency = readInteger(process.env.LITE_DISCOVERY_CLI_CONCURRENCY, 2);
  let checkLinks = false;
  let mock = false;

  for (let index = 0; index < argv.length; ) {
    const arg = argv[index];
    if (!arg.startsWith("--")) {
      for (const zip of arg.split(",").map((value) => value.trim()).filter(Boolean)) {
        zips.push(zip);
      }
      index += 1;
      continue;
    }

    if (arg === "--") {
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

    if (arg === "--zips" || arg.startsWith("--zips=")) {
      const { value, consumed } = takeFlagValue(argv, index, "--zips");
      for (const zip of value.split(",").map((part) => part.trim()).filter(Boolean)) {
        zips.push(zip);
      }
      index += consumed;
      continue;
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  const uniqueZips = [...new Set(zips)];
  const invalidZips = uniqueZips.filter((zip) => !/^\d{5}$/.test(zip));
  if (!uniqueZips.length || invalidZips.length) {
    throw new Error(
      invalidZips.length
        ? `Invalid ZIP code(s): ${invalidZips.join(", ")}. Use 5-digit ZIPs.`
        : "Provide at least one 5-digit ZIP code, e.g. `npm run discovery -- 01749`.",
    );
  }

  return {
    zips: uniqueZips,
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

  console.log(
    `[start] zips=${options.zips.join(",")} limit=${options.limit} maxValidations=${options.maxValidations} concurrency=${options.concurrency}`,
  );

  const appUrl = getLiteAppUrl();
  const request = new Request(`${appUrl}/api/lite/discovery/run`, { method: "POST" });
  const summaries: Array<Awaited<ReturnType<typeof runLiteZipDiscovery>>> = [];

  for (const [index, zip] of options.zips.entries()) {
    if (options.zips.length > 1) {
      console.log("");
      console.log(`[zip ${index + 1}/${options.zips.length}] ${zip}`);
    }

    const summary = await runLiteZipDiscovery({
      tenantId: getLiteFallbackTenantId(),
      request,
      zipOverride: zip,
      dailyLimitOverride: options.limit,
      logger(event) {
        console.log(`[${elapsed(startedAt)}] ${zip} ${event.stage}: ${event.message}${formatData(event.data)}`);

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
    summaries.push(summary);
  }

  const totals = summaries.reduce(
    (acc, summary) => ({
      candidateCount: acc.candidateCount + summary.candidateCount,
      qualifiedCount: acc.qualifiedCount + summary.qualifiedCount,
      promotedCount: acc.promotedCount + summary.promotedCount,
      processedCount: acc.processedCount + summary.processedCount,
      draftCount: acc.draftCount + summary.draftCount,
      errorCount: acc.errorCount + summary.errorCount,
    }),
    {
      candidateCount: 0,
      qualifiedCount: 0,
      promotedCount: 0,
      processedCount: 0,
      draftCount: 0,
      errorCount: 0,
    },
  );

  console.log("");
  console.log("Summary");
  for (const summary of summaries) {
    console.log(
      `  ${summary.zip}: candidates=${summary.candidateCount} qualified=${summary.qualifiedCount} promoted=${summary.promotedCount} processed=${summary.processedCount} drafts=${summary.draftCount} errors=${summary.errorCount}`,
    );
    if (summary.notes.length) {
      console.log(`    notes: ${summary.notes.join(" | ")}`);
    }
  }
  console.log(
    `  total: candidates=${totals.candidateCount} qualified=${totals.qualifiedCount} promoted=${totals.promotedCount} processed=${totals.processedCount} drafts=${totals.draftCount} errors=${totals.errorCount}`,
  );

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

  if (totals.errorCount > 0 || totals.processedCount === 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("");
  console.error("Discovery run failed");
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});
