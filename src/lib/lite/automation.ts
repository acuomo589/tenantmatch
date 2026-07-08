import {
  buildAutomationRunHeaderState,
  buildAutomationRunRowUpdates,
  buildBrokerOutreachQueueHeaderState,
  buildBrokerOutreachQueueRowUpdates,
  buildDiscoveredListingHeaderState,
  buildDiscoveredListingRowUpdates,
  buildZipTargetHeaderState,
  buildZipTargetRowUpdates,
  parseBrokerOutreachQueueTable,
  parseDiscoveredListingsTable,
  parseZipTargetsTable,
} from "@/lib/lite/automation-sheet";
import { extractLiteTokenFromUrl, parseArchiveTable } from "@/lib/lite/archive-sheet";
import { normalizeBuyerEmail, normalizeLiteAddress } from "@/lib/lite/address";
import {
  buildLiteBrokerOutreachFallbackDraft,
  generateLiteBrokerOutreachDraft,
} from "@/lib/lite/broker-outreach";
import { getLiteConfig } from "@/lib/lite/config";
import { createLiteSheetAdapter, type SheetCellUpdate } from "@/lib/lite/google-sheet";
import {
  buildIntakeHeaderState,
  buildIntakeRowUpdates,
  nextSheetRowNumber,
  readIntakeRowSnapshot,
  type LiteIntakeEntry,
} from "@/lib/lite/intake-sheet";
import { buildQualifiedListingReviewSyncUpdates } from "@/lib/lite/qualified-listings";
import { processLiteSheet } from "@/lib/lite/sheets";
import type {
  AutomationRunRow,
  BrokerOutreachQueueRow,
  DiscoveredListingRow,
  LiteDiscoveryRunSummary,
  LiteValidatedDiscovery,
  LiteVerifiedBrokerContact,
  ZipTargetRow,
} from "@/lib/lite/types";
import { buildLiteAdminLinkUrl } from "@/lib/lite/url";
import {
  discoverLiteZipCandidates,
  getOrderedTrustedLiteBrokerContacts,
  hasTrustedLiteBrokerEmail,
  rankLiteDiscoveryCandidates,
  validateLiteDiscoveredCandidate,
} from "@/lib/lite/discovery";

const LAUNCH_PROPERTY_TYPES = ["Retail", "Industrial"] as const;

function queueUpdate(updates: Map<string, SheetCellUpdate>, update: SheetCellUpdate): void {
  updates.set(`${update.tabName}:${update.rowNumber}:${update.columnIndex}`, update);
}

function replaceDiscoveredListingRow(rows: DiscoveredListingRow[], nextRow: DiscoveredListingRow): void {
  const rowIndex = rows.findIndex((row) => row.rowNumber === nextRow.rowNumber);
  if (rowIndex >= 0) {
    rows[rowIndex] = nextRow;
  }
}

function getSourceDomainKey(row: { normalizedAddress: string; sourceDomain: string }): string {
  return `${row.normalizedAddress}::${row.sourceDomain}`.toLowerCase();
}

function getDiscoveryBuyerKey(normalizedAddress: string, brokerEmail: string): string {
  return `${normalizedAddress}::${normalizeBuyerEmail(brokerEmail)}`.toLowerCase();
}

function getDiscoverySourceBuyerKey(args: {
  normalizedAddress: string;
  sourceUrl: string;
  brokerEmail: string;
}): string {
  return `${args.normalizedAddress}::${args.sourceUrl}::${normalizeBuyerEmail(args.brokerEmail)}`.toLowerCase();
}

function getDiscoveryDomainBuyerKey(args: {
  normalizedAddress: string;
  sourceDomain: string;
  brokerEmail: string;
}): string {
  return `${args.normalizedAddress}::${args.sourceDomain}::${normalizeBuyerEmail(args.brokerEmail)}`.toLowerCase();
}

function createDiscoveredListingRow(args: {
  rowNumber: number;
  zip: string;
  candidate: LiteValidatedDiscovery;
  contact?: LiteVerifiedBrokerContact | null;
  status: DiscoveredListingRow["discoveryStatus"];
  skipReason?: string | null;
  error?: string | null;
}): DiscoveredListingRow {
  const brokerName = args.contact?.name ?? args.candidate.brokerName;
  const brokerEmail = args.contact?.email ?? args.candidate.brokerEmail;
  const brokerEmailSourceType = args.contact?.emailSourceType ?? args.candidate.brokerEmailSourceType;
  const brokerEmailSourceUrl = args.contact?.emailSourceUrl ?? args.candidate.brokerEmailSourceUrl;

  return {
    rowNumber: args.rowNumber,
    discoveredAt: new Date(),
    zip: args.zip,
    propertyType: args.candidate.propertyType,
    listingTitle: args.candidate.listingTitle,
    listingAddress: args.candidate.listingAddress,
    normalizedAddress: args.candidate.normalizedAddress,
    brokerName,
    brokerEmail,
    brokerEmailSourceType,
    brokerEmailSourceUrl,
    sourceUrl: args.candidate.sourceUrl,
    sourceDomain: args.candidate.sourceDomain,
    discoveryStatus: args.status,
    skipReason: args.skipReason ?? null,
    promotedAt: null,
    intakeRowNumber: null,
    token: null,
    paywallLink: null,
    adminLink: null,
    error: args.error ?? null,
  };
}

function selectZipTarget(rows: ZipTargetRow[]): {
  selected: ZipTargetRow | null;
  resetRows: ZipTargetRow[];
} {
  const activeRows = rows.filter((row) => row.active).sort((left, right) => left.sequence - right.sequence);
  const inProgress = activeRows.find((row) => row.status === "IN_PROGRESS");
  if (inProgress) {
    return { selected: inProgress, resetRows: [] };
  }

  const pending = activeRows.find((row) => row.status === "PENDING");
  if (pending) {
    return { selected: pending, resetRows: [] };
  }

  const resetRows = activeRows
    .filter((row) => row.status === "DONE")
    .map((row) => ({
      ...row,
      status: "PENDING" as const,
      completedAt: null,
    }));

  return {
    selected: resetRows[0] ?? null,
    resetRows,
  };
}

function existingDiscoveryKeys(rows: DiscoveredListingRow[]) {
  return {
    bySourceBuyer: new Set(
      rows
        .filter((row) => row.discoveryStatus !== "FAILED" && row.brokerEmail)
        .map((row) => getDiscoverySourceBuyerKey({
          normalizedAddress: row.normalizedAddress,
          sourceUrl: row.sourceUrl,
          brokerEmail: row.brokerEmail || "",
        })),
    ),
    byDomainBuyer: new Set(
      rows
        .filter((row) => row.discoveryStatus !== "FAILED" && row.brokerEmail)
        .map((row) => getDiscoveryDomainBuyerKey({
          normalizedAddress: row.normalizedAddress,
          sourceDomain: row.sourceDomain,
          brokerEmail: row.brokerEmail || "",
        })),
    ),
    qualifiedBacklog: rows.filter((row) => row.discoveryStatus === "QUALIFIED" && !row.intakeRowNumber),
    promotedBacklog: rows.filter(
      (row) =>
        row.discoveryStatus === "PROMOTED" &&
        row.intakeRowNumber != null &&
        (!row.token || !row.paywallLink || !row.adminLink),
    ),
  };
}

function isDuplicateDiscovery(args: {
  candidate: LiteValidatedDiscovery;
  contact: LiteVerifiedBrokerContact;
  seenSourceBuyer: Set<string>;
  seenDomainBuyer: Set<string>;
  existingBuyerKeys: Set<string>;
}): boolean {
  const sourceBuyerKey = getDiscoverySourceBuyerKey({
    normalizedAddress: args.candidate.normalizedAddress,
    sourceUrl: args.candidate.sourceUrl,
    brokerEmail: args.contact.email,
  });
  const domainBuyerKey = getDiscoveryDomainBuyerKey({
    normalizedAddress: args.candidate.normalizedAddress,
    sourceDomain: args.candidate.sourceDomain,
    brokerEmail: args.contact.email,
  });
  const buyerKey = getDiscoveryBuyerKey(args.candidate.normalizedAddress, args.contact.email);

  return (
    args.seenSourceBuyer.has(sourceBuyerKey) ||
    args.seenDomainBuyer.has(domainBuyerKey) ||
    args.existingBuyerKeys.has(buyerKey)
  );
}

function createAutomationRunRow(args: {
  rowNumber: number;
  zip: string;
  summary: LiteDiscoveryRunSummary;
  status: string;
}): AutomationRunRow {
  return {
    rowNumber: args.rowNumber,
    runStartedAt: new Date(),
    runFinishedAt: new Date(),
    zip: args.zip,
    candidateCount: args.summary.candidateCount,
    qualifiedCount: args.summary.qualifiedCount,
    promotedCount: args.summary.promotedCount,
    processedCount: args.summary.processedCount,
    draftCount: args.summary.draftCount,
    errorCount: args.summary.errorCount,
    status: args.status,
    notes: args.summary.notes.join(" | ") || null,
  };
}

type CandidateValidationResult =
  | { candidate: Awaited<ReturnType<typeof validateLiteDiscoveredCandidate>>; error: null }
  | { candidate: null; error: string };

export async function runLiteZipDiscovery(args: {
  tenantId: string;
  request?: Request;
}): Promise<LiteDiscoveryRunSummary> {
  const adapter = await createLiteSheetAdapter();
  const config = getLiteConfig();

  await adapter.ensureTabs([
    config.zipTargetsTabName,
    config.discoveredListingsTabName,
    config.qualifiedListingsTabName,
    config.brokerOutreachQueueTabName,
    config.automationRunsTabName,
  ]);

  const [
    intakeValues,
    archiveValues,
    zipTargetValues,
    discoveredValues,
    qualifiedListingValues,
    outreachQueueValues,
    automationRunValues,
  ] = await Promise.all([
    adapter.readValues(adapter.tabs.intakeTabName),
    adapter.readValues(adapter.tabs.archiveTabName),
    adapter.readValues(config.zipTargetsTabName),
    adapter.readValues(config.discoveredListingsTabName),
    adapter.readValues(config.qualifiedListingsTabName),
    adapter.readValues(config.brokerOutreachQueueTabName),
    adapter.readValues(config.automationRunsTabName),
  ]);

  const intakeHeaderState = buildIntakeHeaderState(intakeValues, adapter.tabs.intakeTabName);
  const zipTargetHeaderState = buildZipTargetHeaderState(zipTargetValues, config.zipTargetsTabName);
  const discoveredHeaderState = buildDiscoveredListingHeaderState(discoveredValues, config.discoveredListingsTabName);
  const outreachHeaderState = buildBrokerOutreachQueueHeaderState(outreachQueueValues, config.brokerOutreachQueueTabName);
  const automationRunHeaderState = buildAutomationRunHeaderState(automationRunValues, config.automationRunsTabName);
  const zipTargetTable = parseZipTargetsTable(zipTargetValues, config.zipTargetsTabName);
  const discoveredTable = parseDiscoveredListingsTable(discoveredValues, config.discoveredListingsTabName);
  const outreachQueueTable = parseBrokerOutreachQueueTable(outreachQueueValues, config.brokerOutreachQueueTabName);
  const archiveTable = parseArchiveTable(archiveValues, adapter.tabs.archiveTabName);

  const updates = new Map<string, SheetCellUpdate>();
  for (const update of [
    ...intakeHeaderState.headerUpdates,
    ...zipTargetHeaderState.headerUpdates,
    ...discoveredHeaderState.headerUpdates,
    ...outreachHeaderState.headerUpdates,
    ...automationRunHeaderState.headerUpdates,
  ]) {
    queueUpdate(updates, update);
  }

  const { selected, resetRows } = selectZipTarget(zipTargetTable.rows);
  if (!selected) {
    return {
      zip: "",
      candidateCount: 0,
      qualifiedCount: 0,
      promotedCount: 0,
      processedCount: 0,
      draftCount: 0,
      errorCount: 0,
      notes: ["No active ZIP targets found."],
    };
  }

  for (const resetRow of resetRows) {
    for (const update of buildZipTargetRowUpdates(
      config.zipTargetsTabName,
      resetRow.rowNumber,
      zipTargetHeaderState.headerIndex,
      resetRow,
    )) {
      queueUpdate(updates, update);
    }
  }

  const summary: LiteDiscoveryRunSummary = {
    zip: selected.zip,
    candidateCount: 0,
    qualifiedCount: 0,
    promotedCount: 0,
    processedCount: 0,
    draftCount: 0,
    errorCount: 0,
    notes: [],
  };

  const promotionLimit = selected.dailyLimit > 0 ? selected.dailyLimit : config.discoveryDailyLimit;
  const existingKeys = existingDiscoveryKeys(discoveredTable.rows);
  const backlogRows = existingKeys.qualifiedBacklog
    .filter((row) => row.zip === selected.zip)
    .slice(0, promotionLimit);
  const promotedBacklogRows = existingKeys.promotedBacklog
    .filter((row) => row.zip === selected.zip)
    .slice(0, promotionLimit);

  const rowsToPromote: DiscoveredListingRow[] = [...backlogRows];
  if (backlogRows.length) {
    summary.notes.push(`Using ${backlogRows.length} backlog discovery row(s).`);
  }
  if (promotedBacklogRows.length) {
    summary.notes.push(`Recovering ${promotedBacklogRows.length} previously promoted row(s).`);
  }

  const existingBuyerKeys = new Set<string>([
    ...archiveTable.rows
      .filter((row) => row.normalizedAddress && row.buyerEmail)
      .map((row) => getDiscoveryBuyerKey(row.normalizedAddress, row.buyerEmail)),
    ...discoveredTable.rows
      .filter((row) => row.brokerEmail && row.intakeRowNumber)
      .map((row) => getDiscoveryBuyerKey(row.normalizedAddress, row.brokerEmail || "")),
    ...intakeValues
      .slice(1)
      .map((row) => {
        const listingAddress = (row[intakeHeaderState.headerIndex.get("listing_address") ?? 2] ?? "").trim();
        const email = (row[intakeHeaderState.headerIndex.get("email") ?? 1] ?? "").trim();
        if (!listingAddress || !email) {
          return "";
        }

        return getDiscoveryBuyerKey(normalizeLiteAddress(listingAddress), email);
      })
      .filter(Boolean),
  ]);

  let nextDiscoveredRowNumber = nextSheetRowNumber(discoveredValues);

  if (rowsToPromote.length < promotionLimit) {
    const propertyTypes = (selected.propertyTypes.length ? selected.propertyTypes : [...LAUNCH_PROPERTY_TYPES]).filter((value) =>
      LAUNCH_PROPERTY_TYPES.includes(value as (typeof LAUNCH_PROPERTY_TYPES)[number]),
    ) as Array<"Retail" | "Industrial">;

    const candidates = await discoverLiteZipCandidates({
      zip: selected.zip,
      propertyTypes,
    });
    summary.candidateCount = candidates.length;

    const rankedCandidates = rankLiteDiscoveryCandidates(candidates);
    const validationCap = Math.min(rankedCandidates.length, config.discoveryMaxValidationsPerRun);
    const candidatesToValidate = rankedCandidates.slice(0, validationCap);
    if (rankedCandidates.length > candidatesToValidate.length) {
      summary.notes.push(
        `Validation capped at ${candidatesToValidate.length} of ${rankedCandidates.length} discovered candidates.`,
      );
    }

    const seenSourceBuyer = new Set(existingKeys.bySourceBuyer);
    const seenDomainBuyer = new Set(existingKeys.byDomainBuyer);
    const validationConcurrency = Math.max(1, config.discoveryValidationConcurrency);

    for (let index = 0; index < candidatesToValidate.length; index += validationConcurrency) {
      if (rowsToPromote.length >= promotionLimit) {
        summary.notes.push(`Stopped validation after reaching the daily promotion limit of ${promotionLimit}.`);
        break;
      }

      const batch = candidatesToValidate.slice(index, index + validationConcurrency);
      const validationResults = await Promise.all(
        batch.map(async (candidate): Promise<CandidateValidationResult> => {
          try {
            const validated = await validateLiteDiscoveredCandidate({
              zip: selected.zip,
              candidate,
            });
            return {
              candidate: validated,
              error: null,
            };
          } catch (error) {
            return {
              candidate: null,
              error: error instanceof Error ? error.message : "Unexpected discovery validation failure.",
            };
          }
        }),
      );

      for (const result of validationResults) {
        if (result.error || !result.candidate) {
          summary.errorCount += 1;
          summary.notes.push(result.error || "Unexpected discovery validation failure.");
          continue;
        }

        const validated = result.candidate;

        let row: DiscoveredListingRow;
        if (!validated.isListingPage || !validated.isActive) {
          row = createDiscoveredListingRow({
            rowNumber: nextDiscoveredRowNumber,
            zip: selected.zip,
            candidate: validated,
            status: "SKIPPED_STALE",
            skipReason: validated.notes || "Listing appears stale or not a direct listing page.",
          });
        } else if (!LAUNCH_PROPERTY_TYPES.includes(validated.propertyType as (typeof LAUNCH_PROPERTY_TYPES)[number])) {
          row = createDiscoveredListingRow({
            rowNumber: nextDiscoveredRowNumber,
            zip: selected.zip,
            candidate: validated,
            status: "SKIPPED_WRONG_TYPE",
            skipReason: `Resolved property type ${validated.propertyType} is out of launch scope.`,
          });
        } else if (!hasTrustedLiteBrokerEmail(validated)) {
          row = createDiscoveredListingRow({
            rowNumber: nextDiscoveredRowNumber,
            zip: selected.zip,
            candidate: validated,
            status: "SKIPPED_NO_EMAIL",
            skipReason: "No trustworthy public broker email was found.",
          });
        } else {
          const orderedContacts = getOrderedTrustedLiteBrokerContacts(validated);
          const contactRows: DiscoveredListingRow[] = [];

          for (const contact of orderedContacts) {
            const isDuplicate = isDuplicateDiscovery({
              candidate: validated,
              contact,
              seenSourceBuyer,
              seenDomainBuyer,
              existingBuyerKeys,
            });

            const nextRow = createDiscoveredListingRow({
              rowNumber: nextDiscoveredRowNumber,
              zip: selected.zip,
              candidate: validated,
              contact,
              status: isDuplicate ? "SKIPPED_DUPLICATE" : "QUALIFIED",
              skipReason: isDuplicate ? "Listing/broker combination already exists in discovery or intake." : null,
            });

            contactRows.push(nextRow);
            nextDiscoveredRowNumber += 1;

            if (!isDuplicate) {
              const buyerKey = getDiscoveryBuyerKey(validated.normalizedAddress, contact.email);
              existingBuyerKeys.add(buyerKey);
              seenSourceBuyer.add(
                getDiscoverySourceBuyerKey({
                  normalizedAddress: validated.normalizedAddress,
                  sourceUrl: validated.sourceUrl,
                  brokerEmail: contact.email,
                }),
              );
              seenDomainBuyer.add(
                getDiscoveryDomainBuyerKey({
                  normalizedAddress: validated.normalizedAddress,
                  sourceDomain: validated.sourceDomain,
                  brokerEmail: contact.email,
                }),
              );
              summary.qualifiedCount += 1;
              if (rowsToPromote.length < promotionLimit) {
                rowsToPromote.push(nextRow);
              }
            }
          }

          for (const contactRow of contactRows) {
            discoveredTable.rows.push(contactRow);
            for (const update of buildDiscoveredListingRowUpdates(
              config.discoveredListingsTabName,
              contactRow.rowNumber,
              discoveredHeaderState.headerIndex,
              contactRow,
            )) {
              queueUpdate(updates, update);
            }
          }
          continue;
        }

        discoveredTable.rows.push(row);
        for (const update of buildDiscoveredListingRowUpdates(
          config.discoveredListingsTabName,
          row.rowNumber,
          discoveredHeaderState.headerIndex,
          row,
        )) {
          queueUpdate(updates, update);
        }
        nextDiscoveredRowNumber += 1;
      }
    }
  } else {
    summary.qualifiedCount = backlogRows.length;
  }

  if (!rowsToPromote.length && !promotedBacklogRows.length) {
    const zipTargetNext: ZipTargetRow = {
      ...selected,
      lastRunAt: new Date(),
      lastQualifiedCount: 0,
      status: "DONE",
      completedAt: new Date(),
      notes: "No qualified listings available.",
    };
    for (const update of buildZipTargetRowUpdates(
      config.zipTargetsTabName,
      zipTargetNext.rowNumber,
      zipTargetHeaderState.headerIndex,
      zipTargetNext,
    )) {
      queueUpdate(updates, update);
    }

    const runRow = createAutomationRunRow({
      rowNumber: nextSheetRowNumber(automationRunValues),
      zip: selected.zip,
      summary,
      status: "NO_QUALIFIED_LISTINGS",
    });
    for (const update of buildAutomationRunRowUpdates(
      config.automationRunsTabName,
      runRow.rowNumber,
      automationRunHeaderState.headerIndex,
      runRow,
    )) {
      queueUpdate(updates, update);
    }

    for (const update of buildQualifiedListingReviewSyncUpdates({
      existingValues: qualifiedListingValues,
      tabName: config.qualifiedListingsTabName,
      discoveredRows: discoveredTable.rows,
    })) {
      queueUpdate(updates, update);
    }

    await adapter.writeValues(Array.from(updates.values()));
    return summary;
  }

  let nextIntakeRowNumber = nextSheetRowNumber(intakeValues);
  const promotedRowNumbers = new Set<number>();
  const discoveredRowsToFinalize: DiscoveredListingRow[] = [...promotedBacklogRows];

  for (const promotedBacklogRow of promotedBacklogRows) {
    if (promotedBacklogRow.intakeRowNumber != null) {
      promotedRowNumbers.add(promotedBacklogRow.intakeRowNumber);
    }
  }

  for (const discoveredRow of rowsToPromote.slice(0, promotionLimit)) {
    const intakeEntry: LiteIntakeEntry = {
      brokerName: discoveredRow.brokerName,
      email: discoveredRow.brokerEmail || "",
      listingAddress: discoveredRow.listingAddress,
      listingTitle: discoveredRow.listingTitle,
      propertyType: discoveredRow.propertyType,
      zip: discoveredRow.zip,
      sourceUrl: discoveredRow.sourceUrl,
    };

    for (const update of buildIntakeRowUpdates(
      adapter.tabs.intakeTabName,
      nextIntakeRowNumber,
      intakeHeaderState.headerIndex,
      intakeEntry,
    )) {
      queueUpdate(updates, update);
    }

    const promotedDiscoveredRow: DiscoveredListingRow = {
      ...discoveredRow,
      discoveryStatus: "PROMOTED",
      promotedAt: new Date(),
      intakeRowNumber: nextIntakeRowNumber,
      error: null,
    };

    for (const update of buildDiscoveredListingRowUpdates(
      config.discoveredListingsTabName,
      promotedDiscoveredRow.rowNumber,
      discoveredHeaderState.headerIndex,
      promotedDiscoveredRow,
    )) {
      queueUpdate(updates, update);
    }
    replaceDiscoveredListingRow(discoveredTable.rows, promotedDiscoveredRow);

    discoveredRowsToFinalize.push(promotedDiscoveredRow);
    promotedRowNumbers.add(nextIntakeRowNumber);
    nextIntakeRowNumber += 1;
    summary.promotedCount += 1;
  }

  await adapter.writeValues(Array.from(updates.values()));
  await processLiteSheet({
    tenantId: args.tenantId,
    request: args.request,
    rowNumbers: Array.from(promotedRowNumbers),
  });

  const refreshedIntakeValues = await adapter.readValues(adapter.tabs.intakeTabName);
  const refreshedIntakeHeaderState = buildIntakeHeaderState(refreshedIntakeValues, adapter.tabs.intakeTabName);
  const refreshedQueueValues = await adapter.readValues(config.brokerOutreachQueueTabName);
  const refreshedQueueTable = parseBrokerOutreachQueueTable(refreshedQueueValues, config.brokerOutreachQueueTabName);
  const queueTokens = new Set(refreshedQueueTable.rows.map((row) => row.token));
  let nextQueueRowNumber = nextSheetRowNumber(refreshedQueueValues);

  const finalUpdates = new Map<string, SheetCellUpdate>();
  const successfulPromotions: Array<DiscoveredListingRow & { paywallLink: string; adminLink: string; token: string }> = [];

  for (const discoveredRow of discoveredRowsToFinalize) {
    const intakeRow = readIntakeRowSnapshot(
      refreshedIntakeValues,
      discoveredRow.intakeRowNumber ?? discoveredRow.rowNumber,
      refreshedIntakeHeaderState.headerIndex,
    );
    const token = extractLiteTokenFromUrl(intakeRow.link);

    let finalizedRow: DiscoveredListingRow;
    if (!intakeRow.link || !token) {
      finalizedRow = {
        ...discoveredRow,
        discoveryStatus: "FAILED",
        error: intakeRow.error || "Workbook processing did not produce a valid link.",
      };
      summary.errorCount += 1;
    } else {
      finalizedRow = {
        ...discoveredRow,
        discoveryStatus: "PROCESSED",
        token,
        paywallLink: intakeRow.link,
        adminLink: buildLiteAdminLinkUrl(token, args.request),
        error: null,
      };
      summary.processedCount += 1;
      successfulPromotions.push({
        ...finalizedRow,
        paywallLink: intakeRow.link,
        adminLink: buildLiteAdminLinkUrl(token, args.request),
        token,
      });
    }

    for (const update of buildDiscoveredListingRowUpdates(
      config.discoveredListingsTabName,
      finalizedRow.rowNumber,
      discoveredHeaderState.headerIndex,
      finalizedRow,
    )) {
      queueUpdate(finalUpdates, update);
    }
    replaceDiscoveredListingRow(discoveredTable.rows, finalizedRow);
  }

  for (const promotedRow of successfulPromotions) {
    if (queueTokens.has(promotedRow.token) || !promotedRow.brokerEmail) {
      continue;
    }

    let draftError: string | null = null;
    const draft = await generateLiteBrokerOutreachDraft({
      listingAddress: promotedRow.listingAddress,
      listingTitle: promotedRow.listingTitle,
      propertyType: promotedRow.propertyType,
      brokerName: promotedRow.brokerName,
      brokerEmail: promotedRow.brokerEmail,
      sourceUrl: promotedRow.sourceUrl,
      paywallLink: promotedRow.paywallLink,
    }).catch((error) => {
      draftError = error instanceof Error ? error.message : "Unexpected outreach draft generation failure.";
      summary.errorCount += 1;
      summary.notes.push(`Used fallback outreach draft for ${promotedRow.listingAddress}.`);
      return buildLiteBrokerOutreachFallbackDraft({
        listingAddress: promotedRow.listingAddress,
        propertyType: promotedRow.propertyType,
        brokerName: promotedRow.brokerName,
        paywallLink: promotedRow.paywallLink,
      });
    });

    const queueRow: BrokerOutreachQueueRow = {
      rowNumber: nextQueueRowNumber,
      createdAt: new Date(),
      listingAddress: promotedRow.listingAddress,
      brokerName: promotedRow.brokerName,
      brokerEmail: promotedRow.brokerEmail,
      sourceUrl: promotedRow.sourceUrl,
      token: promotedRow.token,
      paywallLink: promotedRow.paywallLink,
      adminLink: promotedRow.adminLink,
      subject: draft.subject,
      body: draft.body,
      approvalStatus: "DRAFT",
      sendStatus: "UNSENT",
      gmailMessageId: null,
      sentAt: null,
      error: draftError,
    };

    for (const update of buildBrokerOutreachQueueRowUpdates(
      config.brokerOutreachQueueTabName,
      queueRow.rowNumber,
      outreachHeaderState.headerIndex,
      queueRow,
    )) {
      queueUpdate(finalUpdates, update);
    }
    queueTokens.add(queueRow.token);
    nextQueueRowNumber += 1;
    summary.draftCount += 1;
  }

  const zipTargetNext: ZipTargetRow = {
    ...selected,
    lastRunAt: new Date(),
    lastQualifiedCount: summary.promotedCount,
    status: summary.promotedCount >= promotionLimit ? "IN_PROGRESS" : "DONE",
    completedAt: summary.promotedCount >= promotionLimit ? null : new Date(),
    notes: summary.promotedCount >= promotionLimit ? "Daily limit reached." : "ZIP inventory below daily limit.",
  };

  for (const update of buildZipTargetRowUpdates(
    config.zipTargetsTabName,
    zipTargetNext.rowNumber,
    zipTargetHeaderState.headerIndex,
    zipTargetNext,
  )) {
    queueUpdate(finalUpdates, update);
  }

  const runRow = createAutomationRunRow({
    rowNumber: nextSheetRowNumber(automationRunValues),
    zip: selected.zip,
    summary,
    status: "OK",
  });
  for (const update of buildAutomationRunRowUpdates(
    config.automationRunsTabName,
    runRow.rowNumber,
    automationRunHeaderState.headerIndex,
    runRow,
  )) {
    queueUpdate(finalUpdates, update);
  }

  for (const update of buildQualifiedListingReviewSyncUpdates({
    existingValues: qualifiedListingValues,
    tabName: config.qualifiedListingsTabName,
    discoveredRows: discoveredTable.rows,
  })) {
    queueUpdate(finalUpdates, update);
  }

  await adapter.writeValues(Array.from(finalUpdates.values()));
  return summary;
}
