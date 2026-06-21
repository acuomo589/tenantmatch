"use client";

import { useCallback, useEffect, useState } from "react";
import type { WorkbookRow } from "@/lib/workbookCsv";

export type UsageSnapshot = {
  planName: string;
  limits: {
    LISTINGS: number;
    CONTACTS: number;
    WORKBOOKS: number;
    WORKBOOK_ROWS: number;
  };
  usage: {
    LISTINGS: number;
    CONTACTS: number;
    WORKBOOKS: number;
    WORKBOOK_ROWS: number;
  };
};

export type ListingRecord = {
  id: string;
  title: string;
  customTitle?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  squareFootage?: number;
  noi?: number;
  capRate?: number;
  pricePerSquareFoot?: number;
  daysOnMarket?: number;
  attomId?: string;
  sourceListingId?: string;
  source?: string;
  propertyClass?: string;
  lotSizeAcres?: number;
  heroImageUrl?: string;
  locationDescription?: string;
  listingSummary?: string;
  ownerProvisions?: string;
  leaseTermYears?: number;
  rawDetails?: string;
  rentalRatePerSfYr?: number;
  listingType?: "FOR_LEASE" | "FOR_SALE" | "BOTH";
  lifecycleStatus?: "ACTIVE" | "OFF_MARKET";
  dateOnMarket?: string;
  lastUpdatedAtSource?: string;
  spaces: ListingSpaceRecord[];
  disclosures: ListingDisclosureRecord[];
  features: ListingFeatureRecord[];
  constraints: string[];
  contacts: ListingContactRecord[];
  tenants: ListingTenantRecord[];
};

export type ListingSpaceRecord = {
  spaceLabel?: string;
  floorLabel?: string;
  suite?: string;
  sizeSf?: number;
  minSizeSf?: number;
  maxSizeSf?: number;
  termText?: string;
  rentalRatePerSfYr?: number;
  rentalRateDisplay?: string;
  spaceUsePrimary?: string;
  spaceUseTags?: string[];
  buildOut?: string;
  availableDate?: string;
  availableNow?: boolean;
};

export type ListingFeatureRecord = {
  featureKey?: string;
  featureValueNumber?: number;
  featureValueText?: string;
  unit?: string;
  sourceText?: string;
  tagsJson?: unknown;
  confidence?: number;
};

export type ListingDisclosureRecord = {
  text: string;
  sourceText?: string;
  source?: "UPLOAD" | "SEARCH" | "PARSED";
  isMaterial?: boolean;
  tagsJson?: unknown;
  confidence?: number;
};

export type ListingContactRecord = {
  name: string;
  role?: string;
  company?: string;
  phone?: string;
  email?: string;
};

export type ListingTenantRecord = {
  tenantName: string;
  industry?: string;
  floorLabel?: string;
};

export type WorkbookResult = {
  id: string;
  listingId: string;
  listingTitle: string;
  createdAt: string;
  csv: string;
  rows: WorkbookRow[];
};

export type OutreachContact = {
  id: string;
  name: string;
  title: string;
  email?: string;
  confidence: "high" | "medium" | "low";
};

export type OutreachTarget = {
  id: string;
  listingId: string;
  workbookId: string;
  workbookRow: WorkbookRow;
  businessAgeYears?: number;
  industry?: string;
  parentCompany?: string;
  estimatedRevenue?: string;
  hqAddress?: string;
  contacts: OutreachContact[];
  selectedContactId?: string;
  emailSubject: string;
  emailBody: string;
  generatingEmail?: boolean;
  sendingEmail?: boolean;
  contactsLoading?: boolean;
  contactsHasMore?: boolean;
  contactsCursor?: string | null;
  lastSendStatus?: "idle" | "sent" | "failed";
  lastSendMessage?: string;
};

export type ExploreOptionsScenario = {
  id: string;
  name: string;
  whyItFits: string;
  whatMustBeTrue: string[];
  scopeLevel: "Light reposition" | "Heavy rehab" | "Gut renovation" | "Partial demo" | "Teardown";
  entitlementDifficulty: "Low" | "Medium" | "High";
  operatorSkillRequired: string;
  exitFlipability: string;
  timeline: string;
  financeability: "Low" | "Medium" | "High";
  hardCostPerSfUsd: string;
  softCostPct: string;
  contingencyPct: string;
  totalProjectCostLowUsd: string;
  totalProjectCostHighUsd: string;
  targetTenantOrBuyer: string;
  revenueModel: string;
  exitStrategy: string;
  marginView: "Strong" | "Thin" | "Negative/speculative";
  buildOutScope: string[];
  incentives: string[];
  killPoints: string[];
};

export type ExploreOptionsAnalysis = {
  propertySnapshot: string;
  finalVerdict: "Strong candidate" | "Worth exploring" | "Only works with subsidy or basis reset" | "Pass";
  developerSummary: string;
  redFlags: string[];
  scenarios: ExploreOptionsScenario[];
};

export type ExploreOptionsResult = {
  listingId: string;
  createdAt: string;
  analysis: ExploreOptionsAnalysis;
};

export type ListingResearchAnalysis = {
  listingSummary: string;
  marketScore: number;
  listingScore: number;
  marketRationale: string;
  listingRationale: string;
  demandSignals: string[];
  headwinds: string[];
  assumptions: string[];
  confidence: "Low" | "Medium" | "High";
};

export type ListingResearchResult = {
  listingId: string;
  createdAt: string;
  analysis: ListingResearchAnalysis;
};

export type PersistedWorkspace = {
  listings: ListingRecord[];
  workbooks: WorkbookResult[];
  outreachTargets: OutreachTarget[];
  exploreOptionsByListing: Record<string, ExploreOptionsResult>;
  listingResearchByListing: Record<string, ListingResearchResult>;
  activeWorkbookId: string | null;
  activeOutreachTargetId: string | null;
};

type LegacyPersistedWorkspace = Partial<PersistedWorkspace> & {
  activeExploreListingId?: unknown;
  primaryTab?: unknown;
  listingsPathView?: unknown;
};

const LOCAL_PERSISTENCE_MODE = process.env.NEXT_PUBLIC_LOCAL_PERSISTENCE_MODE ?? "server";
const LOCAL_PERSISTENCE_ENABLED = process.env.NEXT_PUBLIC_LOCAL_PERSISTENCE !== "0";
const LOCAL_PERSISTENCE_KEY = "timpani:workspace:v1";
export const LISTING_TITLE_MAX_LENGTH = 72;

function readPersistedWorkspace(): PersistedWorkspace | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(LOCAL_PERSISTENCE_KEY);
    if (!raw) return null;
    return normalizePersistedWorkspace(JSON.parse(raw));
  } catch {
    return null;
  }
}

function writePersistedWorkspace(snapshot: PersistedWorkspace): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(LOCAL_PERSISTENCE_KEY, JSON.stringify(snapshot));
  } catch {
    // Best effort only.
  }
}

async function fetchPersistedWorkspaceFromServer(): Promise<PersistedWorkspace | null> {
  try {
    const response = await fetch("/api/workspace/state", { method: "GET" });
    if (!response.ok) return null;
    const payload = (await response.json()) as { state?: unknown };
    return normalizePersistedWorkspace(payload.state);
  } catch {
    return null;
  }
}

async function persistWorkspaceToServer(snapshot: PersistedWorkspace): Promise<void> {
  try {
    await fetch("/api/workspace/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state: snapshot }),
    });
  } catch {
    // Best effort only.
  }
}

function normalizePersistedWorkspace(value: unknown): PersistedWorkspace | null {
  if (!value || typeof value !== "object") return null;

  const parsed = value as LegacyPersistedWorkspace;
  if (!Array.isArray(parsed.listings) || !Array.isArray(parsed.workbooks) || !Array.isArray(parsed.outreachTargets)) {
    return null;
  }

  const exploreOptionsByListing =
    parsed.exploreOptionsByListing && typeof parsed.exploreOptionsByListing === "object"
      ? (parsed.exploreOptionsByListing as Record<string, ExploreOptionsResult>)
      : {};
  const listingResearchByListing =
    parsed.listingResearchByListing && typeof parsed.listingResearchByListing === "object"
      ? (parsed.listingResearchByListing as Record<string, ListingResearchResult>)
      : {};

  const activeWorkbookId = typeof parsed.activeWorkbookId === "string" ? parsed.activeWorkbookId : null;
  const activeOutreachTargetId = typeof parsed.activeOutreachTargetId === "string" ? parsed.activeOutreachTargetId : null;

  return {
    listings: parsed.listings as ListingRecord[],
    workbooks: parsed.workbooks as WorkbookResult[],
    outreachTargets: parsed.outreachTargets as OutreachTarget[],
    exploreOptionsByListing,
    listingResearchByListing,
    activeWorkbookId,
    activeOutreachTargetId,
  };
}

export function formatListingAddress(listing: ListingRecord): string {
  return [listing.addressLine1, listing.addressLine2, [listing.city, listing.state, listing.postalCode].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
}

export function getListingDisplayTitle(listing: ListingRecord): string {
  const normalizedCustomTitle = listing.customTitle?.trim().slice(0, LISTING_TITLE_MAX_LENGTH);
  return normalizedCustomTitle || listing.addressLine1?.trim() || "Untitled listing";
}

export function formatLastEdited(listing: ListingRecord): string {
  const raw = listing.lastUpdatedAtSource ?? listing.dateOnMarket;
  if (!raw) return "—";

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString();
}

export function enrichListingForCard(listing: ListingRecord): ListingRecord {
  const next = { ...listing };
  if (!next.heroImageUrl) {
    next.heroImageUrl =
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1400&q=80";
  }
  if (!next.locationDescription) {
    next.locationDescription = deriveLocationDescription(next);
  }
  if (!next.listingSummary) {
    next.listingSummary = buildAutoSummary(next);
  }
  return next;
}

function deriveLocationDescription(listing: ListingRecord): string {
  const locationRegex = /(access|route|highway|turnpike|central|location|corridor|logistics|transit|strategically located|near)/i;

  const fromSummary = (listing.listingSummary ?? "")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .find((sentence) => locationRegex.test(sentence));

  if (fromSummary) return fromSummary;

  const fromFeatures = listing.features
    .map((feature) => feature.featureValueText ?? feature.sourceText ?? "")
    .find((value) => locationRegex.test(value));

  return fromFeatures || "Strategically located with strong regional access.";
}

function buildAutoSummary(listing: ListingRecord): string {
  const primarySpace = listing.spaces[0];
  const typeText = primarySpace?.spaceUsePrimary ?? listing.propertyClass ?? "commercial";
  const size = primarySpace?.sizeSf ?? listing.squareFootage;
  const location = [listing.city, listing.state].filter(Boolean).join(", ") || "the target market";
  const topFeature = listing.features.map((feature) => feature.featureValueText ?? feature.sourceText).find(Boolean);
  const topDisclosure = listing.disclosures.map((disclosure) => disclosure.text).find(Boolean);
  const displayTitle = getListingDisplayTitle(listing);

  const clauses = [
    `${displayTitle || "This listing"} is a ${typeText.toLowerCase()} opportunity in ${location}`,
    size ? `with approximately ${size.toLocaleString()} SF available` : "with flexible occupancy potential",
    topFeature ? `and highlights including ${topFeature.toLowerCase()}` : undefined,
    topDisclosure ? `Note: ${topDisclosure}.` : "",
  ].filter(Boolean);

  return `${clauses.join(" ")}`.trim();
}

export function exportWorkbookCsv(workbook: WorkbookResult): void {
  const blob = new Blob([workbook.csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${workbook.listingTitle.replace(/[^a-z0-9]+/gi, "_").toLowerCase()}_workbook.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function slugifyForId(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function buildSuggestedContacts(row: WorkbookRow, fallbackName?: string): OutreachContact[] {
  const base = slugifyForId(row.business_name) || "target";
  const firstName = row.business_name.split(/\s+/)[0] || "Team";

  const seeded: OutreachContact[] = [
    {
      id: `${base}_ops`,
      name: fallbackName ?? `${firstName} Operations Team`,
      title: "Operations Lead",
      email: `${base}.ops@example.com`,
      confidence: fallbackName ? "high" : "medium",
    },
    {
      id: `${base}_realestate`,
      name: `${firstName} Real Estate`,
      title: "Real Estate Manager",
      email: `${base}.realestate@example.com`,
      confidence: "medium",
    },
    {
      id: `${base}_exec`,
      name: `${firstName} Executive Office`,
      title: "Executive Contact",
      email: undefined,
      confidence: "low",
    },
  ];

  const unique = new Set<string>();
  return seeded.filter((contact) => {
    const key = `${contact.name}_${contact.title}`;
    if (unique.has(key)) return false;
    unique.add(key);
    return true;
  });
}

function mergeContacts(existing: OutreachContact[], incoming: OutreachContact[]): OutreachContact[] {
  const seen = new Set<string>();
  const merged: OutreachContact[] = [];

  for (const contact of [...existing, ...incoming]) {
    const key = `${contact.id}|${contact.email ?? ""}|${contact.name}|${contact.title}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(contact);
  }

  return merged;
}

export function useWorkspaceData() {
  const [listings, setListings] = useState<ListingRecord[]>([]);
  const [workbooks, setWorkbooks] = useState<WorkbookResult[]>([]);
  const [outreachTargets, setOutreachTargets] = useState<OutreachTarget[]>([]);
  const [exploreOptionsByListing, setExploreOptionsByListing] = useState<Record<string, ExploreOptionsResult>>({});
  const [listingResearchByListing, setListingResearchByListing] = useState<Record<string, ListingResearchResult>>({});
  const [activeWorkbookId, setActiveWorkbookId] = useState<string | null>(null);
  const [activeOutreachTargetId, setActiveOutreachTargetId] = useState<string | null>(null);
  const [creatingWorkbookListingId, setCreatingWorkbookListingId] = useState<string | null>(null);
  const [listingResearchLoadingListingId, setListingResearchLoadingListingId] = useState<string | null>(null);
  const [exploreOptionsLoadingListingId, setExploreOptionsLoadingListingId] = useState<string | null>(null);
  const [workbookError, setWorkbookError] = useState<string | null>(null);
  const [listingResearchError, setListingResearchError] = useState<string | null>(null);
  const [exploreOptionsError, setExploreOptionsError] = useState<string | null>(null);
  const [outreachError, setOutreachError] = useState<string | null>(null);
  const [listingInfoMessage, setListingInfoMessage] = useState<string | null>(null);
  const [didHydratePersistedState, setDidHydratePersistedState] = useState(!LOCAL_PERSISTENCE_ENABLED);

  useEffect(() => {
    if (!LOCAL_PERSISTENCE_ENABLED) {
      setDidHydratePersistedState(true);
      return;
    }

    let isMounted = true;

    void (async () => {
      const persisted =
        (LOCAL_PERSISTENCE_MODE === "server" ? await fetchPersistedWorkspaceFromServer() : null) ??
        readPersistedWorkspace();

      if (isMounted && persisted) {
        setListings(persisted.listings);
        setWorkbooks(persisted.workbooks);
        setOutreachTargets(persisted.outreachTargets);
        setExploreOptionsByListing(persisted.exploreOptionsByListing ?? {});
        setListingResearchByListing(persisted.listingResearchByListing ?? {});
        setActiveWorkbookId(persisted.activeWorkbookId);
        setActiveOutreachTargetId(persisted.activeOutreachTargetId);
      }

      if (isMounted) {
        setDidHydratePersistedState(true);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!LOCAL_PERSISTENCE_ENABLED || !didHydratePersistedState) return;

    const snapshot: PersistedWorkspace = {
      listings,
      workbooks,
      outreachTargets,
      exploreOptionsByListing,
      listingResearchByListing,
      activeWorkbookId,
      activeOutreachTargetId,
    };

    writePersistedWorkspace(snapshot);

    if (LOCAL_PERSISTENCE_MODE === "server") {
      const timeout = window.setTimeout(() => {
        void persistWorkspaceToServer(snapshot);
      }, 300);

      return () => window.clearTimeout(timeout);
    }
  }, [
    listings,
    workbooks,
    outreachTargets,
    exploreOptionsByListing,
    listingResearchByListing,
    activeWorkbookId,
    activeOutreachTargetId,
    didHydratePersistedState,
  ]);

  const updateOutreachTarget = useCallback((targetId: string, updater: (target: OutreachTarget) => OutreachTarget) => {
    setOutreachTargets((prev) => prev.map((target) => (target.id === targetId ? updater(target) : target)));
  }, []);

  const updateListing = useCallback(
    (listingId: string, updater: (listing: ListingRecord) => ListingRecord, successMessage = "Listing updated.") => {
      setListings((prev) => prev.map((listing) => (listing.id === listingId ? updater(listing) : listing)));
      setListingInfoMessage(successMessage);
      setWorkbookError(null);
      setListingResearchError(null);
      setExploreOptionsError(null);
      setOutreachError(null);
    },
    [],
  );

  const fetchOutreachContacts = useCallback(
    async ({
      targetId,
      row,
      cursor,
      reset,
    }: {
      targetId: string;
      row: WorkbookRow;
      cursor?: string | null;
      reset?: boolean;
    }) => {
      updateOutreachTarget(targetId, (target) => ({ ...target, contactsLoading: true }));
      setOutreachError(null);

      try {
        const response = await fetch("/api/outreach/contacts/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            businessName: row.business_name,
            city: row.city,
            state: row.state,
            category: row.category,
            cursor: cursor ?? "1",
          }),
        });

        const payload = (await response.json()) as {
          error?: string;
          contacts?: OutreachContact[];
          hasMore?: boolean;
          nextCursor?: string | null;
        };

        if (!response.ok) {
          throw new Error(payload.error ?? "Could not load recommended contacts.");
        }

        updateOutreachTarget(targetId, (target) => {
          const incoming = Array.isArray(payload.contacts) ? payload.contacts : [];
          const combined = reset ? incoming : mergeContacts(target.contacts, incoming);
          const fallbackContact =
            target.workbookRow.owner_contact_name && target.workbookRow.owner_contact_name !== "N/A"
              ? target.workbookRow.owner_contact_name
              : undefined;
          const fallbackSeeded = buildSuggestedContacts(target.workbookRow, fallbackContact);
          const nextContacts = combined.length ? combined : fallbackSeeded;
          const selectedStillExists = nextContacts.some((contact) => contact.id === target.selectedContactId);

          return {
            ...target,
            contacts: nextContacts,
            selectedContactId: selectedStillExists ? target.selectedContactId : nextContacts[0]?.id,
            contactsLoading: false,
            contactsHasMore: Boolean(payload.hasMore),
            contactsCursor: payload.nextCursor ?? null,
          };
        });
      } catch (error) {
        updateOutreachTarget(targetId, (target) => ({
          ...target,
          contactsLoading: false,
          contactsHasMore: false,
        }));
        setOutreachError(error instanceof Error ? error.message : "Could not load recommended contacts.");
      }
    },
    [updateOutreachTarget],
  );

  const createWorkbookForListing = useCallback(async (listing: ListingRecord): Promise<WorkbookResult | null> => {
    setListingInfoMessage(null);
    setWorkbookError(null);
    setListingResearchError(null);
    setCreatingWorkbookListingId(listing.id);
    const displayTitle = getListingDisplayTitle(listing);
    const listingForPrompt = { ...listing, title: displayTitle };

    try {
      const response = await fetch("/api/workbooks/from-listing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listing: listingForPrompt }),
      });
      const payload = (await response.json()) as { error?: string; csv?: string; rows?: WorkbookRow[] };
      if (!response.ok || !payload.csv || !payload.rows) {
        throw new Error(payload.error ?? "Workbook generation failed.");
      }

      const workbook: WorkbookResult = {
        id: `workbook_${Math.random().toString(36).slice(2, 10)}`,
        listingId: listing.id,
        listingTitle: displayTitle,
        createdAt: new Date().toISOString(),
        csv: payload.csv,
        rows: payload.rows,
      };

      setWorkbooks((prev) => [workbook, ...prev]);
      setActiveWorkbookId(workbook.id);
      setListingInfoMessage(`Workbook ready for ${displayTitle}.`);
      return workbook;
    } catch (error) {
      setWorkbookError(error instanceof Error ? error.message : "Workbook generation failed.");
      return null;
    } finally {
      setCreatingWorkbookListingId(null);
    }
  }, []);

  const generateListingResearchForListing = useCallback(
    async (listing: ListingRecord): Promise<ListingResearchResult | null> => {
      setWorkbookError(null);
      setListingResearchError(null);
      setExploreOptionsError(null);
      setListingResearchLoadingListingId(listing.id);
      const displayTitle = getListingDisplayTitle(listing);
      const listingForPrompt = { ...listing, title: displayTitle };

      try {
        const response = await fetch("/api/listings/research", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ listing: listingForPrompt }),
        });

        const payload = (await response.json()) as { error?: string; analysis?: ListingResearchAnalysis };
        if (!response.ok || !payload.analysis) {
          throw new Error(payload.error ?? "Listing research generation failed.");
        }

        const result: ListingResearchResult = {
          listingId: listing.id,
          createdAt: new Date().toISOString(),
          analysis: payload.analysis,
        };

        setListingResearchByListing((prev) => ({ ...prev, [listing.id]: result }));
        setListings((prev) =>
          prev.map((current) =>
            current.id === listing.id ? { ...current, listingSummary: payload.analysis?.listingSummary || current.listingSummary } : current,
          ),
        );
        setListingInfoMessage(`Market research ready for ${displayTitle}.`);
        return result;
      } catch (error) {
        setListingResearchError(error instanceof Error ? error.message : "Listing research generation failed.");
        return null;
      } finally {
        setListingResearchLoadingListingId(null);
      }
    },
    [],
  );

  const addListings = useCallback(
    (items: ListingRecord[]) => {
      const nextListings = items.map(enrichListingForCard);
      if (!nextListings.length) return;

      setListings((prev) => [...prev, ...nextListings]);
      setWorkbookError(null);
      setListingResearchError(null);
      setExploreOptionsError(null);
      setOutreachError(null);
      setListingInfoMessage(
        nextListings.length === 1
          ? `Added ${getListingDisplayTitle(nextListings[0])}. Researching market now.`
          : `Added ${nextListings.length} listings. Researching market now.`,
      );

      void (async () => {
        for (const listing of nextListings) {
          await generateListingResearchForListing(listing);
        }
      })();
    },
    [generateListingResearchForListing],
  );

  const generateExploreOptionsForListing = useCallback(
    async (listing: ListingRecord): Promise<ExploreOptionsResult | null> => {
      setListingInfoMessage(null);
      setWorkbookError(null);
      setListingResearchError(null);
      setExploreOptionsError(null);
      setExploreOptionsLoadingListingId(listing.id);
      const displayTitle = getListingDisplayTitle(listing);
      const listingForPrompt = { ...listing, title: displayTitle };

      try {
        const response = await fetch("/api/listings/explore-options", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ listing: listingForPrompt }),
        });

        const payload = (await response.json()) as { error?: string; analysis?: ExploreOptionsAnalysis };
        if (!response.ok || !payload.analysis || !Array.isArray(payload.analysis.scenarios)) {
          throw new Error(payload.error ?? "Explore options generation failed.");
        }

        const result: ExploreOptionsResult = {
          listingId: listing.id,
          createdAt: new Date().toISOString(),
          analysis: payload.analysis,
        };

        setExploreOptionsByListing((prev) => ({ ...prev, [listing.id]: result }));
        setListingInfoMessage(`Explore options ready for ${displayTitle}.`);
        return result;
      } catch (error) {
        setExploreOptionsError(error instanceof Error ? error.message : "Explore options generation failed.");
        return null;
      } finally {
        setExploreOptionsLoadingListingId(null);
      }
    },
    [],
  );

  const openOutreachForRow = useCallback(
    (workbook: WorkbookResult, row: WorkbookRow) => {
      const id = `${workbook.id}_${slugifyForId(row.business_name)}`;
      let shouldFetchContacts = false;

      setOutreachTargets((prev) => {
        const existing = prev.find((target) => target.id === id);
        if (existing) {
          if (!existing.contactsLoading && (existing.contactsHasMore || existing.contactsCursor)) {
            shouldFetchContacts = existing.contacts.length <= 3;
          }
          return prev;
        }

        const fallbackContact = row.owner_contact_name && row.owner_contact_name !== "N/A" ? row.owner_contact_name : undefined;
        const contacts = buildSuggestedContacts(row, fallbackContact);
        const firstContact = contacts[0];

        const next: OutreachTarget = {
          id,
          listingId: workbook.listingId,
          workbookId: workbook.id,
          workbookRow: row,
          businessAgeYears: undefined,
          industry: row.category,
          parentCompany: undefined,
          estimatedRevenue: undefined,
          hqAddress: `${row.city}, ${row.state}`,
          contacts,
          selectedContactId: firstContact?.id,
          emailSubject: "",
          emailBody: "",
          contactsLoading: false,
          contactsHasMore: true,
          contactsCursor: "1",
          lastSendStatus: "idle",
        };

        shouldFetchContacts = true;
        return [next, ...prev];
      });

      setActiveOutreachTargetId(id);
      setOutreachError(null);

      if (shouldFetchContacts) {
        void fetchOutreachContacts({ targetId: id, row, reset: true, cursor: "1" });
      }

      return id;
    },
    [fetchOutreachContacts],
  );

  const generateOutreachEmail = useCallback(
    async (targetId: string) => {
      const target = outreachTargets.find((item) => item.id === targetId);
      if (!target) return;

      const listing = listings.find((item) => item.id === target.listingId);
      if (!listing) {
        setOutreachError("Listing context is missing for this outreach target.");
        return;
      }
      const listingForPrompt = { ...listing, title: getListingDisplayTitle(listing) };

      updateOutreachTarget(target.id, (current) => ({ ...current, generatingEmail: true }));
      setOutreachError(null);

      try {
        const contact =
          target.contacts.find((item) => item.id === target.selectedContactId) ??
          target.contacts[0] ??
          null;

        const response = await fetch("/api/outreach/generate-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            listing: listingForPrompt,
            workbookRow: target.workbookRow,
            contact,
          }),
        });

        const payload = (await response.json()) as { error?: string; subject?: string; body?: string };
        if (!response.ok || !payload.subject || !payload.body) {
          throw new Error(payload.error ?? "Could not generate outreach email.");
        }

        updateOutreachTarget(target.id, (current) => ({
          ...current,
          generatingEmail: false,
          emailSubject: payload.subject ?? current.emailSubject,
          emailBody: payload.body ?? current.emailBody,
        }));
      } catch (error) {
        updateOutreachTarget(target.id, (current) => ({ ...current, generatingEmail: false }));
        setOutreachError(error instanceof Error ? error.message : "Could not generate outreach email.");
      }
    },
    [listings, outreachTargets, updateOutreachTarget],
  );

  const sendOutreachEmail = useCallback(
    async (targetId: string) => {
      const target = outreachTargets.find((item) => item.id === targetId);
      if (!target) return;

      const contact =
        target.contacts.find((item) => item.id === target.selectedContactId) ??
        target.contacts[0] ??
        null;

      if (!contact?.email) {
        setOutreachError("Select a contact with an email before sending.");
        return;
      }

      if (!target.emailSubject.trim() || !target.emailBody.trim()) {
        setOutreachError("Generate or write an email before sending.");
        return;
      }

      setOutreachError(null);
      updateOutreachTarget(target.id, (current) => ({ ...current, sendingEmail: true }));

      try {
        const response = await fetch("/api/outreach/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: contact.email,
            subject: target.emailSubject,
            body: target.emailBody,
          }),
        });

        const payload = (await response.json()) as { error?: string; id?: string };
        if (!response.ok) {
          throw new Error(payload.error ?? "Failed to send email.");
        }

        updateOutreachTarget(target.id, (current) => ({
          ...current,
          sendingEmail: false,
          lastSendStatus: "sent",
          lastSendMessage: payload.id ? `Sent (message ${payload.id})` : "Sent",
        }));
      } catch (error) {
        updateOutreachTarget(target.id, (current) => ({
          ...current,
          sendingEmail: false,
          lastSendStatus: "failed",
          lastSendMessage: error instanceof Error ? error.message : "Failed to send email.",
        }));
        setOutreachError(error instanceof Error ? error.message : "Failed to send email.");
      }
    },
    [outreachTargets, updateOutreachTarget],
  );

  const loadMoreOutreachContacts = useCallback(
    async (targetId: string) => {
      const target = outreachTargets.find((item) => item.id === targetId);
      if (!target || target.contactsLoading || !target.contactsHasMore) return;

      await fetchOutreachContacts({
        targetId: target.id,
        row: target.workbookRow,
        cursor: target.contactsCursor ?? "1",
        reset: false,
      });
    },
    [fetchOutreachContacts, outreachTargets],
  );

  const deleteListing = useCallback(
    (listingId: string) => {
      setListings((prev) => prev.filter((listing) => listing.id !== listingId));

      setWorkbooks((prev) => {
        const remaining = prev.filter((workbook) => workbook.listingId !== listingId);
        const activeStillExists = remaining.some((workbook) => workbook.id === activeWorkbookId);
        setActiveWorkbookId(activeStillExists ? activeWorkbookId : remaining[0]?.id ?? null);
        return remaining;
      });

      setOutreachTargets((prev) => {
        const remaining = prev.filter((target) => target.listingId !== listingId);
        const activeStillExists = remaining.some((target) => target.id === activeOutreachTargetId);
        setActiveOutreachTargetId(activeStillExists ? activeOutreachTargetId : remaining[0]?.id ?? null);
        return remaining;
      });

      setExploreOptionsByListing((prev) => {
        if (!(listingId in prev)) return prev;
        const next = { ...prev };
        delete next[listingId];
        return next;
      });

      setListingResearchByListing((prev) => {
        if (!(listingId in prev)) return prev;
        const next = { ...prev };
        delete next[listingId];
        return next;
      });

      setListingInfoMessage(null);
      setWorkbookError(null);
      setListingResearchError(null);
      setExploreOptionsError(null);
      setOutreachError(null);
    },
    [activeOutreachTargetId, activeWorkbookId],
  );

  return {
    listings,
    setListings,
    addListings,
    updateListing,
    workbooks,
    outreachTargets,
    exploreOptionsByListing,
    listingResearchByListing,
    activeWorkbookId,
    setActiveWorkbookId,
    activeOutreachTargetId,
    setActiveOutreachTargetId,
    creatingWorkbookListingId,
    listingResearchLoadingListingId,
    exploreOptionsLoadingListingId,
    workbookError,
    listingResearchError,
    exploreOptionsError,
    outreachError,
    listingInfoMessage,
    isHydrated: didHydratePersistedState,
    createWorkbookForListing,
    generateListingResearchForListing,
    generateExploreOptionsForListing,
    openOutreachForRow,
    updateOutreachTarget,
    generateOutreachEmail,
    sendOutreachEmail,
    loadMoreOutreachContacts,
    deleteListing,
  };
}
