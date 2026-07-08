import { readFileSync } from "node:fs";
import path from "node:path";

type IntakeTarget = {
  address: string;
  normalizedAddress: string;
  rowNumbers: number[];
};

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

function normalizeHeader(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function findHeaderIndex(headers: string[], aliases: readonly string[]): number {
  return aliases.map((alias) => headers.indexOf(alias)).find((index) => index >= 0) ?? -1;
}

function readCell(row: string[] | undefined, index: number): string {
  return index >= 0 ? (row?.[index] ?? "").trim() : "";
}

async function loadModule<T>(relativePath: string): Promise<T> {
  const moduleUrl = new URL(relativePath, import.meta.url);
  const loaded = await import(moduleUrl.href);
  return ((loaded as { default?: T }).default ?? (loaded as T)) as T;
}

async function main(): Promise<void> {
  loadLocalEnv();
  const addressFilter = process.env.REFRESH_ADDRESS?.trim().toLowerCase() ?? "";
  const limit = Number.parseInt(process.env.REFRESH_LIMIT ?? "", 10);

  const googleSheet = await loadModule<{
    createLiteSheetAdapter(): Promise<{
      tabs: { intakeTabName: string; archiveTabName: string };
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
      headerIndex: Map<string, number>;
      headerUpdates: Array<{ tabName: string; rowNumber: number; columnIndex: number; value: string }>;
    };
    parseArchiveTable(values: string[][], tabName: string): {
      rows: Array<{
        rowNumber: number;
        token: string;
        inputAddress: string;
        displayAddress: string;
        normalizedAddress: string;
        siteContextJson: string | null;
        workbookCsv: string;
        updatedAt: Date;
      } & Record<string, unknown>>;
    };
    buildArchiveRowUpdates(
      tabName: string,
      rowNumber: number,
      headerIndex: Map<string, number>,
      row: Record<string, unknown>,
    ): Array<{ tabName: string; rowNumber: number; columnIndex: number; value: string }>;
  }>("../src/lib/lite/archive-sheet.ts");
  const addressLib = await loadModule<{
    normalizeLiteAddress(value: string): string;
    presentLiteAddress(value: string): string;
  }>("../src/lib/lite/address.ts");
  const workbooks = await loadModule<{
    generateLiteWorkbookFromAddress(
      inputAddress: string,
      options?: { siteContextJson?: string | null },
    ): Promise<{ displayAddress: string; csv: string }>;
  }>("../src/lib/lite/workbooks.ts");

  const adapter = await googleSheet.createLiteSheetAdapter();
  const intakeValues = await adapter.readValues(adapter.tabs.intakeTabName);
  const archiveValues = await adapter.readValues(adapter.tabs.archiveTabName);
  const headerState = archiveSheet.buildArchiveHeaderState(archiveValues, adapter.tabs.archiveTabName);
  const archiveTable = archiveSheet.parseArchiveTable(archiveValues, adapter.tabs.archiveTabName);

  if (headerState.headerUpdates.length) {
    await adapter.writeValues(headerState.headerUpdates);
  }

  if (!intakeValues.length) {
    throw new Error("The intake sheet is empty.");
  }

  const intakeHeaders = (intakeValues[0] ?? []).map((value) => normalizeHeader(value));
  const addressIndex = findHeaderIndex(intakeHeaders, ["address", "listing_address"]);

  if (addressIndex < 0) {
    throw new Error("Could not find `address` or `listing_address` in the intake sheet.");
  }

  const targets = new Map<string, IntakeTarget>();

  for (let index = 1; index < intakeValues.length; index += 1) {
    const row = intakeValues[index] ?? [];
    const address = readCell(row, addressIndex);
    if (!address) continue;
    if (addressFilter && !address.toLowerCase().includes(addressFilter)) continue;

    const normalizedAddress = addressLib.normalizeLiteAddress(addressLib.presentLiteAddress(address));
    const existing = targets.get(normalizedAddress);

    if (existing) {
      existing.rowNumbers.push(index + 1);
      continue;
    }

    targets.set(normalizedAddress, {
      address: addressLib.presentLiteAddress(address),
      normalizedAddress,
      rowNumbers: [index + 1],
    });
  }

  const refreshed: string[] = [];
  const failures: Array<{ address: string; message: string }> = [];
  let skipped = 0;
  let attempted = 0;

  for (const target of targets.values()) {
    if (Number.isFinite(limit) && limit > 0 && attempted >= limit) {
      break;
    }

    const matchingRows = archiveTable.rows.filter((row) => row.normalizedAddress === target.normalizedAddress);
    attempted += 1;

    if (!matchingRows.length) {
      skipped += 1;
      continue;
    }

    const sourceRow = matchingRows[0];
    const siteContextJson = matchingRows.find((row) => row.siteContextJson)?.siteContextJson ?? null;
    try {
      const generated = await workbooks.generateLiteWorkbookFromAddress(sourceRow.inputAddress || target.address, {
        siteContextJson,
      });

      const rowUpdates: Array<{ tabName: string; rowNumber: number; columnIndex: number; value: string }> = [];

      for (const archiveRow of matchingRows) {
        const next = {
          ...archiveRow,
          inputAddress: sourceRow.inputAddress || target.address,
          displayAddress: generated.displayAddress,
          workbookCsv: generated.csv,
          siteContextJson,
          updatedAt: new Date(),
        };

        rowUpdates.push(
          ...archiveSheet.buildArchiveRowUpdates(
            adapter.tabs.archiveTabName,
            archiveRow.rowNumber,
            headerState.headerIndex,
            next,
          ),
        );
      }

      await adapter.writeValues(rowUpdates);

      refreshed.push(`${generated.displayAddress} (${matchingRows.length} link${matchingRows.length === 1 ? "" : "s"})`);
      console.log(`Refreshed ${generated.displayAddress} -> ${matchingRows.length} archive row(s)`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push({
        address: sourceRow.inputAddress || target.address,
        message,
      });
      console.error(`Failed ${sourceRow.inputAddress || target.address}: ${message}`);
    }
  }

  console.log("");
  console.log(
    JSON.stringify(
      {
        intakeTab: adapter.tabs.intakeTabName,
        archiveTab: adapter.tabs.archiveTabName,
        uniqueIntakeAddresses: targets.size,
        refreshedAddresses: refreshed.length,
        skippedAddresses: skipped,
        failedAddresses: failures.length,
        failures,
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
