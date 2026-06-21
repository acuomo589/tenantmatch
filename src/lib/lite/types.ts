import type { WorkbookRow } from "@/lib/workbookCsv";

export const LITE_LINK_STATUSES = ["GENERATED", "OPENED", "PAID", "FAILED"] as const;

export type LiteLinkStatus = (typeof LITE_LINK_STATUSES)[number];

export type LiteWorkbookRecord = {
  id: string;
  tenantId: string;
  inputAddress: string;
  normalizedAddress: string;
  displayAddress: string;
  workbookCsv: string;
  workbookRowsJson: WorkbookRow[];
  previewRowCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export type LiteLinkRecord = {
  id: string;
  workbookId: string;
  buyerEmail: string;
  buyerName: string | null;
  token: string;
  status: LiteLinkStatus;
  priceCents: number;
  currency: string;
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
  purchaserEmail: string | null;
  purchaserName: string | null;
  amountPaidCents: number | null;
  openedAt: Date | null;
  paidAt: Date | null;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type LiteLinkWithWorkbook = LiteLinkRecord & {
  workbook: LiteWorkbookRecord;
};

export type LiteLinkListItem = {
  id: string;
  address: string;
  buyerEmail: string;
  buyerName: string | null;
  status: LiteLinkStatus;
  paywallUrl: string;
  purchaserEmail: string | null;
  purchaserName: string | null;
  amountPaidCents: number | null;
  currency: string;
  createdAt: string;
  openedAt: string | null;
  paidAt: string | null;
  error: string | null;
};

export type LiteProcessSummary = {
  processedRows: number;
  updatedRows: number;
  skippedRows: number;
  invalidRows: number;
  createdWorkbooks: number;
  reusedWorkbooks: number;
  createdLinks: number;
  reusedLinks: number;
  errors: Array<{ rowNumber: number; message: string }>;
};

export type LiteSheetRow = {
  rowNumber: number;
  address: string;
  buyerEmail: string;
  buyerName: string | null;
  link: string;
  error: string | null;
};
