import { readFileSync } from "node:fs";
import path from "node:path";

function loadLocalEnv(): void {
  const envPath = path.join(process.cwd(), ".env.local");
  const envText = readFileSync(envPath, "utf8");

  for (const line of envText.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex < 0) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }

    process.env[key] = value.replace(/\\n/g, "\n");
  }
}

async function loadModule<T>(relativePath: string): Promise<T> {
  const moduleUrl = new URL(relativePath, import.meta.url);
  const loaded = await import(moduleUrl.href);
  return ((loaded as { default?: T }).default ?? (loaded as T)) as T;
}

async function main(): Promise<void> {
  loadLocalEnv();

  const targetZip = process.env.TARGET_ZIP?.trim() || "01752";
  const maxSampleSize = Number.parseInt(process.env.SAMPLE_SIZE ?? "", 10) || 12;
  const latestOnly = ["1", "true", "yes"].includes((process.env.LATEST_ONLY ?? "").trim().toLowerCase());

  const googleSheet = await loadModule<{
    createLiteSheetAdapter(): Promise<{
      readValues(tabName: string): Promise<string[][]>;
    }>;
  }>("../src/lib/lite/google-sheet.ts");
  const configModule = await loadModule<{
    getLiteConfig(): { discoveredListingsTabName: string; automationRunsTabName: string };
  }>("../src/lib/lite/config.ts");
  const automationSheet = await loadModule<{
    parseDiscoveredListingsTable(values: string[][], tabName: string): {
      rows: Array<{
        zip: string;
        discoveredAt: Date | null;
        listingTitle: string;
        discoveryStatus: string;
        skipReason: string | null;
        brokerEmail: string | null;
        brokerEmailSourceType: string;
        brokerEmailSourceUrl: string | null;
        sourceDomain: string;
        sourceUrl: string;
      }>;
    };
  }>("../src/lib/lite/automation-sheet.ts");

  const adapter = await googleSheet.createLiteSheetAdapter();
  const config = configModule.getLiteConfig();
  const [values, runValues] = await Promise.all([
    adapter.readValues(config.discoveredListingsTabName),
    adapter.readValues(config.automationRunsTabName),
  ]);
  const table = automationSheet.parseDiscoveredListingsTable(values, config.discoveredListingsTabName);
  const runHeaders = runValues[0] ?? [];
  const runHeaderIndex = new Map(runHeaders.map((header, index) => [header.trim().toLowerCase(), index]));
  const zipIndex = runHeaderIndex.get("zip") ?? -1;
  const startedIndex = runHeaderIndex.get("run_started_at") ?? -1;

  const zipRuns = runValues
    .slice(1)
    .map((row, index) => ({
      rowNumber: index + 2,
      zip: zipIndex >= 0 ? (row[zipIndex] ?? "").trim() : "",
      runStartedAt:
        startedIndex >= 0 && row[startedIndex]
          ? new Date(row[startedIndex])
          : null,
    }))
    .filter((row) => row.zip === targetZip && row.runStartedAt && !Number.isNaN(row.runStartedAt.getTime()))
    .sort((left, right) => (right.runStartedAt?.getTime() ?? 0) - (left.runStartedAt?.getTime() ?? 0));

  const latestStartedAt = latestOnly ? (zipRuns[0]?.runStartedAt?.getTime() ?? null) : null;
  const previousStartedAt = latestOnly ? (zipRuns[1]?.runStartedAt?.getTime() ?? Number.NEGATIVE_INFINITY) : null;

  const matchingRows = table.rows.filter((row) => {
    if (row.zip !== targetZip) {
      return false;
    }

    if (!latestOnly) {
      return true;
    }

    const discoveredAt = row.discoveredAt?.getTime();
    if (!discoveredAt || latestStartedAt == null) {
      return false;
    }

    return discoveredAt >= latestStartedAt - 1000 && discoveredAt > (previousStartedAt ?? Number.NEGATIVE_INFINITY);
  });

  const counts = matchingRows.reduce<Record<string, number>>((accumulator, row) => {
    accumulator[row.discoveryStatus] = (accumulator[row.discoveryStatus] || 0) + 1;
    return accumulator;
  }, {});

  console.log(
    JSON.stringify(
      {
        zip: targetZip,
        total: matchingRows.length,
        counts,
        sample: matchingRows.slice(-maxSampleSize).map((row) => ({
          discoveredAt: row.discoveredAt?.toISOString() ?? null,
          listingTitle: row.listingTitle,
          discoveryStatus: row.discoveryStatus,
          skipReason: row.skipReason,
          brokerEmail: row.brokerEmail,
          brokerEmailSourceType: row.brokerEmailSourceType,
          brokerEmailSourceUrl: row.brokerEmailSourceUrl,
          sourceDomain: row.sourceDomain,
          sourceUrl: row.sourceUrl,
        })),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
