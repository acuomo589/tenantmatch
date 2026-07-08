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

function parseBooleanFlag(value: string | undefined, fallback = false): boolean {
  if (!value) return fallback;
  return ["1", "true", "yes", "y"].includes(value.trim().toLowerCase());
}

async function main(): Promise<void> {
  loadLocalEnv();

  const targetZip = process.env.TARGET_ZIP?.trim() || "01752";
  const propertyTypes = (process.env.TARGET_PROPERTY_TYPES?.trim() || "Retail, Industrial")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const dailyLimit = Number.parseInt(process.env.TARGET_DAILY_LIMIT ?? "", 10) || 25;
  const sequence = Number.parseInt(process.env.TARGET_SEQUENCE ?? "", 10) || 1;
  const notes = process.env.TARGET_NOTES?.trim() || "Marlborough, MA E2E";
  const deactivateOtherZips = parseBooleanFlag(process.env.DEACTIVATE_OTHER_ZIPS, false);

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
    getLiteConfig(): { zipTargetsTabName: string };
  }>("../src/lib/lite/config.ts");
  const automationSheet = await loadModule<{
    buildZipTargetHeaderState(
      values: string[][],
      tabName: string,
    ): {
      headerIndex: Map<string, number>;
      headerUpdates: Array<{ tabName: string; rowNumber: number; columnIndex: number; value: string }>;
    };
    buildZipTargetRowUpdates(
      tabName: string,
      rowNumber: number,
      headerIndex: Map<string, number>,
      row: {
        rowNumber: number;
        zip: string;
        active: boolean;
        sequence: number;
        status: "PENDING" | "IN_PROGRESS" | "DONE";
        propertyTypes: string[];
        dailyLimit: number;
        lastRunAt: Date | null;
        lastQualifiedCount: number | null;
        completedAt: Date | null;
        notes: string | null;
      },
    ): Array<{ tabName: string; rowNumber: number; columnIndex: number; value: string }>;
    parseZipTargetsTable(values: string[][], tabName: string): {
      rows: Array<{
        rowNumber: number;
        zip: string;
        active: boolean;
        sequence: number;
        status: "PENDING" | "IN_PROGRESS" | "DONE";
        propertyTypes: string[];
        dailyLimit: number;
        lastRunAt: Date | null;
        lastQualifiedCount: number | null;
        completedAt: Date | null;
        notes: string | null;
      }>;
    };
  }>("../src/lib/lite/automation-sheet.ts");

  const config = configModule.getLiteConfig();
  const adapter = await googleSheet.createLiteSheetAdapter();
  await adapter.ensureTabs([config.zipTargetsTabName]);

  const values = await adapter.readValues(config.zipTargetsTabName);
  const headerState = automationSheet.buildZipTargetHeaderState(values, config.zipTargetsTabName);
  const table = automationSheet.parseZipTargetsTable(values, config.zipTargetsTabName);
  const updates = [...headerState.headerUpdates];

  for (const row of table.rows) {
    if (!deactivateOtherZips || row.zip === targetZip || !row.active) {
      continue;
    }

    updates.push(
      ...automationSheet.buildZipTargetRowUpdates(config.zipTargetsTabName, row.rowNumber, headerState.headerIndex, {
        ...row,
        active: false,
      }),
    );
  }

  const existing = table.rows.find((row) => row.zip === targetZip);
  const targetRowNumber = existing?.rowNumber ?? Math.max(values.length, 1) + 1;

  updates.push(
    ...automationSheet.buildZipTargetRowUpdates(config.zipTargetsTabName, targetRowNumber, headerState.headerIndex, {
      rowNumber: targetRowNumber,
      zip: targetZip,
      active: true,
      sequence,
      status: "PENDING",
      propertyTypes,
      dailyLimit,
      lastRunAt: null,
      lastQualifiedCount: null,
      completedAt: null,
      notes,
    }),
  );

  await adapter.writeValues(updates);

  console.log(
    JSON.stringify(
      {
        zipTargetsTab: config.zipTargetsTabName,
        targetZip,
        propertyTypes,
        dailyLimit,
        sequence,
        deactivateOtherZips,
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
