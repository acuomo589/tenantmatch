import { randomBytes } from "node:crypto";
import {
  buildArchiveNormalizationUpdates,
  buildArchiveHeaderState,
  buildArchiveRowUpdates,
  createArchiveLookupMaps,
  extractLiteTokenFromUrl,
  nextArchiveRowNumber,
  parseArchiveTable,
  type LiteArchiveRow,
} from "@/lib/lite/archive-sheet";
import { normalizeBuyerEmail, normalizeLiteAddress, presentLiteAddress } from "@/lib/lite/address";
import { getLiteConfig } from "@/lib/lite/config";
import {
  createLiteSheetAdapter,
  getMockLiteSheetSnapshot,
  resetMockLiteSheetValues,
  type SheetCellUpdate,
} from "@/lib/lite/google-sheet";
import { captureLiteSiteContextScreenshots } from "@/lib/lite/site-context-screenshots";
import type { LiteProcessSummary, LiteSheetRow } from "@/lib/lite/types";
import { generateLiteSiteContext, normalizeSiteContextImageRefs } from "@/lib/lite/site-context";
import { buildLiteAdminLinkUrl, buildLiteLinkUrl } from "@/lib/lite/url";
import { generateLiteWorkbookFromAddress } from "@/lib/lite/workbooks";
import { isMockAgenticFlowEnabled } from "@/lib/testing/mock-agentic-flow";

const ADDRESS_HEADERS = ["address", "listing_address"] as const;
const BUYER_EMAIL_HEADERS = ["buyer_email", "email"] as const;
const BUYER_NAME_HEADERS = ["buyer_name", "broker_name"] as const;
const SITE_CONTEXT_HEADERS = ["site_context", "co_tenancy_notes", "cotenancy_notes", "site_notes"] as const;
const SITE_CONTEXT_IMAGE_HEADERS = ["site_context_image_urls", "site_context_image_url", "map_image_urls", "map_image_url"] as const;
const LISTING_TITLE_HEADERS = ["listing_title", "title"] as const;
const PROPERTY_TYPE_HEADERS = ["property_type", "listing_type"] as const;
const SOURCE_URL_HEADERS = ["source_urls", "source_url", "listing_urls", "listing_url", "url"] as const;
const FORCE_REGENERATE_HEADERS = ["force_regenerate", "refresh_workbook", "rerun"] as const;
const LINK_HEADERS = ["link", "paywall_url", "payment_url"] as const;
const ERROR_HEADERS = ["error"] as const;
const MAX_SHEET_CELL_LENGTH = 50_000;
const TRUE_VALUES = new Set(["true", "1", "yes", "y"]);

function normalizeHeader(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function findHeaderIndex(headers: string[], aliases: readonly string[]): number {
  return aliases.map((alias) => headers.indexOf(alias)).find((index) => index >= 0) ?? -1;
}

function readCell(row: string[] | undefined, index: number): string {
  return index >= 0 ? (row?.[index] ?? "").trim() : "";
}

function parseBooleanCell(value: string): boolean {
  return TRUE_VALUES.has(value.trim().toLowerCase());
}

function parseSourceUrls(value: string | null): string[] {
  if (!value) return [];

  const seen = new Set<string>();
  const urls: string[] = [];
  for (const candidate of value.split(/[\n,]+/)) {
    const trimmed = candidate.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    urls.push(trimmed);
  }

  return urls;
}

function createLiteToken(): string {
  return randomBytes(18).toString("base64url");
}

function assertWorkbookCsvFits(workbookCsv: string): void {
  if (workbookCsv.length > MAX_SHEET_CELL_LENGTH) {
    throw new Error("Generated workbook CSV is too large to store in the archive tab.");
  }
}

function queueUpdate(updates: Map<string, SheetCellUpdate>, update: SheetCellUpdate): void {
  updates.set(`${update.tabName}:${update.rowNumber}:${update.columnIndex}`, update);
}

function parseIntakeSheetValues(values: string[][], tabName: string): {
  rows: LiteSheetRow[];
  invalidRows: number;
  skippedRows: number;
  linkColumnIndex: number;
  errorColumnIndex: number;
  headerUpdates: SheetCellUpdate[];
} {
  if (!values.length) {
    throw new Error("The configured intake sheet is empty.");
  }

  const headers = values[0].map((value) => normalizeHeader(value));
  const addressIndex = findHeaderIndex(headers, ADDRESS_HEADERS);
  const buyerEmailIndex = findHeaderIndex(headers, BUYER_EMAIL_HEADERS);
  const buyerNameIndex = findHeaderIndex(headers, BUYER_NAME_HEADERS);
  const siteContextIndex = findHeaderIndex(headers, SITE_CONTEXT_HEADERS);
  const siteContextImageIndex = findHeaderIndex(headers, SITE_CONTEXT_IMAGE_HEADERS);
  const listingTitleIndex = findHeaderIndex(headers, LISTING_TITLE_HEADERS);
  const propertyTypeIndex = findHeaderIndex(headers, PROPERTY_TYPE_HEADERS);
  const sourceUrlIndex = findHeaderIndex(headers, SOURCE_URL_HEADERS);
  const forceRegenerateIndex = findHeaderIndex(headers, FORCE_REGENERATE_HEADERS);
  const existingLinkIndex = findHeaderIndex(headers, LINK_HEADERS);
  const existingErrorIndex = findHeaderIndex(headers, ERROR_HEADERS);

  if (addressIndex < 0 || buyerEmailIndex < 0) {
    throw new Error(
      "Sheet must include address and email columns. Supported address headers: `address` or `listing_address`; supported email headers: `buyer_email` or `email`.",
    );
  }

  const linkColumnIndex = existingLinkIndex >= 0 ? existingLinkIndex : headers.length;
  const errorColumnIndex = existingErrorIndex >= 0 ? existingErrorIndex : Math.max(headers.length, linkColumnIndex + 1);
  const headerUpdates: SheetCellUpdate[] = [];

  if (existingLinkIndex < 0) {
    headerUpdates.push({
      tabName,
      rowNumber: 1,
      columnIndex: linkColumnIndex,
      value: "link",
    });
  }

  if (existingErrorIndex < 0) {
    headerUpdates.push({
      tabName,
      rowNumber: 1,
      columnIndex: errorColumnIndex,
      value: "error",
    });
  }

  const rows: LiteSheetRow[] = [];
  let invalidRows = 0;
  let skippedRows = 0;

  for (let index = 1; index < values.length; index += 1) {
    const row = values[index] ?? [];
    const address = readCell(row, addressIndex);
    const buyerEmail = readCell(row, buyerEmailIndex);
    const buyerName = buyerNameIndex >= 0 ? readCell(row, buyerNameIndex) || null : null;
    const listingTitle = listingTitleIndex >= 0 ? readCell(row, listingTitleIndex) || null : null;
    const propertyType = propertyTypeIndex >= 0 ? readCell(row, propertyTypeIndex) || null : null;
    const sourceUrls = parseSourceUrls(sourceUrlIndex >= 0 ? readCell(row, sourceUrlIndex) || null : null);
    const sourceUrl = sourceUrls[0] ?? null;
    const siteContextHint = siteContextIndex >= 0 ? readCell(row, siteContextIndex) || null : null;
    const siteContextImageRefs = siteContextImageIndex >= 0 ? normalizeSiteContextImageRefs(readCell(row, siteContextImageIndex)) : [];
    const forceRegenerate = forceRegenerateIndex >= 0 ? parseBooleanCell(readCell(row, forceRegenerateIndex)) : false;
    const link = readCell(row, existingLinkIndex);
    const error = readCell(row, existingErrorIndex) || null;

    if (!address && !buyerEmail) {
      skippedRows += 1;
      continue;
    }

    if (!address || !buyerEmail) {
      invalidRows += 1;
      continue;
    }

    rows.push({
      rowNumber: index + 1,
      address,
      buyerEmail,
      buyerName,
      link,
      error,
      listingTitle,
      propertyType,
      sourceUrl,
      sourceUrls,
      siteContextHint,
      siteContextImageRefs,
      forceRegenerate,
    });
  }

  return {
    rows,
    invalidRows,
    skippedRows,
    linkColumnIndex,
    errorColumnIndex,
    headerUpdates,
  };
}

function createArchiveRow(args: {
  rowNumber: number;
  tenantId: string;
  token: string;
  link: string;
  adminLink: string;
  buyerEmail: string;
  buyerName: string | null;
  inputAddress: string;
  displayAddress: string;
  normalizedAddress: string;
  siteContextJson: string | null;
  siteContextGeneratedAt: Date | null;
  workbookCsv: string;
  previewRowCount: number;
  priceCents: number;
  currency: string;
  sourceTabName: string;
  sourceRowNumber: number;
  createdAt?: Date;
}): LiteArchiveRow {
  const createdAt = args.createdAt ?? new Date();

  return {
    rowNumber: args.rowNumber,
    tenantId: args.tenantId,
    token: args.token,
    link: args.link,
    status: "GENERATED",
    paid: false,
    buyerEmail: args.buyerEmail,
    buyerName: args.buyerName,
    inputAddress: args.inputAddress,
    displayAddress: args.displayAddress,
    normalizedAddress: args.normalizedAddress,
    siteContextJson: args.siteContextJson,
    siteContextGeneratedAt: args.siteContextGeneratedAt,
    adminLink: args.adminLink,
    workbookCsv: args.workbookCsv,
    previewRowCount: args.previewRowCount,
    priceCents: args.priceCents,
    currency: args.currency,
    stripeCheckoutSessionId: null,
    stripePaymentIntentId: null,
    purchaserEmail: null,
    purchaserName: null,
    amountPaidCents: null,
    sourceTabName: args.sourceTabName,
    sourceRowNumber: args.sourceRowNumber,
    openedAt: null,
    paidAt: null,
    error: null,
    createdAt,
    updatedAt: createdAt,
  };
}

function updateLookupMaps(
  row: LiteArchiveRow,
  lookups: ReturnType<typeof createArchiveLookupMaps>,
): void {
  lookups.byToken.set(row.token, row);
  if (row.tenantId && row.normalizedAddress && row.buyerEmail) {
    lookups.byBuyerKey.set(`${row.tenantId}::${row.normalizedAddress}::${row.buyerEmail}`, row);
  }
  if (row.tenantId && row.normalizedAddress) {
    lookups.byAddressKey.set(`${row.tenantId}::${row.normalizedAddress}`, row);
  }
}

export { getMockLiteSheetSnapshot, resetMockLiteSheetValues };

export async function processLiteSheet(args: {
  tenantId: string;
  request?: Request;
  maxRows?: number;
  rowNumbers?: number[];
}): Promise<LiteProcessSummary> {
  const adapter = await createLiteSheetAdapter();
  const config = getLiteConfig();
  const intakeValues = await adapter.readValues(adapter.tabs.intakeTabName);
  const archiveValues = await adapter.readValues(adapter.tabs.archiveTabName);
  const parsedIntake = parseIntakeSheetValues(intakeValues, adapter.tabs.intakeTabName);
  const archiveHeaderState = buildArchiveHeaderState(archiveValues, adapter.tabs.archiveTabName);
  const archiveTable = parseArchiveTable(archiveValues, adapter.tabs.archiveTabName);
  const lookups = createArchiveLookupMaps(archiveTable.rows);
  const requestedRowNumbers = args.rowNumbers ? new Set(args.rowNumbers) : null;
  const filteredRows = requestedRowNumbers
    ? parsedIntake.rows.filter((row) => requestedRowNumbers.has(row.rowNumber))
    : parsedIntake.rows;
  const candidates =
    typeof args.maxRows === "number" ? filteredRows.slice(0, Math.max(0, args.maxRows)) : filteredRows;

  let nextRowNumber = nextArchiveRowNumber(archiveValues);
  const updates = new Map<string, SheetCellUpdate>();

  for (const update of parsedIntake.headerUpdates) {
    queueUpdate(updates, update);
  }
  for (const update of archiveHeaderState.headerUpdates) {
    queueUpdate(updates, update);
  }
  for (const update of buildArchiveNormalizationUpdates(archiveValues, adapter.tabs.archiveTabName)) {
    queueUpdate(updates, update);
  }

  const summary: LiteProcessSummary = {
    processedRows: 0,
    updatedRows: 0,
    skippedRows: parsedIntake.skippedRows,
    invalidRows: parsedIntake.invalidRows,
    createdWorkbooks: 0,
    reusedWorkbooks: 0,
    createdLinks: 0,
    reusedLinks: 0,
    errors: [],
  };

  for (const row of candidates) {
    const inputAddress = presentLiteAddress(row.address);
    const normalizedAddress = normalizeLiteAddress(inputAddress);
    const buyerEmail = normalizeBuyerEmail(row.buyerEmail);
    const buyerName = row.buyerName?.trim() || null;
    const buyerKey = `${args.tenantId}::${normalizedAddress}::${buyerEmail}`;
    const addressKey = `${args.tenantId}::${normalizedAddress}`;

    try {
      const existingWorkbookSource = lookups.byAddressKey.get(addressKey);
      const shouldAutoCaptureSiteContext =
        config.autoSiteContextScreenshots &&
        !isMockAgenticFlowEnabled() &&
        !row.link &&
        !existingWorkbookSource?.siteContextJson;
      const shouldForceRefresh =
        row.forceRegenerate ||
        Boolean(row.siteContextHint || row.siteContextImageRefs.length) ||
        shouldAutoCaptureSiteContext;

      if (row.link && !shouldForceRefresh) {
        const token = extractLiteTokenFromUrl(row.link);
        if (!token) {
          throw new Error("Existing link does not contain a valid `/r/{token}` URL.");
        }
        const canonicalLink = buildLiteLinkUrl(token, args.request);
        const canonicalAdminLink = buildLiteAdminLinkUrl(token, args.request);

        const archived = lookups.byToken.get(token);
        if (archived) {
          if (row.link !== canonicalLink) {
            queueUpdate(updates, {
              tabName: adapter.tabs.intakeTabName,
              rowNumber: row.rowNumber,
              columnIndex: parsedIntake.linkColumnIndex,
              value: canonicalLink,
            });
            summary.updatedRows += 1;
          }

          if (archived.link !== canonicalLink || archived.adminLink !== canonicalAdminLink) {
            const updatedArchiveRow: LiteArchiveRow = {
              ...archived,
              link: canonicalLink,
              adminLink: canonicalAdminLink,
              updatedAt: new Date(),
            };
            updateLookupMaps(updatedArchiveRow, lookups);
            for (const update of buildArchiveRowUpdates(
              adapter.tabs.archiveTabName,
              updatedArchiveRow.rowNumber,
              archiveHeaderState.headerIndex,
              updatedArchiveRow,
            )) {
              queueUpdate(updates, update);
            }
          }

          summary.processedRows += 1;
          summary.reusedLinks += 1;
          summary.reusedWorkbooks += 1;
          if (row.error) {
            queueUpdate(updates, {
              tabName: adapter.tabs.intakeTabName,
              rowNumber: row.rowNumber,
              columnIndex: parsedIntake.errorColumnIndex,
              value: "",
            });
          }
          continue;
        }

        const workbookSource = lookups.byAddressKey.get(addressKey);
        const workbookCsv = workbookSource?.workbookCsv ?? "";
        const displayAddress = workbookSource?.displayAddress ?? inputAddress;
        const siteContextJson = workbookSource?.siteContextJson ?? null;
        const siteContextGeneratedAt = workbookSource?.siteContextGeneratedAt ?? null;

        if (workbookCsv) {
          summary.reusedWorkbooks += 1;
        }

        const archivedRow = createArchiveRow({
          rowNumber: nextRowNumber,
          tenantId: args.tenantId,
          token,
          link: canonicalLink,
          adminLink: canonicalAdminLink,
          buyerEmail,
          buyerName,
          inputAddress,
          displayAddress,
          normalizedAddress,
          siteContextJson,
          siteContextGeneratedAt,
          workbookCsv,
          previewRowCount: config.previewRowCount,
          priceCents: config.priceCents,
          currency: config.currency,
          sourceTabName: adapter.tabs.intakeTabName,
          sourceRowNumber: row.rowNumber,
        });

        nextRowNumber += 1;
        updateLookupMaps(archivedRow, lookups);
        archiveTable.rows.push(archivedRow);

        for (const update of buildArchiveRowUpdates(
          adapter.tabs.archiveTabName,
          archivedRow.rowNumber,
          archiveHeaderState.headerIndex,
          archivedRow,
        )) {
          queueUpdate(updates, update);
        }

        if (row.error) {
          queueUpdate(updates, {
            tabName: adapter.tabs.intakeTabName,
            rowNumber: row.rowNumber,
            columnIndex: parsedIntake.errorColumnIndex,
            value: "",
          });
        }

        if (row.link !== canonicalLink) {
          queueUpdate(updates, {
            tabName: adapter.tabs.intakeTabName,
            rowNumber: row.rowNumber,
            columnIndex: parsedIntake.linkColumnIndex,
            value: canonicalLink,
          });
          summary.updatedRows += 1;
        }

        summary.processedRows += 1;
        summary.reusedLinks += 1;
        continue;
      }

      const existingBuyerRow = shouldForceRefresh ? null : lookups.byBuyerKey.get(buyerKey);
      if (existingBuyerRow) {
        queueUpdate(updates, {
          tabName: adapter.tabs.intakeTabName,
          rowNumber: row.rowNumber,
          columnIndex: parsedIntake.linkColumnIndex,
          value: existingBuyerRow.link,
        });
        queueUpdate(updates, {
          tabName: adapter.tabs.intakeTabName,
          rowNumber: row.rowNumber,
          columnIndex: parsedIntake.errorColumnIndex,
          value: "",
        });

        summary.processedRows += 1;
        summary.updatedRows += 1;
        summary.reusedWorkbooks += 1;
        summary.reusedLinks += 1;
        continue;
      }

      let workbookSource = existingWorkbookSource;
      let workbookCsv = shouldForceRefresh ? "" : workbookSource?.workbookCsv ?? "";
      let displayAddress = workbookSource?.displayAddress ?? inputAddress;
      let siteContextHint = row.siteContextHint;
      let siteContextImageRefs = row.siteContextImageRefs;

      const shouldCaptureSiteContext = config.autoSiteContextScreenshots && (shouldForceRefresh || !workbookCsv);
      if (shouldCaptureSiteContext) {
        const captured = await captureLiteSiteContextScreenshots({
          inputAddress,
          listingTitle: row.listingTitle,
          propertyType: row.propertyType,
          sourceUrl: row.sourceUrl,
          sourceUrls: row.sourceUrls,
          screenshotDir: config.siteContextScreenshotDir,
        });

        if (captured.imageRefs.length || captured.hint) {
          siteContextImageRefs = [...siteContextImageRefs, ...captured.imageRefs];
          siteContextHint = [siteContextHint, captured.hint].filter(Boolean).join("\n\n") || null;
        }
      }

      const generatedSiteContextJson =
        siteContextHint || siteContextImageRefs.length
          ? await generateLiteSiteContext({
              inputAddress,
              siteContextHint,
              siteContextImageRefs,
            })
          : null;
      const siteContextJson = generatedSiteContextJson ?? workbookSource?.siteContextJson ?? null;
      const siteContextGeneratedAt = generatedSiteContextJson ? new Date() : workbookSource?.siteContextGeneratedAt ?? null;

      if (!workbookCsv) {
        const generated = await generateLiteWorkbookFromAddress(inputAddress, {
          siteContextJson,
        });
        workbookCsv = generated.csv;
        displayAddress = generated.displayAddress;
        assertWorkbookCsvFits(workbookCsv);
        summary.createdWorkbooks += 1;
      } else {
        summary.reusedWorkbooks += 1;
      }

      const token = createLiteToken();
      const link = buildLiteLinkUrl(token, args.request);
      const adminLink = buildLiteAdminLinkUrl(token, args.request);
      const archivedRow = createArchiveRow({
        rowNumber: nextRowNumber,
        tenantId: args.tenantId,
        token,
        link,
        adminLink,
        buyerEmail,
        buyerName,
        inputAddress,
        displayAddress,
        normalizedAddress,
        siteContextJson,
        siteContextGeneratedAt,
        workbookCsv,
        previewRowCount: config.previewRowCount,
        priceCents: config.priceCents,
        currency: config.currency,
        sourceTabName: adapter.tabs.intakeTabName,
        sourceRowNumber: row.rowNumber,
      });

      nextRowNumber += 1;
      updateLookupMaps(archivedRow, lookups);
      archiveTable.rows.push(archivedRow);

      for (const update of buildArchiveRowUpdates(
        adapter.tabs.archiveTabName,
        archivedRow.rowNumber,
        archiveHeaderState.headerIndex,
        archivedRow,
      )) {
        queueUpdate(updates, update);
      }

      queueUpdate(updates, {
        tabName: adapter.tabs.intakeTabName,
        rowNumber: row.rowNumber,
        columnIndex: parsedIntake.linkColumnIndex,
        value: link,
      });
      queueUpdate(updates, {
        tabName: adapter.tabs.intakeTabName,
        rowNumber: row.rowNumber,
        columnIndex: parsedIntake.errorColumnIndex,
        value: "",
      });

      summary.processedRows += 1;
      summary.updatedRows += 1;
      summary.createdLinks += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown sheet processing error.";
      queueUpdate(updates, {
        tabName: adapter.tabs.intakeTabName,
        rowNumber: row.rowNumber,
        columnIndex: parsedIntake.errorColumnIndex,
        value: message,
      });
      summary.errors.push({
        rowNumber: row.rowNumber,
        message,
      });
    }
  }

  await adapter.writeValues(Array.from(updates.values()));
  return summary;
}
