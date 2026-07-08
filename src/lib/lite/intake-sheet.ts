import type { SheetCellUpdate } from "@/lib/lite/google-sheet";

export const LITE_INTAKE_HEADERS = [
  "broker_name",
  "email",
  "listing_address",
  "listing_title",
  "property_type",
  "zip",
  "source_url",
  "link",
  "error",
] as const;

export type LiteIntakeHeader = (typeof LITE_INTAKE_HEADERS)[number];

export type LiteIntakeEntry = {
  brokerName?: string | null;
  email: string;
  listingAddress: string;
  listingTitle?: string | null;
  propertyType?: string | null;
  zip?: string | null;
  sourceUrl?: string | null;
};

export type LiteIntakeRowSnapshot = {
  rowNumber: number;
  brokerName: string;
  email: string;
  listingAddress: string;
  listingTitle: string;
  propertyType: string;
  zip: string;
  sourceUrl: string;
  link: string;
  error: string;
};

function normalizeHeader(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function readCell(row: string[] | undefined, index: number | undefined): string {
  if (!row || index == null || index < 0) return "";
  return (row[index] ?? "").trim();
}

export function buildIntakeHeaderState(values: string[][], tabName: string): {
  headerIndex: Map<LiteIntakeHeader, number>;
  headerUpdates: SheetCellUpdate[];
} {
  const headers = (values[0] ?? []).map((value) => normalizeHeader(value));
  const nextHeaders = [...headers];
  const headerUpdates: SheetCellUpdate[] = [];

  for (const header of LITE_INTAKE_HEADERS) {
    if (nextHeaders.includes(header)) continue;
    const columnIndex = nextHeaders.length;
    nextHeaders[columnIndex] = header;
    headerUpdates.push({
      tabName,
      rowNumber: 1,
      columnIndex,
      value: header,
    });
  }

  return {
    headerIndex: new Map(nextHeaders.map((header, index) => [header as LiteIntakeHeader, index])),
    headerUpdates,
  };
}

export function nextSheetRowNumber(values: string[][]): number {
  return Math.max(values.length, 1) + 1;
}

export function buildIntakeRowUpdates(
  tabName: string,
  rowNumber: number,
  headerIndex: Map<LiteIntakeHeader, number>,
  entry: LiteIntakeEntry,
): SheetCellUpdate[] {
  const payload: Record<LiteIntakeHeader, string> = {
    broker_name: entry.brokerName?.trim() ?? "",
    email: entry.email.trim(),
    listing_address: entry.listingAddress.trim(),
    listing_title: entry.listingTitle?.trim() ?? "",
    property_type: entry.propertyType?.trim() ?? "",
    zip: entry.zip?.trim() ?? "",
    source_url: entry.sourceUrl?.trim() ?? "",
    link: "",
    error: "",
  };

  return LITE_INTAKE_HEADERS.map((header) => ({
    tabName,
    rowNumber,
    columnIndex: headerIndex.get(header) ?? 0,
    value: payload[header],
  }));
}

export function readIntakeRowSnapshot(
  values: string[][],
  rowNumber: number,
  headerIndex: Map<LiteIntakeHeader, number>,
): LiteIntakeRowSnapshot {
  const row = values[rowNumber - 1] ?? [];
  return {
    rowNumber,
    brokerName: readCell(row, headerIndex.get("broker_name")),
    email: readCell(row, headerIndex.get("email")),
    listingAddress: readCell(row, headerIndex.get("listing_address")),
    listingTitle: readCell(row, headerIndex.get("listing_title")),
    propertyType: readCell(row, headerIndex.get("property_type")),
    zip: readCell(row, headerIndex.get("zip")),
    sourceUrl: readCell(row, headerIndex.get("source_url")),
    link: readCell(row, headerIndex.get("link")),
    error: readCell(row, headerIndex.get("error")),
  };
}
