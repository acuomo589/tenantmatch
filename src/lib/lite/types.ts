import type { WorkbookRow } from "@/lib/workbookCsv";

export const LITE_LINK_STATUSES = ["GENERATED", "OPENED", "PAID", "FAILED"] as const;

export type LiteLinkStatus = (typeof LITE_LINK_STATUSES)[number];

export type LiteWorkbookRecord = {
  id: string;
  tenantId: string;
  inputAddress: string;
  normalizedAddress: string;
  displayAddress: string;
  siteContextJson: string | null;
  siteContextGeneratedAt: Date | null;
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
  siteContextHint: string | null;
  siteContextImageRefs: string[];
  forceRegenerate: boolean;
};

export const ZIP_TARGET_STATUSES = ["PENDING", "IN_PROGRESS", "DONE"] as const;
export type ZipTargetStatus = (typeof ZIP_TARGET_STATUSES)[number];

export const DISCOVERY_STATUSES = [
  "QUALIFIED",
  "SKIPPED_NO_EMAIL",
  "SKIPPED_DUPLICATE",
  "SKIPPED_WRONG_TYPE",
  "SKIPPED_STALE",
  "PROMOTED",
  "PROCESSED",
  "FAILED",
] as const;
export type DiscoveryStatus = (typeof DISCOVERY_STATUSES)[number];

export const BROKER_OUTREACH_APPROVAL_STATUSES = ["DRAFT", "APPROVED"] as const;
export type BrokerOutreachApprovalStatus = (typeof BROKER_OUTREACH_APPROVAL_STATUSES)[number];

export const BROKER_OUTREACH_SEND_STATUSES = ["UNSENT", "SENT", "FAILED"] as const;
export type BrokerOutreachSendStatus = (typeof BROKER_OUTREACH_SEND_STATUSES)[number];

export type ZipTargetRow = {
  rowNumber: number;
  zip: string;
  active: boolean;
  sequence: number;
  status: ZipTargetStatus;
  propertyTypes: string[];
  dailyLimit: number;
  lastRunAt: Date | null;
  lastQualifiedCount: number | null;
  completedAt: Date | null;
  notes: string | null;
};

export type DiscoveredListingRow = {
  rowNumber: number;
  discoveredAt: Date | null;
  zip: string;
  propertyType: string;
  listingTitle: string;
  listingAddress: string;
  normalizedAddress: string;
  brokerName: string | null;
  brokerEmail: string | null;
  brokerEmailSourceType: LiteDiscoveryEmailSourceType;
  brokerEmailSourceUrl: string | null;
  sourceUrl: string;
  sourceDomain: string;
  discoveryStatus: DiscoveryStatus;
  skipReason: string | null;
  promotedAt: Date | null;
  intakeRowNumber: number | null;
  token: string | null;
  paywallLink: string | null;
  adminLink: string | null;
  error: string | null;
};

export type BrokerOutreachQueueRow = {
  rowNumber: number;
  createdAt: Date | null;
  listingAddress: string;
  brokerName: string | null;
  brokerEmail: string;
  sourceUrl: string | null;
  token: string;
  paywallLink: string;
  adminLink: string;
  subject: string;
  body: string;
  approvalStatus: BrokerOutreachApprovalStatus;
  sendStatus: BrokerOutreachSendStatus;
  gmailMessageId: string | null;
  sentAt: Date | null;
  error: string | null;
};

export type AutomationRunRow = {
  rowNumber: number;
  runStartedAt: Date | null;
  runFinishedAt: Date | null;
  zip: string;
  candidateCount: number;
  qualifiedCount: number;
  promotedCount: number;
  processedCount: number;
  draftCount: number;
  errorCount: number;
  status: string;
  notes: string | null;
};

export const QUALIFIED_LISTING_REVIEW_STATUSES = ["PROCESSED", "PROMOTED", "FAILED", "QUALIFIED"] as const;
export type QualifiedListingReviewStatus = (typeof QUALIFIED_LISTING_REVIEW_STATUSES)[number];

export type QualifiedListingReviewRow = {
  rowNumber: number;
  lastSeenAt: Date | null;
  zip: string;
  propertyType: string;
  listingAddress: string;
  listingTitle: string;
  status: QualifiedListingReviewStatus;
  brokers: string;
  paywallLinks: string;
  adminLinks: string;
  sourceUrls: string;
  notes: string | null;
};

export type LiteDiscoveryCandidate = {
  sourceUrl: string;
  sourceDomain: string;
  listingTitle: string;
  rawAddress: string;
  propertyTypeGuess: string;
  brokerName: string | null;
  brokerEmail: string | null;
  confidence: "high" | "medium" | "low";
};

export const LITE_DISCOVERY_EMAIL_SOURCE_TYPES = [
  "listing_page",
  "broker_profile_page",
  "brokerage_website_page",
  "unknown",
] as const;

export type LiteDiscoveryEmailSourceType = (typeof LITE_DISCOVERY_EMAIL_SOURCE_TYPES)[number];

export type LiteVerifiedBrokerContact = {
  name: string;
  email: string;
  emailSourceType: LiteDiscoveryEmailSourceType;
  emailSourceUrl: string | null;
};

export type LiteValidatedDiscovery = {
  sourceUrl: string;
  sourceDomain: string;
  listingTitle: string;
  listingAddress: string;
  normalizedAddress: string;
  propertyType: "Retail" | "Industrial" | "Unknown";
  listingContactNames: string[];
  verifiedBrokerContacts: LiteVerifiedBrokerContact[];
  brokerName: string | null;
  brokerEmail: string | null;
  brokerEmailSourceType: LiteDiscoveryEmailSourceType;
  brokerEmailSourceUrl: string | null;
  isListingPage: boolean;
  isActive: boolean;
  emailConfidence: "high" | "medium" | "low";
  notes: string;
};

export type LiteDiscoveryRunSummary = {
  zip: string;
  candidateCount: number;
  qualifiedCount: number;
  promotedCount: number;
  processedCount: number;
  draftCount: number;
  errorCount: number;
  notes: string[];
};
