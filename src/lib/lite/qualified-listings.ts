import {
  QUALIFIED_LISTING_REVIEW_HEADERS,
  buildQualifiedListingReviewHeaderState,
  buildQualifiedListingReviewRowUpdates,
} from "@/lib/lite/automation-sheet";
import type { SheetCellUpdate } from "@/lib/lite/google-sheet";
import type {
  DiscoveryStatus,
  DiscoveredListingRow,
  QualifiedListingReviewRow,
  QualifiedListingReviewStatus,
} from "@/lib/lite/types";

const INCLUDED_DISCOVERY_STATUSES = new Set<DiscoveryStatus>(["QUALIFIED", "PROMOTED", "PROCESSED", "FAILED"]);

const REVIEW_STATUS_PRIORITY: Record<QualifiedListingReviewStatus, number> = {
  PROCESSED: 0,
  PROMOTED: 1,
  FAILED: 2,
  QUALIFIED: 3,
};

type ReviewAccumulator = {
  lastSeenAt: Date | null;
  zip: string;
  propertyType: string;
  listingAddress: string;
  listingTitle: string;
  statuses: Set<DiscoveryStatus>;
  brokers: Map<string, string>;
  paywallLinks: Map<string, string>;
  adminLinks: Map<string, string>;
  sourceUrls: Set<string>;
  notes: Set<string>;
};

function getReviewGroupKey(row: DiscoveredListingRow): string {
  return `${row.normalizedAddress || row.listingAddress}`.trim().toLowerCase() + `::${row.propertyType.trim().toLowerCase()}`;
}

function formatBrokerLabel(row: DiscoveredListingRow): string | null {
  if (row.brokerName && row.brokerEmail) {
    return `${row.brokerName} <${row.brokerEmail}>`;
  }

  if (row.brokerEmail) {
    return row.brokerEmail;
  }

  if (row.brokerName) {
    return row.brokerName;
  }

  return null;
}

function formatLinkLabel(identifier: string, url: string): string {
  return `${identifier} | ${url}`;
}

function selectReviewStatus(statuses: Set<DiscoveryStatus>): QualifiedListingReviewStatus {
  if (statuses.has("PROCESSED")) return "PROCESSED";
  if (statuses.has("PROMOTED")) return "PROMOTED";
  if (statuses.has("FAILED")) return "FAILED";
  return "QUALIFIED";
}

function sortLines(values: Iterable<string>): string {
  return Array.from(values)
    .sort((left, right) => left.localeCompare(right))
    .join("\n");
}

export function buildQualifiedListingReviewRows(discoveredRows: DiscoveredListingRow[]): QualifiedListingReviewRow[] {
  const grouped = new Map<string, ReviewAccumulator>();

  for (const row of discoveredRows) {
    if (!INCLUDED_DISCOVERY_STATUSES.has(row.discoveryStatus)) {
      continue;
    }

    const key = getReviewGroupKey(row);
    const existing = grouped.get(key);
    const accumulator: ReviewAccumulator =
      existing ??
      ({
        lastSeenAt: row.discoveredAt,
        zip: row.zip,
        propertyType: row.propertyType,
        listingAddress: row.listingAddress,
        listingTitle: row.listingTitle,
        statuses: new Set<DiscoveryStatus>(),
        brokers: new Map<string, string>(),
        paywallLinks: new Map<string, string>(),
        adminLinks: new Map<string, string>(),
        sourceUrls: new Set<string>(),
        notes: new Set<string>(),
      } satisfies ReviewAccumulator);

    accumulator.statuses.add(row.discoveryStatus);
    accumulator.sourceUrls.add(row.sourceUrl);

    if (!accumulator.lastSeenAt || (row.discoveredAt && row.discoveredAt.getTime() >= accumulator.lastSeenAt.getTime())) {
      accumulator.lastSeenAt = row.discoveredAt;
      accumulator.zip = row.zip || accumulator.zip;
      accumulator.propertyType = row.propertyType || accumulator.propertyType;
      accumulator.listingAddress = row.listingAddress || accumulator.listingAddress;
      accumulator.listingTitle = row.listingTitle || accumulator.listingTitle;
    }

    const brokerLabel = formatBrokerLabel(row);
    if (brokerLabel) {
      const brokerKey = (row.brokerEmail || brokerLabel).trim().toLowerCase();
      accumulator.brokers.set(brokerKey, brokerLabel);
    }

    if (row.paywallLink) {
      const linkIdentifier = row.brokerEmail || row.token || row.paywallLink;
      accumulator.paywallLinks.set(linkIdentifier.toLowerCase(), formatLinkLabel(linkIdentifier, row.paywallLink));
    }

    if (row.adminLink) {
      const linkIdentifier = row.brokerEmail || row.token || row.adminLink;
      accumulator.adminLinks.set(linkIdentifier.toLowerCase(), formatLinkLabel(linkIdentifier, row.adminLink));
    }

    if (row.error) {
      accumulator.notes.add(row.error);
    }

    grouped.set(key, accumulator);
  }

  return Array.from(grouped.values())
    .map((entry, index) => ({
      rowNumber: index + 2,
      lastSeenAt: entry.lastSeenAt,
      zip: entry.zip,
      propertyType: entry.propertyType,
      listingAddress: entry.listingAddress,
      listingTitle: entry.listingTitle,
      status: selectReviewStatus(entry.statuses),
      brokers: sortLines(entry.brokers.values()),
      paywallLinks: sortLines(entry.paywallLinks.values()),
      adminLinks: sortLines(entry.adminLinks.values()),
      sourceUrls: sortLines(entry.sourceUrls),
      notes: entry.notes.size ? sortLines(entry.notes) : null,
    }))
    .sort((left, right) => {
      const statusDiff = REVIEW_STATUS_PRIORITY[left.status] - REVIEW_STATUS_PRIORITY[right.status];
      if (statusDiff !== 0) {
        return statusDiff;
      }

      const rightSeen = right.lastSeenAt?.getTime() ?? 0;
      const leftSeen = left.lastSeenAt?.getTime() ?? 0;
      if (rightSeen !== leftSeen) {
        return rightSeen - leftSeen;
      }

      return left.listingAddress.localeCompare(right.listingAddress);
    })
    .map((row, index) => ({
      ...row,
      rowNumber: index + 2,
    }));
}

export function buildQualifiedListingReviewSyncUpdates(args: {
  existingValues: string[][];
  tabName: string;
  discoveredRows: DiscoveredListingRow[];
}): SheetCellUpdate[] {
  const { headerIndex, headerUpdates } = buildQualifiedListingReviewHeaderState(args.existingValues, args.tabName);
  const reviewRows = buildQualifiedListingReviewRows(args.discoveredRows);
  const updates: SheetCellUpdate[] = [...headerUpdates];

  for (const row of reviewRows) {
    updates.push(...buildQualifiedListingReviewRowUpdates(args.tabName, row.rowNumber, headerIndex, row));
  }

  const existingRowCount = Math.max(0, args.existingValues.length - 1);
  for (let rowNumber = reviewRows.length + 2; rowNumber <= existingRowCount + 1; rowNumber += 1) {
    for (const header of QUALIFIED_LISTING_REVIEW_HEADERS) {
      updates.push({
        tabName: args.tabName,
        rowNumber,
        columnIndex: headerIndex.get(header) ?? 0,
        value: "",
      });
    }
  }

  return updates;
}
