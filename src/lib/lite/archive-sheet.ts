import type { SheetCellUpdate } from "@/lib/lite/google-sheet";
import type { LiteLinkRecord, LiteLinkStatus, LiteLinkWithWorkbook, LiteWorkbookRecord } from "@/lib/lite/types";
import { buildLiteAdminLinkUrl } from "@/lib/lite/url";
import { parseWorkbookCsv } from "@/lib/workbookCsv";

const TRUE_VALUES = new Set(["true", "1", "yes"]);

export const LITE_ARCHIVE_HEADERS = [
  "tenant_id",
  "token",
  "link",
  "status",
  "paid",
  "buyer_email",
  "buyer_name",
  "input_address",
  "display_address",
  "normalized_address",
  "site_context_json",
  "site_context_generated_at",
  "workbook_csv",
  "workbook_csv_data",
  "preview_row_count",
  "price_cents",
  "currency",
  "stripe_checkout_session_id",
  "stripe_payment_intent_id",
  "purchaser_email",
  "purchaser_name",
  "amount_paid_cents",
  "source_tab_name",
  "source_row_number",
  "opened_at",
  "paid_at",
  "error",
  "created_at",
  "updated_at",
] as const;

export type LiteArchiveHeader = (typeof LITE_ARCHIVE_HEADERS)[number];

export type LiteArchiveRow = {
  rowNumber: number;
  tenantId: string;
  token: string;
  link: string;
  status: LiteLinkStatus;
  paid: boolean;
  buyerEmail: string;
  buyerName: string | null;
  inputAddress: string;
  displayAddress: string;
  normalizedAddress: string;
  siteContextJson: string | null;
  siteContextGeneratedAt: Date | null;
  adminLink: string;
  workbookCsv: string;
  previewRowCount: number;
  priceCents: number;
  currency: string;
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
  purchaserEmail: string | null;
  purchaserName: string | null;
  amountPaidCents: number | null;
  sourceTabName: string | null;
  sourceRowNumber: number | null;
  openedAt: Date | null;
  paidAt: Date | null;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type LiteArchiveTable = {
  tabName: string;
  values: string[][];
  headerIndex: Map<LiteArchiveHeader, number>;
  rows: LiteArchiveRow[];
};

function normalizeHeader(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function readCell(row: string[] | undefined, index: number | undefined): string {
  if (!row || index == null || index < 0) return "";
  return (row[index] ?? "").trim();
}

function parseInteger(value: string, fallback = 0): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseNullableInteger(value: string): number | null {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDate(value: string): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseBoolean(value: string): boolean {
  return TRUE_VALUES.has(value.trim().toLowerCase());
}

function looksLikeLinkValue(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

function looksLikeAdminLinkValue(value: string): boolean {
  return /\/a\/[^/?#]+/i.test(value.trim());
}

function looksLikeWorkbookCsvValue(value: string): boolean {
  return value.includes("business_name,") || value.includes("\n");
}

function stringifyNullable(value: string | number | null | undefined): string {
  if (value == null) return "";
  return String(value);
}

function formatDate(value: Date | null): string {
  return value ? value.toISOString() : "";
}

export function deriveLiteStatus(args: {
  paid: boolean;
  openedAt: Date | null;
  error: string | null;
}): LiteLinkStatus {
  if (args.error) return "FAILED";
  if (args.paid) return "PAID";
  if (args.openedAt) return "OPENED";
  return "GENERATED";
}

export function extractLiteTokenFromUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed, "http://localhost");
    const match = parsed.pathname.match(/^\/r\/([^/]+)\/?$/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

export function buildArchiveHeaderState(values: string[][], tabName: string): {
  headerIndex: Map<LiteArchiveHeader, number>;
  headerUpdates: SheetCellUpdate[];
} {
  const headers = (values[0] ?? []).map((value) => normalizeHeader(value));
  const nextHeaders = [...headers];
  const headerUpdates: SheetCellUpdate[] = [];

  for (const header of LITE_ARCHIVE_HEADERS) {
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
    headerIndex: new Map(nextHeaders.map((header, index) => [header as LiteArchiveHeader, index])),
    headerUpdates,
  };
}

export function parseArchiveTable(values: string[][], tabName: string): LiteArchiveTable {
  const { headerIndex } = buildArchiveHeaderState(values, tabName);
  const rows: LiteArchiveRow[] = [];

  for (let index = 1; index < values.length; index += 1) {
    const row = values[index] ?? [];
    const token = readCell(row, headerIndex.get("token"));
    if (!token) continue;
    const workbookCsvCell = readCell(row, headerIndex.get("workbook_csv"));
    const workbookCsvDataCell = readCell(row, headerIndex.get("workbook_csv_data"));

    const paid = parseBoolean(readCell(row, headerIndex.get("paid")));
    const openedAt = parseDate(readCell(row, headerIndex.get("opened_at")));
    const paidAt = parseDate(readCell(row, headerIndex.get("paid_at")));
    const error = readCell(row, headerIndex.get("error")) || null;

    rows.push({
      rowNumber: index + 1,
      tenantId: readCell(row, headerIndex.get("tenant_id")),
      token,
      link: readCell(row, headerIndex.get("link")),
      status: deriveLiteStatus({ paid, openedAt, error }),
      paid,
      buyerEmail: readCell(row, headerIndex.get("buyer_email")),
      buyerName: readCell(row, headerIndex.get("buyer_name")) || null,
      inputAddress: readCell(row, headerIndex.get("input_address")),
      displayAddress: readCell(row, headerIndex.get("display_address")),
      normalizedAddress: readCell(row, headerIndex.get("normalized_address")),
      siteContextJson: readCell(row, headerIndex.get("site_context_json")) || null,
      siteContextGeneratedAt: parseDate(readCell(row, headerIndex.get("site_context_generated_at"))),
      adminLink:
        looksLikeLinkValue(workbookCsvCell) && looksLikeAdminLinkValue(workbookCsvCell)
          ? workbookCsvCell
          : buildLiteAdminLinkUrl(token),
      workbookCsv: workbookCsvDataCell || (looksLikeWorkbookCsvValue(workbookCsvCell) ? workbookCsvCell : ""),
      previewRowCount: parseInteger(readCell(row, headerIndex.get("preview_row_count")), 1),
      priceCents: parseInteger(readCell(row, headerIndex.get("price_cents")), 0),
      currency: readCell(row, headerIndex.get("currency")) || "usd",
      stripeCheckoutSessionId: readCell(row, headerIndex.get("stripe_checkout_session_id")) || null,
      stripePaymentIntentId: readCell(row, headerIndex.get("stripe_payment_intent_id")) || null,
      purchaserEmail: readCell(row, headerIndex.get("purchaser_email")) || null,
      purchaserName: readCell(row, headerIndex.get("purchaser_name")) || null,
      amountPaidCents: parseNullableInteger(readCell(row, headerIndex.get("amount_paid_cents"))),
      sourceTabName: readCell(row, headerIndex.get("source_tab_name")) || null,
      sourceRowNumber: parseNullableInteger(readCell(row, headerIndex.get("source_row_number"))),
      openedAt,
      paidAt,
      error,
      createdAt: parseDate(readCell(row, headerIndex.get("created_at"))) ?? new Date(0),
      updatedAt: parseDate(readCell(row, headerIndex.get("updated_at"))) ?? new Date(0),
    });
  }

  return {
    tabName,
    values,
    headerIndex,
    rows,
  };
}

export function nextArchiveRowNumber(values: string[][]): number {
  return Math.max(values.length, 1) + 1;
}

export function createArchiveLookupMaps(rows: LiteArchiveRow[]) {
  const byToken = new Map<string, LiteArchiveRow>();
  const byBuyerKey = new Map<string, LiteArchiveRow>();
  const byAddressKey = new Map<string, LiteArchiveRow>();

  for (const row of rows) {
    byToken.set(row.token, row);

    if (row.tenantId && row.normalizedAddress && row.buyerEmail) {
      byBuyerKey.set(`${row.tenantId}::${row.normalizedAddress}::${row.buyerEmail}`, row);
    }

    if (row.tenantId && row.normalizedAddress && !byAddressKey.has(`${row.tenantId}::${row.normalizedAddress}`)) {
      byAddressKey.set(`${row.tenantId}::${row.normalizedAddress}`, row);
    }
  }

  return {
    byToken,
    byBuyerKey,
    byAddressKey,
  };
}

export function buildArchiveRowUpdates(
  tabName: string,
  rowNumber: number,
  headerIndex: Map<LiteArchiveHeader, number>,
  row: LiteArchiveRow,
): SheetCellUpdate[] {
  const derivedStatus = deriveLiteStatus({
    paid: row.paid,
    openedAt: row.openedAt,
    error: row.error,
  });

  const payload: Record<LiteArchiveHeader, string> = {
    tenant_id: row.tenantId,
    token: row.token,
    link: row.link,
    status: derivedStatus,
    paid: row.paid ? "true" : "false",
    buyer_email: row.buyerEmail,
    buyer_name: stringifyNullable(row.buyerName),
    input_address: row.inputAddress,
    display_address: row.displayAddress,
    normalized_address: row.normalizedAddress,
    site_context_json: stringifyNullable(row.siteContextJson),
    site_context_generated_at: formatDate(row.siteContextGeneratedAt),
    workbook_csv: row.adminLink || buildLiteAdminLinkUrl(row.token),
    workbook_csv_data: row.workbookCsv,
    preview_row_count: stringifyNullable(row.previewRowCount),
    price_cents: stringifyNullable(row.priceCents),
    currency: row.currency,
    stripe_checkout_session_id: stringifyNullable(row.stripeCheckoutSessionId),
    stripe_payment_intent_id: stringifyNullable(row.stripePaymentIntentId),
    purchaser_email: stringifyNullable(row.purchaserEmail),
    purchaser_name: stringifyNullable(row.purchaserName),
    amount_paid_cents: stringifyNullable(row.amountPaidCents),
    source_tab_name: stringifyNullable(row.sourceTabName),
    source_row_number: stringifyNullable(row.sourceRowNumber),
    opened_at: formatDate(row.openedAt),
    paid_at: formatDate(row.paidAt),
    error: stringifyNullable(row.error),
    created_at: formatDate(row.createdAt),
    updated_at: formatDate(row.updatedAt),
  };

  return LITE_ARCHIVE_HEADERS.map((header) => ({
    tabName,
    rowNumber,
    columnIndex: headerIndex.get(header) ?? 0,
    value: payload[header],
  }));
}

export function buildArchiveNormalizationUpdates(values: string[][], tabName: string): SheetCellUpdate[] {
  const headerState = buildArchiveHeaderState(values, tabName);
  const table = parseArchiveTable(values, tabName);
  const updates: SheetCellUpdate[] = [];

  for (const row of table.rows) {
    const sourceRow = values[row.rowNumber - 1] ?? [];
    const workbookCsvCell = readCell(sourceRow, headerState.headerIndex.get("workbook_csv"));
    const workbookCsvDataCell = readCell(sourceRow, headerState.headerIndex.get("workbook_csv_data"));
    const expectedAdminLink = row.adminLink || buildLiteAdminLinkUrl(row.token);
    const expectedWorkbookCsvData = row.workbookCsv;

    if (workbookCsvCell === expectedAdminLink && workbookCsvDataCell === expectedWorkbookCsvData) {
      continue;
    }

    updates.push(...buildArchiveRowUpdates(tabName, row.rowNumber, headerState.headerIndex, row));
  }

  return updates;
}

function buildWorkbookId(row: LiteArchiveRow): string {
  return `${row.tenantId || "tenant"}:${row.normalizedAddress || row.token}`;
}

export function toLiteLinkWithWorkbook(
  row: LiteArchiveRow,
  options?: {
    allowEmptyWorkbook?: boolean;
  },
): LiteLinkWithWorkbook {
  const workbookRowsJson =
    !row.workbookCsv.trim() && options?.allowEmptyWorkbook
      ? []
      : parseWorkbookCsv(row.workbookCsv, {
          allowLegacyRationale: true,
          allowLegacyPropertyType: true,
        });

  const workbook: LiteWorkbookRecord = {
    id: buildWorkbookId(row),
    tenantId: row.tenantId,
    inputAddress: row.inputAddress,
    normalizedAddress: row.normalizedAddress,
    displayAddress: row.displayAddress || row.inputAddress,
    siteContextJson: row.siteContextJson,
    siteContextGeneratedAt: row.siteContextGeneratedAt,
    workbookCsv: row.workbookCsv,
    workbookRowsJson,
    previewRowCount: row.previewRowCount,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };

  const link: LiteLinkRecord = {
    id: row.token,
    workbookId: workbook.id,
    buyerEmail: row.buyerEmail,
    buyerName: row.buyerName,
    token: row.token,
    status: deriveLiteStatus({
      paid: row.paid,
      openedAt: row.openedAt,
      error: row.error,
    }),
    priceCents: row.priceCents,
    currency: row.currency,
    stripeCheckoutSessionId: row.stripeCheckoutSessionId,
    stripePaymentIntentId: row.stripePaymentIntentId,
    purchaserEmail: row.purchaserEmail,
    purchaserName: row.purchaserName,
    amountPaidCents: row.amountPaidCents,
    openedAt: row.openedAt,
    paidAt: row.paidAt,
    error: row.error,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };

  return {
    ...link,
    workbook,
  };
}
