import type { SheetCellUpdate } from "@/lib/lite/google-sheet";
import type {
  AutomationRunRow,
  BrokerOutreachApprovalStatus,
  BrokerOutreachQueueRow,
  BrokerOutreachSendStatus,
  DiscoveryStatus,
  DiscoveredListingRow,
  QualifiedListingReviewRow,
  ZipTargetRow,
  ZipTargetStatus,
} from "@/lib/lite/types";

export const ZIP_TARGET_HEADERS = [
  "zip",
  "active",
  "sequence",
  "status",
  "property_types",
  "daily_limit",
  "last_run_at",
  "last_qualified_count",
  "completed_at",
  "notes",
] as const;

export const DISCOVERED_LISTING_HEADERS = [
  "discovered_at",
  "zip",
  "property_type",
  "listing_title",
  "listing_address",
  "normalized_address",
  "broker_name",
  "broker_email",
  "broker_email_source_type",
  "broker_email_source_url",
  "source_url",
  "source_domain",
  "discovery_status",
  "skip_reason",
  "promoted_at",
  "intake_row_number",
  "token",
  "paywall_link",
  "admin_link",
  "error",
] as const;

export const QUALIFIED_LISTING_REVIEW_HEADERS = [
  "last_seen_at",
  "zip",
  "property_type",
  "listing_address",
  "listing_title",
  "status",
  "brokers",
  "paywall_links",
  "admin_links",
  "source_urls",
  "notes",
] as const;

export const BROKER_OUTREACH_QUEUE_HEADERS = [
  "created_at",
  "listing_address",
  "broker_name",
  "broker_email",
  "source_url",
  "token",
  "paywall_link",
  "admin_link",
  "subject",
  "body",
  "approval_status",
  "send_status",
  "gmail_message_id",
  "sent_at",
  "error",
] as const;

export const AUTOMATION_RUN_HEADERS = [
  "run_started_at",
  "run_finished_at",
  "zip",
  "candidate_count",
  "qualified_count",
  "promoted_count",
  "processed_count",
  "draft_count",
  "error_count",
  "status",
  "notes",
] as const;

export type ZipTargetHeader = (typeof ZIP_TARGET_HEADERS)[number];
export type DiscoveredListingHeader = (typeof DISCOVERED_LISTING_HEADERS)[number];
export type QualifiedListingReviewHeader = (typeof QUALIFIED_LISTING_REVIEW_HEADERS)[number];
export type BrokerOutreachQueueHeader = (typeof BROKER_OUTREACH_QUEUE_HEADERS)[number];
export type AutomationRunHeader = (typeof AUTOMATION_RUN_HEADERS)[number];

function normalizeHeader(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function readCell(row: string[] | undefined, index: number | undefined): string {
  if (!row || index == null || index < 0) return "";
  return (row[index] ?? "").trim();
}

function parseBoolean(value: string): boolean {
  return ["true", "1", "yes", "y"].includes(value.trim().toLowerCase());
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

function stringifyDate(value: Date | null): string {
  return value ? value.toISOString() : "";
}

function stringifyNullable(value: string | number | null | undefined): string {
  if (value == null) return "";
  return String(value);
}

function buildHeaderState<THeader extends string>(
  values: string[][],
  tabName: string,
  expectedHeaders: readonly THeader[],
): {
  headerIndex: Map<THeader, number>;
  headerUpdates: SheetCellUpdate[];
} {
  const headers = (values[0] ?? []).map((value) => normalizeHeader(value));
  const nextHeaders = [...headers];
  const headerUpdates: SheetCellUpdate[] = [];

  for (const header of expectedHeaders) {
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
    headerIndex: new Map(nextHeaders.map((header, index) => [header as THeader, index])),
    headerUpdates,
  };
}

export function buildZipTargetHeaderState(values: string[][], tabName: string) {
  return buildHeaderState(values, tabName, ZIP_TARGET_HEADERS);
}

export function buildDiscoveredListingHeaderState(values: string[][], tabName: string) {
  return buildHeaderState(values, tabName, DISCOVERED_LISTING_HEADERS);
}

export function buildQualifiedListingReviewHeaderState(values: string[][], tabName: string) {
  return buildHeaderState(values, tabName, QUALIFIED_LISTING_REVIEW_HEADERS);
}

export function buildBrokerOutreachQueueHeaderState(values: string[][], tabName: string) {
  return buildHeaderState(values, tabName, BROKER_OUTREACH_QUEUE_HEADERS);
}

export function buildAutomationRunHeaderState(values: string[][], tabName: string) {
  return buildHeaderState(values, tabName, AUTOMATION_RUN_HEADERS);
}

export function parseZipTargetsTable(values: string[][], tabName: string) {
  const { headerIndex } = buildZipTargetHeaderState(values, tabName);
  const rows: ZipTargetRow[] = [];

  for (let index = 1; index < values.length; index += 1) {
    const row = values[index] ?? [];
    const zip = readCell(row, headerIndex.get("zip"));
    if (!zip) continue;
    const statusValue = readCell(row, headerIndex.get("status")) || "PENDING";
    rows.push({
      rowNumber: index + 1,
      zip,
      active: parseBoolean(readCell(row, headerIndex.get("active")) || "true"),
      sequence: parseInteger(readCell(row, headerIndex.get("sequence")), index + 1),
      status: statusValue as ZipTargetStatus,
      propertyTypes: readCell(row, headerIndex.get("property_types"))
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
      dailyLimit: parseInteger(readCell(row, headerIndex.get("daily_limit")), 25),
      lastRunAt: parseDate(readCell(row, headerIndex.get("last_run_at"))),
      lastQualifiedCount: parseNullableInteger(readCell(row, headerIndex.get("last_qualified_count"))),
      completedAt: parseDate(readCell(row, headerIndex.get("completed_at"))),
      notes: readCell(row, headerIndex.get("notes")) || null,
    });
  }

  return { tabName, values, headerIndex, rows };
}

export function parseDiscoveredListingsTable(values: string[][], tabName: string) {
  const { headerIndex } = buildDiscoveredListingHeaderState(values, tabName);
  const rows: DiscoveredListingRow[] = [];

  for (let index = 1; index < values.length; index += 1) {
    const row = values[index] ?? [];
    const sourceUrl = readCell(row, headerIndex.get("source_url"));
    const normalizedAddress = readCell(row, headerIndex.get("normalized_address"));
    if (!sourceUrl && !normalizedAddress) continue;

    rows.push({
      rowNumber: index + 1,
      discoveredAt: parseDate(readCell(row, headerIndex.get("discovered_at"))),
      zip: readCell(row, headerIndex.get("zip")),
      propertyType: readCell(row, headerIndex.get("property_type")),
      listingTitle: readCell(row, headerIndex.get("listing_title")),
      listingAddress: readCell(row, headerIndex.get("listing_address")),
      normalizedAddress,
      brokerName: readCell(row, headerIndex.get("broker_name")) || null,
      brokerEmail: readCell(row, headerIndex.get("broker_email")) || null,
      brokerEmailSourceType:
        (readCell(row, headerIndex.get("broker_email_source_type")) || "unknown") as DiscoveredListingRow["brokerEmailSourceType"],
      brokerEmailSourceUrl: readCell(row, headerIndex.get("broker_email_source_url")) || null,
      sourceUrl,
      sourceDomain: readCell(row, headerIndex.get("source_domain")),
      discoveryStatus: (readCell(row, headerIndex.get("discovery_status")) || "FAILED") as DiscoveryStatus,
      skipReason: readCell(row, headerIndex.get("skip_reason")) || null,
      promotedAt: parseDate(readCell(row, headerIndex.get("promoted_at"))),
      intakeRowNumber: parseNullableInteger(readCell(row, headerIndex.get("intake_row_number"))),
      token: readCell(row, headerIndex.get("token")) || null,
      paywallLink: readCell(row, headerIndex.get("paywall_link")) || null,
      adminLink: readCell(row, headerIndex.get("admin_link")) || null,
      error: readCell(row, headerIndex.get("error")) || null,
    });
  }

  return { tabName, values, headerIndex, rows };
}

export function parseBrokerOutreachQueueTable(values: string[][], tabName: string) {
  const { headerIndex } = buildBrokerOutreachQueueHeaderState(values, tabName);
  const rows: BrokerOutreachQueueRow[] = [];

  for (let index = 1; index < values.length; index += 1) {
    const row = values[index] ?? [];
    const token = readCell(row, headerIndex.get("token"));
    if (!token) continue;

    rows.push({
      rowNumber: index + 1,
      createdAt: parseDate(readCell(row, headerIndex.get("created_at"))),
      listingAddress: readCell(row, headerIndex.get("listing_address")),
      brokerName: readCell(row, headerIndex.get("broker_name")) || null,
      brokerEmail: readCell(row, headerIndex.get("broker_email")),
      sourceUrl: readCell(row, headerIndex.get("source_url")) || null,
      token,
      paywallLink: readCell(row, headerIndex.get("paywall_link")),
      adminLink: readCell(row, headerIndex.get("admin_link")),
      subject: readCell(row, headerIndex.get("subject")),
      body: readCell(row, headerIndex.get("body")),
      approvalStatus: (readCell(row, headerIndex.get("approval_status")) || "DRAFT") as BrokerOutreachApprovalStatus,
      sendStatus: (readCell(row, headerIndex.get("send_status")) || "UNSENT") as BrokerOutreachSendStatus,
      gmailMessageId: readCell(row, headerIndex.get("gmail_message_id")) || null,
      sentAt: parseDate(readCell(row, headerIndex.get("sent_at"))),
      error: readCell(row, headerIndex.get("error")) || null,
    });
  }

  return { tabName, values, headerIndex, rows };
}

export function buildZipTargetRowUpdates(
  tabName: string,
  rowNumber: number,
  headerIndex: Map<ZipTargetHeader, number>,
  row: ZipTargetRow,
): SheetCellUpdate[] {
  const payload: Record<ZipTargetHeader, string> = {
    zip: row.zip,
    active: row.active ? "true" : "false",
    sequence: stringifyNullable(row.sequence),
    status: row.status,
    property_types: row.propertyTypes.join(", "),
    daily_limit: stringifyNullable(row.dailyLimit),
    last_run_at: stringifyDate(row.lastRunAt),
    last_qualified_count: stringifyNullable(row.lastQualifiedCount),
    completed_at: stringifyDate(row.completedAt),
    notes: stringifyNullable(row.notes),
  };

  return ZIP_TARGET_HEADERS.map((header) => ({
    tabName,
    rowNumber,
    columnIndex: headerIndex.get(header) ?? 0,
    value: payload[header],
  }));
}

export function buildDiscoveredListingRowUpdates(
  tabName: string,
  rowNumber: number,
  headerIndex: Map<DiscoveredListingHeader, number>,
  row: DiscoveredListingRow,
): SheetCellUpdate[] {
  const payload: Record<DiscoveredListingHeader, string> = {
    discovered_at: stringifyDate(row.discoveredAt),
    zip: row.zip,
    property_type: row.propertyType,
    listing_title: row.listingTitle,
    listing_address: row.listingAddress,
    normalized_address: row.normalizedAddress,
    broker_name: stringifyNullable(row.brokerName),
    broker_email: stringifyNullable(row.brokerEmail),
    broker_email_source_type: stringifyNullable(row.brokerEmailSourceType),
    broker_email_source_url: stringifyNullable(row.brokerEmailSourceUrl),
    source_url: row.sourceUrl,
    source_domain: row.sourceDomain,
    discovery_status: row.discoveryStatus,
    skip_reason: stringifyNullable(row.skipReason),
    promoted_at: stringifyDate(row.promotedAt),
    intake_row_number: stringifyNullable(row.intakeRowNumber),
    token: stringifyNullable(row.token),
    paywall_link: stringifyNullable(row.paywallLink),
    admin_link: stringifyNullable(row.adminLink),
    error: stringifyNullable(row.error),
  };

  return DISCOVERED_LISTING_HEADERS.map((header) => ({
    tabName,
    rowNumber,
    columnIndex: headerIndex.get(header) ?? 0,
    value: payload[header],
  }));
}

export function buildBrokerOutreachQueueRowUpdates(
  tabName: string,
  rowNumber: number,
  headerIndex: Map<BrokerOutreachQueueHeader, number>,
  row: BrokerOutreachQueueRow,
): SheetCellUpdate[] {
  const payload: Record<BrokerOutreachQueueHeader, string> = {
    created_at: stringifyDate(row.createdAt),
    listing_address: row.listingAddress,
    broker_name: stringifyNullable(row.brokerName),
    broker_email: row.brokerEmail,
    source_url: stringifyNullable(row.sourceUrl),
    token: row.token,
    paywall_link: row.paywallLink,
    admin_link: row.adminLink,
    subject: row.subject,
    body: row.body,
    approval_status: row.approvalStatus,
    send_status: row.sendStatus,
    gmail_message_id: stringifyNullable(row.gmailMessageId),
    sent_at: stringifyDate(row.sentAt),
    error: stringifyNullable(row.error),
  };

  return BROKER_OUTREACH_QUEUE_HEADERS.map((header) => ({
    tabName,
    rowNumber,
    columnIndex: headerIndex.get(header) ?? 0,
    value: payload[header],
  }));
}

export function buildQualifiedListingReviewRowUpdates(
  tabName: string,
  rowNumber: number,
  headerIndex: Map<QualifiedListingReviewHeader, number>,
  row: QualifiedListingReviewRow,
): SheetCellUpdate[] {
  const payload: Record<QualifiedListingReviewHeader, string> = {
    last_seen_at: stringifyDate(row.lastSeenAt),
    zip: row.zip,
    property_type: row.propertyType,
    listing_address: row.listingAddress,
    listing_title: row.listingTitle,
    status: row.status,
    brokers: row.brokers,
    paywall_links: row.paywallLinks,
    admin_links: row.adminLinks,
    source_urls: row.sourceUrls,
    notes: stringifyNullable(row.notes),
  };

  return QUALIFIED_LISTING_REVIEW_HEADERS.map((header) => ({
    tabName,
    rowNumber,
    columnIndex: headerIndex.get(header) ?? 0,
    value: payload[header],
  }));
}

export function buildAutomationRunRowUpdates(
  tabName: string,
  rowNumber: number,
  headerIndex: Map<AutomationRunHeader, number>,
  row: AutomationRunRow,
): SheetCellUpdate[] {
  const payload: Record<AutomationRunHeader, string> = {
    run_started_at: stringifyDate(row.runStartedAt),
    run_finished_at: stringifyDate(row.runFinishedAt),
    zip: row.zip,
    candidate_count: stringifyNullable(row.candidateCount),
    qualified_count: stringifyNullable(row.qualifiedCount),
    promoted_count: stringifyNullable(row.promotedCount),
    processed_count: stringifyNullable(row.processedCount),
    draft_count: stringifyNullable(row.draftCount),
    error_count: stringifyNullable(row.errorCount),
    status: row.status,
    notes: stringifyNullable(row.notes),
  };

  return AUTOMATION_RUN_HEADERS.map((header) => ({
    tabName,
    rowNumber,
    columnIndex: headerIndex.get(header) ?? 0,
    value: payload[header],
  }));
}
