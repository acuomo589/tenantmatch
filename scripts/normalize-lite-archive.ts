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
      tabs: { archiveTabName: string };
      readValues(tabName: string): Promise<string[][]>;
      writeValues(
        updates: Array<{ tabName: string; rowNumber: number; columnIndex: number; value: string }>,
      ): Promise<void>;
    }>;
  }>("../src/lib/lite/google-sheet.ts");
  const archiveSheet = await loadModule<{
    buildArchiveHeaderState(
      values: string[][],
      tabName: string,
    ): {
      headerUpdates: Array<{ tabName: string; rowNumber: number; columnIndex: number; value: string }>;
    };
    buildArchiveNormalizationUpdates(
      values: string[][],
      tabName: string,
    ): Array<{ tabName: string; rowNumber: number; columnIndex: number; value: string }>;
    parseArchiveTable(values: string[][], tabName: string): { rows: Array<{ token: string }> };
  }>("../src/lib/lite/archive-sheet.ts");

  const adapter = await googleSheet.createLiteSheetAdapter();
  const values = await adapter.readValues(adapter.tabs.archiveTabName);
  const headerState = archiveSheet.buildArchiveHeaderState(values, adapter.tabs.archiveTabName);
  const normalizationUpdates = archiveSheet.buildArchiveNormalizationUpdates(values, adapter.tabs.archiveTabName);

  const updates = [...headerState.headerUpdates, ...normalizationUpdates];
  if (updates.length > 0) {
    await adapter.writeValues(updates);
  }

  const table = archiveSheet.parseArchiveTable(values, adapter.tabs.archiveTabName);
  console.log(
    JSON.stringify(
      {
        archiveTab: adapter.tabs.archiveTabName,
        archiveRows: table.rows.length,
        normalizationUpdates: normalizationUpdates.length,
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
