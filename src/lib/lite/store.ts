import {
  buildArchiveHeaderState,
  buildArchiveRowUpdates,
  deriveLiteStatus,
  parseArchiveTable,
  toLiteLinkWithWorkbook,
  type LiteArchiveRow,
} from "@/lib/lite/archive-sheet";
import { createLiteSheetAdapter, resetMockLiteSheetValues } from "@/lib/lite/google-sheet";
import type { LiteLinkWithWorkbook } from "@/lib/lite/types";
import { generateLiteWorkbookFromAddress } from "@/lib/lite/workbooks";

const LITE_FALLBACK_TENANT_ID = "00000000-0000-0000-0000-000000000001";

function cloneArchiveRow(row: LiteArchiveRow): LiteArchiveRow {
  return {
    ...row,
    openedAt: row.openedAt ? new Date(row.openedAt) : null,
    paidAt: row.paidAt ? new Date(row.paidAt) : null,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}

async function loadArchiveTable() {
  const adapter = await createLiteSheetAdapter();
  const values = await adapter.readValues(adapter.tabs.archiveTabName);
  const headerState = buildArchiveHeaderState(values, adapter.tabs.archiveTabName);
  const table = parseArchiveTable(values, adapter.tabs.archiveTabName);

  return {
    adapter,
    values,
    table,
    headerState,
  };
}

async function updateArchiveRow(
  token: string,
  mutator: (row: LiteArchiveRow) => LiteArchiveRow,
): Promise<LiteLinkWithWorkbook | null> {
  const { adapter, table, headerState } = await loadArchiveTable();
  const existing = table.rows.find((row) => row.token === token);
  if (!existing) return null;

  const next = mutator(cloneArchiveRow(existing));
  next.status = deriveLiteStatus({
    paid: next.paid,
    openedAt: next.openedAt,
    error: next.error,
  });

  await adapter.writeValues([
    ...headerState.headerUpdates,
    ...buildArchiveRowUpdates(table.tabName, existing.rowNumber, headerState.headerIndex, next),
  ]);

  return toLiteLinkWithWorkbook(next, { allowEmptyWorkbook: true });
}

async function hydrateArchiveWorkbook(row: LiteArchiveRow): Promise<LiteArchiveRow> {
  if (row.workbookCsv.trim()) {
    return row;
  }

  const { adapter, table, headerState } = await loadArchiveTable();
  const existing = table.rows.find((candidate) => candidate.token === row.token);
  if (!existing) {
    return row;
  }
  if (existing.workbookCsv.trim()) {
    return existing;
  }

  const generated = await generateLiteWorkbookFromAddress(existing.inputAddress || existing.displayAddress, {
    siteContextJson: existing.siteContextJson,
  });
  const next: LiteArchiveRow = {
    ...cloneArchiveRow(existing),
    displayAddress: generated.displayAddress,
    workbookCsv: generated.csv,
    updatedAt: new Date(),
  };

  await adapter.writeValues([
    ...headerState.headerUpdates,
    ...buildArchiveRowUpdates(table.tabName, existing.rowNumber, headerState.headerIndex, next),
  ]);

  return next;
}

export function getLiteFallbackTenantId(): string {
  return LITE_FALLBACK_TENANT_ID;
}

export function resetLiteMemoryStore(): void {
  resetMockLiteSheetValues();
}

export async function listLiteLinks(tenantId: string, limit = 50): Promise<LiteLinkWithWorkbook[]> {
  const { table } = await loadArchiveTable();

  return table.rows
    .filter((row) => !tenantId || !row.tenantId || row.tenantId === tenantId)
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
    .slice(0, limit)
    .map((row) => toLiteLinkWithWorkbook(row, { allowEmptyWorkbook: true }));
}

export async function findLiteLinkByToken(token: string): Promise<LiteLinkWithWorkbook | null> {
  const { table } = await loadArchiveTable();
  const row = table.rows.find((candidate) => candidate.token === token);
  if (!row) return null;

  const hydrated = await hydrateArchiveWorkbook(row);
  return toLiteLinkWithWorkbook(hydrated, { allowEmptyWorkbook: true });
}

export async function setLiteLinkCheckoutSession(token: string, sessionId: string): Promise<void> {
  await updateArchiveRow(token, (row) => ({
    ...row,
    stripeCheckoutSessionId: sessionId,
    updatedAt: new Date(),
  }));
}

export async function markLiteLinkOpened(token: string): Promise<LiteLinkWithWorkbook | null> {
  return updateArchiveRow(token, (row) => ({
    ...row,
    openedAt: row.openedAt ?? new Date(),
    updatedAt: new Date(),
  }));
}

export async function markLiteLinkFailed(token: string, error: string): Promise<void> {
  await updateArchiveRow(token, (row) => ({
    ...row,
    paid: false,
    error,
    updatedAt: new Date(),
  }));
}

export async function markLiteLinkPaid(args: {
  token: string;
  purchaserEmail: string | null;
  purchaserName: string | null;
  amountPaidCents: number | null;
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
}): Promise<LiteLinkWithWorkbook | null> {
  return updateArchiveRow(args.token, (row) => ({
    ...row,
    paid: true,
    purchaserEmail: args.purchaserEmail,
    purchaserName: args.purchaserName,
    amountPaidCents: args.amountPaidCents,
    stripeCheckoutSessionId: args.stripeCheckoutSessionId,
    stripePaymentIntentId: args.stripePaymentIntentId,
    paidAt: row.paidAt ?? new Date(),
    error: null,
    updatedAt: new Date(),
  }));
}
