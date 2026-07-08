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

  const googleSheet = await loadModule<{
    createLiteSheetAdapter(): Promise<{
      ensureTabs(tabNames: string[]): Promise<void>;
      readValues(tabName: string): Promise<string[][]>;
      writeValues(
        updates: Array<{ tabName: string; rowNumber: number; columnIndex: number; value: string }>,
      ): Promise<void>;
    }>;
  }>("../src/lib/lite/google-sheet.ts");
  const configModule = await loadModule<{
    getLiteConfig(): {
      discoveredListingsTabName: string;
      qualifiedListingsTabName: string;
    };
  }>("../src/lib/lite/config.ts");
  const automationSheet = await loadModule<{
    parseDiscoveredListingsTable(values: string[][], tabName: string): { rows: Array<unknown> };
  }>("../src/lib/lite/automation-sheet.ts");
  const qualifiedListings = await loadModule<{
    buildQualifiedListingReviewRows(rows: Array<unknown>): Array<unknown>;
    buildQualifiedListingReviewSyncUpdates(args: {
      existingValues: string[][];
      tabName: string;
      discoveredRows: Array<unknown>;
    }): Array<{ tabName: string; rowNumber: number; columnIndex: number; value: string }>;
  }>("../src/lib/lite/qualified-listings.ts");

  const adapter = await googleSheet.createLiteSheetAdapter();
  const config = configModule.getLiteConfig();
  await adapter.ensureTabs([config.discoveredListingsTabName, config.qualifiedListingsTabName]);

  const [discoveredValues, qualifiedValues] = await Promise.all([
    adapter.readValues(config.discoveredListingsTabName),
    adapter.readValues(config.qualifiedListingsTabName),
  ]);
  const discoveredRows = automationSheet.parseDiscoveredListingsTable(
    discoveredValues,
    config.discoveredListingsTabName,
  ).rows;

  const updates = qualifiedListings.buildQualifiedListingReviewSyncUpdates({
    existingValues: qualifiedValues,
    tabName: config.qualifiedListingsTabName,
    discoveredRows,
  });
  await adapter.writeValues(updates);

  console.log(
    JSON.stringify(
      {
        qualifiedListingsTab: config.qualifiedListingsTabName,
        discoveredRowCount: discoveredRows.length,
        qualifiedListingCount: qualifiedListings.buildQualifiedListingReviewRows(discoveredRows).length,
        wroteUpdates: updates.length,
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
