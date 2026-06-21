"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { EmptyState } from "@/components/app/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExploreOptionsPanel } from "@/components/listings/explore-options-panel";
import { ListingPageHeader } from "@/components/listings/listing-page-header";
import { ListingSectionTabs } from "@/components/listings/listing-section-tabs";
import { ListingStats } from "@/components/listings/listing-stats";
import { OutreachPanel } from "@/components/listings/outreach-panel";
import { OverviewPanel } from "@/components/listings/overview-panel";
import { WorkbookPanel } from "@/components/listings/workbook-panel";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import {
  exportWorkbookCsv,
  formatLastEdited,
  getListingDisplayTitle,
  LISTING_TITLE_MAX_LENGTH,
  useWorkspaceData,
  type ListingRecord,
} from "@/lib/workspace-client";

type ListingSection = "overview" | "explore-options" | "workbooks" | "proposals" | "outreach";

export default function ListingDetailPage() {
  return (
    <Suspense
      fallback={
        <WorkspaceShell>
          <section className="rounded-[2rem] border bg-card px-6 py-10 shadow-sm">Loading listing...</section>
        </WorkspaceShell>
      }
    >
      <ListingDetailPageContent />
    </Suspense>
  );
}

function ListingDetailPageContent() {
  const params = useParams<{ address: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const decodedAddress = decodeURIComponent(params?.address ?? "");
  const requestedSection = searchParams.get("section");
  const activeSection: ListingSection =
    requestedSection === "explore-options" ||
    requestedSection === "strategy" ||
    requestedSection === "workbooks" ||
    requestedSection === "proposals" ||
    requestedSection === "outreach" ||
    requestedSection === "overview"
      ? requestedSection === "strategy"
        ? "explore-options"
        : requestedSection
      : "overview";

  const {
    listings,
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
    isHydrated,
    updateListing,
    createWorkbookForListing,
    generateExploreOptionsForListing,
    openOutreachForRow,
    updateOutreachTarget,
    generateOutreachEmail,
    sendOutreachEmail,
    loadMoreOutreachContacts,
    deleteListing,
  } = useWorkspaceData();

  const [activeExploreTab, setActiveExploreTab] = useState("summary");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");

  const listing = useMemo(() => {
    if (!listings.length) return null;

    return (
      listings.find((item) => item.addressLine1 === decodedAddress) ??
      listings.find((item) => item.addressLine1.toLowerCase() === decodedAddress.toLowerCase()) ??
      null
    );
  }, [decodedAddress, listings]);

  const listingWorkbooks = useMemo(
    () => (listing ? workbooks.filter((workbook) => workbook.listingId === listing.id) : []),
    [listing, workbooks],
  );

  const activeWorkbook = useMemo(
    () => listingWorkbooks.find((workbook) => workbook.id === activeWorkbookId) ?? listingWorkbooks[0] ?? null,
    [listingWorkbooks, activeWorkbookId],
  );

  const listingOutreachTargets = useMemo(
    () => (listing ? outreachTargets.filter((target) => target.listingId === listing.id) : []),
    [listing, outreachTargets],
  );

  const activeOutreachTarget = useMemo(
    () => listingOutreachTargets.find((target) => target.id === activeOutreachTargetId) ?? listingOutreachTargets[0] ?? null,
    [listingOutreachTargets, activeOutreachTargetId],
  );

  const selectedOutreachContact = activeOutreachTarget
    ? activeOutreachTarget.contacts.find((contact) => contact.id === activeOutreachTarget.selectedContactId) ??
      activeOutreachTarget.contacts[0] ??
      null
    : null;

  useEffect(() => {
    if (!activeWorkbook || activeWorkbook.id === activeWorkbookId) return;
    setActiveWorkbookId(activeWorkbook.id);
  }, [activeWorkbook, activeWorkbookId, setActiveWorkbookId]);

  useEffect(() => {
    if (!activeOutreachTarget || activeOutreachTarget.id === activeOutreachTargetId) return;
    setActiveOutreachTargetId(activeOutreachTarget.id);
  }, [activeOutreachTarget, activeOutreachTargetId, setActiveOutreachTargetId]);

  useEffect(() => {
    const scenarios = listing ? exploreOptionsByListing[listing.id]?.analysis.scenarios ?? [] : [];
    if (!scenarios.length) {
      setActiveExploreTab("summary");
      return;
    }
    if (activeExploreTab === "summary") return;
    if (!scenarios.some((scenario) => scenario.id === activeExploreTab)) {
      setActiveExploreTab("summary");
    }
  }, [activeExploreTab, exploreOptionsByListing, listing]);

  useEffect(() => {
    if (!listing || isEditingTitle) return;
    setTitleDraft(getListingDisplayTitle(listing));
  }, [isEditingTitle, listing]);

  const updateSectionInUrl = useCallback(
    (section: ListingSection) => {
      const nextParams = new URLSearchParams(searchParams.toString());
      if (section === "overview") {
        nextParams.delete("section");
      } else {
        nextParams.set("section", section);
      }

      const query = nextParams.toString();
      router.replace(query ? `${pathname}?${query}` : pathname);
    },
    [pathname, router, searchParams],
  );

  const handleCreateWorkbook = useCallback(async () => {
    if (!listing) return;

    const workbook = await createWorkbookForListing(listing);
    if (!workbook) return;
    setActiveWorkbookId(workbook.id);
    updateSectionInUrl("workbooks");
  }, [createWorkbookForListing, listing, setActiveWorkbookId, updateSectionInUrl]);

  const handleExploreOptions = useCallback(async () => {
    if (!listing) return;

    updateSectionInUrl("explore-options");
    const created = await generateExploreOptionsForListing(listing);
    if (!created) return;
    setActiveExploreTab("summary");
  }, [generateExploreOptionsForListing, listing, updateSectionInUrl]);

  const handleSaveOverview = useCallback(
    ({ summary, highlights, notes }: { summary: string; highlights: string[]; notes: string[] }) => {
      if (!listing) return;

      const listingLabel = getListingDisplayTitle(listing);
      updateListing(
        listing.id,
        (current) => ({
          ...current,
          listingSummary: summary || undefined,
          features: mergeFeatureRecords(current.features, highlights),
          disclosures: mergeDisclosureRecords(current.disclosures, notes),
          constraints: notes,
        }),
        `Overview updated for ${listingLabel}.`,
      );
    },
    [listing, updateListing],
  );

  const handleSaveTitle = useCallback(() => {
    if (!listing) return;

    const trimmedTitle = titleDraft.trim().slice(0, LISTING_TITLE_MAX_LENGTH);
    const addressTitle = listing.addressLine1?.trim() || "";
    const nextCustomTitle = trimmedTitle && trimmedTitle !== addressTitle ? trimmedTitle : undefined;

    updateListing(
      listing.id,
      (current) => ({
        ...current,
        customTitle: nextCustomTitle,
      }),
      "Title updated.",
    );
    setIsEditingTitle(false);
  }, [listing, titleDraft, updateListing]);

  const handleDelete = useCallback(() => {
    if (!listing) return;
    const shouldDelete = window.confirm(`Delete ${getListingDisplayTitle(listing)}?`);
    if (!shouldDelete) return;
    deleteListing(listing.id);
    router.push("/workspace");
  }, [deleteListing, listing, router]);

  if (!isHydrated) {
    return (
      <WorkspaceShell>
        <section className="rounded-[2rem] border bg-card px-6 py-10 shadow-sm">Loading listing...</section>
      </WorkspaceShell>
    );
  }

  if (!listing) {
    return (
      <WorkspaceShell>
        <EmptyState
          title="Listing not found"
          description="This listing is no longer in the workspace or the address path has changed."
          action={
            <Button asChild variant="outline">
              <a href="/workspace">Back to listings</a>
            </Button>
          }
        />
      </WorkspaceShell>
    );
  }

  const primarySpace = listing.spaces[0];
  const buildingType = primarySpace?.spaceUsePrimary ?? listing.propertyClass ?? "Commercial";
  const sizeValue = primarySpace?.sizeSf ?? listing.squareFootage;
  const workbookCount = listingWorkbooks.length;
  const proposalCount = 0;
  const outreachCount = listingOutreachTargets.length;
  const listingResearchResult = listingResearchByListing[listing.id] ?? null;
  const listingResearchLoading = listingResearchLoadingListingId === listing.id;
  const exploreOptionsResult = exploreOptionsByListing[listing.id] ?? null;
  const exploreOptionsLoading = exploreOptionsLoadingListingId === listing.id;

  const sectionTabs = [
    { id: "overview", label: "Overview", count: undefined },
    { id: "explore-options", label: "Options", count: exploreOptionsResult?.analysis.scenarios.length },
    { id: "workbooks", label: "Workbooks", count: workbookCount },
    { id: "proposals", label: "Proposals", count: proposalCount },
    { id: "outreach", label: "Outreach", count: outreachCount },
  ] as const satisfies ReadonlyArray<{ id: ListingSection; label: string; count?: number }>;

  const title = getListingDisplayTitle(listing);
  const subtitle = [listing.city, [listing.state, listing.postalCode].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const description =
    listing.locationDescription || "No location notes yet. Add source detail or run parsing to sharpen the context.";
  const listingModeLabel = formatListingMode(listing);
  const meta = [
    buildingType,
    listingModeLabel,
    formatLastEdited(listing) !== "—" ? `Updated ${formatLastEdited(listing)}` : "",
    listingResearchLoading
      ? "Research running..."
      : listingResearchResult
        ? `Research ready · ${listingResearchResult.analysis.confidence} confidence`
        : "",
    exploreOptionsLoading
      ? "Options running..."
      : exploreOptionsResult
        ? `Options ready · ${exploreOptionsResult.analysis.scenarios.length} scenarios`
        : "",
  ].filter(Boolean);

  const notices = [
    listingInfoMessage ? { tone: "info" as const, message: listingInfoMessage } : null,
    workbookError ? { tone: "error" as const, message: workbookError } : null,
    listingResearchError ? { tone: "error" as const, message: listingResearchError } : null,
    exploreOptionsError ? { tone: "error" as const, message: exploreOptionsError } : null,
    outreachError ? { tone: "error" as const, message: outreachError } : null,
  ].filter((notice): notice is { tone: "info" | "error"; message: string } => Boolean(notice));

  return (
    <WorkspaceShell>
      <div className="grid gap-6">
        <ListingPageHeader
          title={title}
          subtitle={subtitle || "Address details unavailable"}
          description={description}
          meta={meta}
          stats={
            <ListingStats
              cards={[
                { label: "Available size", value: formatSquareFeet(sizeValue) },
                { label: "Lot size", value: formatLotSize(listing.lotSizeAcres) },
                { label: "Property type", value: buildingType },
                { label: "Market score", value: listingResearchLoading ? "Running..." : formatScore(listingResearchResult?.analysis.marketScore) },
                { label: "Listing score", value: listingResearchLoading ? "Running..." : formatScore(listingResearchResult?.analysis.listingScore) },
              ]}
            />
          }
          titleDraft={titleDraft}
          isEditingTitle={isEditingTitle}
          onTitleDraftChange={(value) => setTitleDraft(value.slice(0, LISTING_TITLE_MAX_LENGTH))}
          onStartEditingTitle={() => setIsEditingTitle(true)}
          onCancelTitleEdit={() => {
            setTitleDraft(getListingDisplayTitle(listing));
            setIsEditingTitle(false);
          }}
          onSaveTitle={handleSaveTitle}
          onCreateWorkbook={() => void handleCreateWorkbook()}
          onExploreOptions={() => void handleExploreOptions()}
          onDelete={handleDelete}
          creatingWorkbook={creatingWorkbookListingId === listing.id}
          exploringOptions={exploreOptionsLoading}
          notices={notices}
        />

        <ListingSectionTabs sections={sectionTabs} activeSection={activeSection} onSelectSection={updateSectionInUrl} />

        {activeSection === "overview" ? <OverviewPanel listing={listing} onSaveOverview={handleSaveOverview} /> : null}

        {activeSection === "explore-options" ? (
          <ExploreOptionsPanel
            exploreOptionsResult={exploreOptionsResult}
            loading={exploreOptionsLoading}
            activeTabId={activeExploreTab}
            onSelectTab={setActiveExploreTab}
            onGenerate={() => void handleExploreOptions()}
          />
        ) : null}

        {activeSection === "workbooks" ? (
          <WorkbookPanel
            listingWorkbooks={listingWorkbooks}
            activeWorkbook={activeWorkbook}
            onSelectWorkbook={setActiveWorkbookId}
            onExportWorkbook={exportWorkbookCsv}
            onOpenOutreach={(row) => {
              if (!activeWorkbook) return;
              openOutreachForRow(activeWorkbook, row);
              updateSectionInUrl("outreach");
            }}
          />
        ) : null}

        {activeSection === "proposals" ? (
          <Card data-surface>
            <CardContent className="grid gap-3 p-6">
              <h2 className="text-lg font-semibold tracking-tight">Proposals</h2>
              <p className="text-sm text-muted-foreground">
                {exploreOptionsResult
                  ? "Proposal framing will build from the selected option path next."
                  : "Explore options first to generate the inputs for proposal writing."}
              </p>
            </CardContent>
          </Card>
        ) : null}

        {activeSection === "outreach" ? (
          <OutreachPanel
            listing={listing}
            listingOutreachTargets={listingOutreachTargets}
            activeOutreachTarget={activeOutreachTarget}
            selectedOutreachContact={selectedOutreachContact}
            onSelectTarget={setActiveOutreachTargetId}
            onUpdateTarget={updateOutreachTarget}
            onGenerateEmail={(targetId) => void generateOutreachEmail(targetId)}
            onSendEmail={(targetId) => void sendOutreachEmail(targetId)}
            onLoadMoreContacts={(targetId) => void loadMoreOutreachContacts(targetId)}
          />
        ) : null}
      </div>
    </WorkspaceShell>
  );
}

function formatSquareFeet(value?: number): string {
  return value != null ? `${value.toLocaleString()} SF` : "Not provided";
}

function formatLotSize(value?: number): string {
  return value != null ? `${value.toLocaleString()} AC` : "Not provided";
}

function formatListingMode(listing: ListingRecord): string {
  if (listing.listingType === "FOR_LEASE") return "For lease";
  if (listing.listingType === "FOR_SALE") return "For sale";
  if (listing.listingType === "BOTH") return "For lease or sale";
  return "";
}

function formatScore(value?: number): string {
  return typeof value === "number" ? `${value}/100` : "Not provided";
}

function mergeFeatureRecords(existing: ListingRecord["features"], items: string[]): ListingRecord["features"] {
  const unused = [...existing];

  return items.map((item) => {
    const matchIndex = unused.findIndex((feature) => normalizeEditableItem(feature.featureValueText ?? feature.sourceText ?? "") === normalizeEditableItem(item));
    if (matchIndex < 0) {
      return { featureValueText: item, sourceText: item };
    }

    const [match] = unused.splice(matchIndex, 1);
    return {
      ...match,
      featureValueText: item,
      sourceText: match.sourceText ?? item,
    };
  });
}

function mergeDisclosureRecords(existing: ListingRecord["disclosures"], items: string[]): ListingRecord["disclosures"] {
  const unused = [...existing];

  return items.map((item) => {
    const matchIndex = unused.findIndex((disclosure) => normalizeEditableItem(disclosure.text) === normalizeEditableItem(item));
    if (matchIndex < 0) {
      return { text: item, sourceText: item };
    }

    const [match] = unused.splice(matchIndex, 1);
    return {
      ...match,
      text: item,
      sourceText: match.sourceText ?? item,
    };
  });
}

function normalizeEditableItem(value: string): string {
  return value.trim().toLowerCase();
}
