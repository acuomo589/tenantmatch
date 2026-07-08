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

  const sourceUrlFilter = process.env.SOURCE_URL?.trim();
  if (!sourceUrlFilter) {
    throw new Error("SOURCE_URL is required.");
  }

  const googleSheet = await loadModule<{
    createLiteSheetAdapter(): Promise<{
      readValues(tabName: string): Promise<string[][]>;
    }>;
  }>("../src/lib/lite/google-sheet.ts");
  const configModule = await loadModule<{
    getLiteConfig(): { discoveredListingsTabName: string };
  }>("../src/lib/lite/config.ts");
  const automationSheet = await loadModule<{
    parseDiscoveredListingsTable(values: string[][], tabName: string): {
      rows: Array<{
        rowNumber: number;
        discoveredAt: Date | null;
        zip: string;
        propertyType: string;
        listingTitle: string;
        listingAddress: string;
        brokerName: string | null;
        brokerEmail: string | null;
        brokerEmailSourceType: string;
        brokerEmailSourceUrl: string | null;
        sourceUrl: string;
        sourceDomain: string;
        discoveryStatus: string;
        skipReason: string | null;
        promotedAt: Date | null;
        intakeRowNumber: number | null;
        token: string | null;
        paywallLink: string | null;
        adminLink: string | null;
        error: string | null;
      }>;
    };
  }>("../src/lib/lite/automation-sheet.ts");

  const adapter = await googleSheet.createLiteSheetAdapter();
  const config = configModule.getLiteConfig();
  const values = await adapter.readValues(config.discoveredListingsTabName);
  const table = automationSheet.parseDiscoveredListingsTable(values, config.discoveredListingsTabName);

  const rows = table.rows
    .filter((row) => row.sourceUrl.includes(sourceUrlFilter))
    .sort((left, right) => (right.discoveredAt?.getTime() ?? 0) - (left.discoveredAt?.getTime() ?? 0));

  console.log(JSON.stringify({ sourceUrlFilter, matches: rows }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
