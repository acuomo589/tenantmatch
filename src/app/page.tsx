"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ComponentType, CSSProperties } from "react";
import { BookOpen, Building2, ChevronLeft, Menu, MessageSquare, SquarePen, Upload, Search } from "lucide-react";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry } from "ag-grid-community";
import type { ColDef } from "ag-grid-community";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select as UiSelect } from "@/components/ui/select";
import type { WorkbookRow } from "@/lib/workbookCsv";

type PrimaryTab = "listings" | "workbooks" | "proposals" | "outreach";
type AddMode = "chooser" | "upload" | "search" | "details";

type ListingRecord = {
  id: string;
  title: string;
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

type ListingSpaceRecord = {
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

type ListingFeatureRecord = {
  featureKey?: string;
  featureValueNumber?: number;
  featureValueText?: string;
  unit?: string;
  sourceText?: string;
  tagsJson?: unknown;
  confidence?: number;
};

type ListingDisclosureRecord = {
  text: string;
  sourceText?: string;
  source?: "UPLOAD" | "SEARCH" | "PARSED";
  isMaterial?: boolean;
  tagsJson?: unknown;
  confidence?: number;
};

type ListingContactRecord = {
  name: string;
  role?: string;
  company?: string;
  phone?: string;
  email?: string;
};

type ListingTenantRecord = {
  tenantName: string;
  industry?: string;
  floorLabel?: string;
};

type SearchCandidate = {
  id: string;
  label: string;
  listing: ListingRecord;
};

type WorkbookResult = {
  id: string;
  listingId: string;
  listingTitle: string;
  createdAt: string;
  csv: string;
  rows: WorkbookRow[];
};

ModuleRegistry.registerModules([AllCommunityModule]);

const WORKBOOK_COL_DEFS: ColDef<WorkbookRow>[] = [
  { field: "priority_rank", headerName: "Rank", width: 90, sortable: true, filter: true },
  { field: "business_name", headerName: "Business", minWidth: 220, flex: 1.2, sortable: true, filter: true },
  { field: "category", headerName: "Category", minWidth: 140, flex: 0.8, sortable: true, filter: true },
  { field: "city", headerName: "City", minWidth: 120, sortable: true, filter: true },
  { field: "state", headerName: "State", width: 90, sortable: true, filter: true },
  { field: "distance_miles", headerName: "Miles", width: 100, sortable: true, filter: true },
  { field: "tenant_fit_score_100", headerName: "Fit", width: 100, sortable: true, filter: true },
  { field: "move_probability_1_10", headerName: "Move", width: 100, sortable: true, filter: true },
  { field: "fit_summary", headerName: "Fit Summary", minWidth: 360, flex: 2, sortable: false, filter: true },
  { field: "owner_contact_name", headerName: "Owner Contact", minWidth: 170, flex: 1, sortable: true, filter: true },
];

const ATTOM_COMMERCIAL_PROPERTY_TYPES = [
  "COMMERCIAL (NEC)",
  "COMMERCIAL BUILDING",
  "OFFICE BUILDING",
  "RETAIL TRADE",
  "INDUSTRIAL (NEC)",
] as const;

const ATTOM_COMMERCIAL_PAGE_SIZE = 100;
const ATTOM_COMMERCIAL_MAX_PAGES_PER_TYPE = 3;

const PRIMARY_TABS: Array<{ id: PrimaryTab; label: string; icon: ComponentType<{ size?: number; strokeWidth?: number }> }> = [
  { id: "listings", label: "Listings", icon: Building2 },
  { id: "workbooks", label: "Workbooks", icon: BookOpen },
  { id: "proposals", label: "Proposals", icon: SquarePen },
  { id: "outreach", label: "Outreach / Inbox", icon: MessageSquare },
];

export default function HomePage() {
  const [primaryTab, setPrimaryTab] = useState<PrimaryTab>("listings");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [addMode, setAddMode] = useState<AddMode | null>(null);
  const [listings, setListings] = useState<ListingRecord[]>([]);
  const [workbooks, setWorkbooks] = useState<WorkbookResult[]>([]);
  const [activeWorkbookId, setActiveWorkbookId] = useState<string | null>(null);
  const [creatingWorkbookListingId, setCreatingWorkbookListingId] = useState<string | null>(null);
  const [workbookError, setWorkbookError] = useState<string | null>(null);

  const updateListing = (listingId: string, updater: (listing: ListingRecord) => ListingRecord) => {
    setListings((prev) => prev.map((listing) => (listing.id === listingId ? updater(listing) : listing)));
  };

  const updatePrimarySpace = (listingId: string, patch: Partial<ListingSpaceRecord>) => {
    updateListing(listingId, (listing) => {
      const currentPrimary = listing.spaces[0] ?? {};
      const nextPrimary: ListingSpaceRecord = { ...currentPrimary, ...patch };
      return {
        ...listing,
        spaces: listing.spaces.length ? [nextPrimary, ...listing.spaces.slice(1)] : [nextPrimary],
      };
    });
  };

  const createWorkbookForListing = async (listing: ListingRecord) => {
    setWorkbookError(null);
    setCreatingWorkbookListingId(listing.id);
    try {
      const response = await fetch("/api/workbooks/from-listing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listing }),
      });
      const payload = (await response.json()) as { error?: string; csv?: string; rows?: WorkbookRow[] };
      if (!response.ok || !payload.csv || !payload.rows) {
        throw new Error(payload.error ?? "Workbook generation failed.");
      }

      const workbook: WorkbookResult = {
        id: `workbook_${Math.random().toString(36).slice(2, 10)}`,
        listingId: listing.id,
        listingTitle: listing.title,
        createdAt: new Date().toISOString(),
        csv: payload.csv,
        rows: payload.rows,
      };
      setWorkbooks((prev) => [workbook, ...prev]);
      setActiveWorkbookId(workbook.id);
      setPrimaryTab("workbooks");
    } catch (error) {
      setWorkbookError(error instanceof Error ? error.message : "Workbook generation failed.");
    } finally {
      setCreatingWorkbookListingId(null);
    }
  };

  const exportWorkbookCsv = (workbook: WorkbookResult) => {
    const blob = new Blob([workbook.csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${workbook.listingTitle.replace(/[^a-z0-9]+/gi, "_").toLowerCase()}_workbook.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const activeWorkbook = workbooks.find((workbook) => workbook.id === activeWorkbookId) ?? workbooks[0] ?? null;

  return (
    <main className={`app-shell ${sidebarCollapsed ? "collapsed" : ""}`}>
      <aside className="primary-sidebar">
        <div className="sidebar-top">
          {!sidebarCollapsed ? <span className="sidebar-brand">Timpani</span> : <span />}
          <button className="icon-btn" onClick={() => setSidebarCollapsed((prev) => !prev)}>
            {sidebarCollapsed ? <Menu size={16} strokeWidth={2} /> : <ChevronLeft size={16} strokeWidth={2} />}
          </button>
        </div>

        <nav className="sidebar-nav">
          {PRIMARY_TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                className={`nav-item ${primaryTab === tab.id ? "active" : ""}`}
                onClick={() => setPrimaryTab(tab.id)}
                title={tab.label}
              >
                <span className="nav-icon">
                  <Icon size={16} strokeWidth={2} />
                </span>
                {!sidebarCollapsed ? <span>{tab.label}</span> : null}
              </button>
            );
          })}
        </nav>
      </aside>

      <section className="app-main" style={{ minHeight: "100vh" }}>
        {primaryTab === "listings" ? (
          listings.length === 0 ? (
            <section style={{ minHeight: "calc(100vh - 28px)", display: "grid", placeItems: "center" }}>
              <button className="btn" onClick={() => setAddMode("chooser")}>
                Add Listing
              </button>
            </section>
          ) : (
            <>
              <section style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <strong>Listings</strong>
                <Button variant="outline" onClick={() => setAddMode("chooser")}>Add Listing</Button>
              </section>
              <section className="card" style={{ padding: 16 }}>
              <div style={{ display: "grid", gap: 16 }}>
                {listings.map((listing) => {
                  const primarySpace = listing.spaces[0];
                  const sizeValue = primarySpace?.sizeSf ?? listing.squareFootage;
                  const useValue = primarySpace?.spaceUsePrimary ?? listing.propertyClass ?? "Retail";
                  const listingTypeLabel =
                    listing.listingType === "FOR_LEASE"
                      ? "For Lease"
                      : listing.listingType === "FOR_SALE"
                        ? "For Sale"
                        : listing.listingType === "BOTH"
                          ? "For Lease / Sale"
                          : "Listing";
                  const locationLine = [listing.city, listing.state].filter(Boolean).join(", ");

                  return (
                    <Card
                      key={listing.id}
                      className="overflow-hidden"
                    >
                      <div
                        style={{
                          height: 220,
                          background: listing.heroImageUrl
                            ? `linear-gradient(rgba(15,23,42,0.25), rgba(15,23,42,0.25)), url(${listing.heroImageUrl}) center/cover no-repeat`
                            : "linear-gradient(135deg, #0a2540 0%, #1d4ed8 65%, #93c5fd 100%)",
                        }}
                      />

                      <CardContent style={{ display: "grid", gap: 14, padding: 18 }}>
                        <header>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                            <Badge>{listingTypeLabel}</Badge>
                            {primarySpace?.availableNow ? <Badge variant="success">Available Now</Badge> : null}
                          </div>
                          <MetricEditor
                            label="Address"
                            value={listing.addressLine1}
                            onChange={(next) =>
                              updateListing(listing.id, (current) => ({ ...current, addressLine1: next, title: next || current.title }))
                            }
                            placeholder="24 Jolma Road"
                          />
                          <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                            <MetricEditor
                              label="Location"
                              value={locationLine}
                              onChange={(next) => {
                                const [city = "", state = ""] = next.split(",").map((part) => part.trim());
                                updateListing(listing.id, (current) => ({ ...current, city, state }));
                              }}
                              placeholder="Worcester, MA"
                            />
                            <MetricEditor
                              label="Location description"
                              value={listing.locationDescription ?? ""}
                              onChange={(next) => updateListing(listing.id, (current) => ({ ...current, locationDescription: next }))}
                              placeholder="Immediate Access to I-90 & Route 12"
                            />
                          </div>
                        </header>

                        <section style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
                          <MetricEditor
                            label="Total Size"
                            value={sizeValue != null ? `${sizeValue}` : ""}
                            onChange={(next) => {
                              const parsed = toNumber(next.replace(/[^\d.]/g, ""));
                              updatePrimarySpace(listing.id, { sizeSf: parsed });
                              updateListing(listing.id, (current) => ({ ...current, squareFootage: parsed }));
                            }}
                            placeholder="45300"
                          />
                          <MetricEditor
                            label="Lot Size (AC)"
                            value={listing.lotSizeAcres != null ? String(listing.lotSizeAcres) : ""}
                            onChange={(next) => {
                              const parsed = toNumber(next.replace(/[^\d.]/g, ""));
                              updateListing(listing.id, (current) => ({ ...current, lotSizeAcres: parsed }));
                            }}
                            placeholder="2.87"
                          />
                          <MetricSelect
                            label="Property Type"
                            value={useValue}
                            options={["Retail", "Office", "Industrial", "Restaurant / Hospitality", "Mixed-use", "Medical", "Other"]}
                            onChange={(next) => {
                              updatePrimarySpace(listing.id, { spaceUsePrimary: next });
                              updateListing(listing.id, (current) => ({ ...current, propertyClass: next }));
                            }}
                          />
                        </section>

                        <section style={{ display: "grid", gap: 8 }}>
                          <div style={sectionLabelStyle}>Property Highlights</div>
                          <div style={{ display: "grid", gap: 8 }}>
                            {listing.features.map((feature, idx) => (
                              <div key={`${listing.id}_feature_edit_${idx}`} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
                                <Input
                                  value={feature.featureValueText ?? feature.sourceText ?? ""}
                                  onChange={(event) => {
                                    const next = event.target.value;
                                    updateListing(listing.id, (current) => ({
                                      ...current,
                                      features: current.features.map((item, fIdx) =>
                                        fIdx === idx ? { ...item, featureValueText: next, sourceText: next } : item,
                                      ),
                                    }));
                                  }}
                                />
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() =>
                                    updateListing(listing.id, (current) => ({
                                      ...current,
                                      features: current.features.filter((_, fIdx) => fIdx !== idx),
                                    }))
                                  }
                                >
                                  Remove
                                </Button>
                              </div>
                            ))}
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() =>
                                updateListing(listing.id, (current) => ({
                                  ...current,
                                  features: [...current.features, { featureValueText: "", sourceText: "" }],
                                }))
                              }
                            >
                              + Add Highlight
                            </Button>
                          </div>
                        </section>

                        <section style={{ display: "grid", gap: 8 }}>
                          <div style={sectionLabelStyle}>Disclosures</div>
                          <div style={{ display: "grid", gap: 8 }}>
                            {listing.disclosures.map((disclosure, idx) => (
                              <div key={`${listing.id}_disclosure_edit_${idx}`} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
                                <Input
                                  value={disclosure.text}
                                  onChange={(event) => {
                                    const next = event.target.value;
                                    updateListing(listing.id, (current) => ({
                                      ...current,
                                      disclosures: current.disclosures.map((item, dIdx) =>
                                        dIdx === idx ? { ...item, text: next, sourceText: next } : item,
                                      ),
                                    }));
                                  }}
                                />
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() =>
                                    updateListing(listing.id, (current) => ({
                                      ...current,
                                      disclosures: current.disclosures.filter((_, dIdx) => dIdx !== idx),
                                      constraints: current.disclosures.filter((_, dIdx) => dIdx !== idx).map((x) => x.text),
                                    }))
                                  }
                                >
                                  Remove
                                </Button>
                              </div>
                            ))}
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() =>
                                updateListing(listing.id, (current) => ({
                                  ...current,
                                  disclosures: [...current.disclosures, { text: "", source: "PARSED", isMaterial: true }],
                                }))
                              }
                            >
                              + Add Disclosure
                            </Button>
                          </div>
                        </section>

                        <section style={{ display: "grid", gap: 8 }}>
                          <div style={sectionLabelStyle}>Listing Summary</div>
                          <Textarea
                            rows={4}
                            value={listing.listingSummary ?? ""}
                            onChange={(event) => updateListing(listing.id, (current) => ({ ...current, listingSummary: event.target.value }))}
                          />
                        </section>

                        <section style={{ display: "flex", justifyContent: "flex-end" }}>
                          <Button
                            onClick={() => createWorkbookForListing(listing)}
                            disabled={creatingWorkbookListingId === listing.id}
                          >
                            {creatingWorkbookListingId === listing.id ? "Creating Workbook..." : "Create Workbook"}
                          </Button>
                        </section>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>
            {workbookError ? <div style={{ color: "#b91c1c", fontSize: 12, marginTop: 10 }}>{workbookError}</div> : null}
            </>
          )
        ) : null}

        {primaryTab === "workbooks" ? (
          <section className="card" style={{ padding: 16, display: "grid", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <strong>Workbooks</strong>
              <div style={{ display: "flex", gap: 8 }}>
                {activeWorkbook ? (
                  <>
                    <UiSelect
                      value={activeWorkbook.id}
                      onChange={(event) => setActiveWorkbookId(event.target.value)}
                      style={{ minWidth: 260 }}
                    >
                      {workbooks.map((workbook) => (
                        <option key={workbook.id} value={workbook.id}>
                          {workbook.listingTitle} · {new Date(workbook.createdAt).toLocaleString()}
                        </option>
                      ))}
                    </UiSelect>
                    <Button variant="outline" onClick={() => exportWorkbookCsv(activeWorkbook)}>Export CSV</Button>
                  </>
                ) : null}
              </div>
            </div>

            {activeWorkbook ? (
              <div className="ag-theme-quartz" style={{ width: "100%", height: 580 }}>
                <AgGridReact
                  rowData={activeWorkbook.rows}
                  columnDefs={WORKBOOK_COL_DEFS}
                  pagination
                  paginationPageSize={25}
                  animateRows
                />
              </div>
            ) : (
              <div style={{ color: "#64748b", fontSize: 13 }}>
                No workbooks yet. Create one from a listing card.
              </div>
            )}
          </section>
        ) : null}
        {primaryTab === "proposals" ? <section /> : null}
        {primaryTab === "outreach" ? <section /> : null}

        {addMode ? (
          <AddListingModal
            mode={addMode}
            onClose={() => setAddMode(null)}
            onChangeMode={setAddMode}
            onAdd={(items) => {
              setListings((prev) => [...prev, ...items.map(enrichListingForCard)]);
              setAddMode(null);
            }}
            onParseError={(message) => setWorkbookError(message)}
          />
        ) : null}
      </section>
    </main>
  );
}

function AddListingModal({
  mode,
  onClose,
  onChangeMode,
  onAdd,
  onParseError,
}: {
  mode: AddMode;
  onClose: () => void;
  onChangeMode: (mode: AddMode) => void;
  onAdd: (items: ListingRecord[]) => void;
  onParseError: (message: string | null) => void;
}) {
  return (
    <div className="modal-backdrop">
      <div className="modal card" style={{ width: 560 }}>
        {mode === "chooser" ? (
          <div style={{ display: "grid", gap: 10 }}>
            <h3 style={{ margin: 0 }}>Add Listing</h3>
            <button className="btn secondary" onClick={() => onChangeMode("upload")}>
              <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                <Upload size={14} /> Upload CSV
              </span>
            </button>
            <button className="btn secondary" onClick={() => onChangeMode("search")}>
              <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                <Search size={14} /> Search Address API
              </span>
            </button>
            <button className="btn secondary" onClick={() => onChangeMode("details")}>
              Submit Listing Details
            </button>
            <div>
              <button className="btn" onClick={onClose}>Close</button>
            </div>
          </div>
        ) : null}

        {mode === "upload" ? <UploadCsvPanel onBack={() => onChangeMode("chooser")} onAdd={onAdd} /> : null}
        {mode === "search" ? <SearchPanel onBack={() => onChangeMode("chooser")} onAdd={onAdd} /> : null}
        {mode === "details" ? <ListingDetailsPanel onBack={() => onChangeMode("chooser")} onAdd={onAdd} onParseError={onParseError} /> : null}
      </div>
    </div>
  );
}

function ListingDetailsPanel({
  onBack,
  onAdd,
  onParseError,
}: {
  onBack: () => void;
  onAdd: (items: ListingRecord[]) => void;
  onParseError: (message: string | null) => void;
}) {
  const [rawInput, setRawInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <Textarea
        rows={14}
        placeholder="Add listing details"
        value={rawInput}
        onChange={(event) => setRawInput(event.target.value)}
      />
      {error ? <div style={{ color: "#b91c1c", fontSize: 12 }}>{error}</div> : null}
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <button className="btn secondary" onClick={onBack}>Back</button>
        <button
          className="btn"
          disabled={submitting}
          onClick={async () => {
            if (!rawInput.trim()) {
              setError("Please add listing details.");
              return;
            }
            setSubmitting(true);
            setError(null);
            onParseError(null);
            try {
              const response = await fetch("/api/listings/parse", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ rawText: rawInput }),
              });
              const payload = (await response.json()) as { error?: string; listing?: ListingRecord };
              if (response.ok && payload.listing) {
                onAdd([payload.listing]);
                return;
              }

              const fallback = parseListingDetailsToRecord(rawInput);
              if (!fallback) {
                throw new Error(payload.error ?? "Could not parse listing details.");
              }
              onAdd([fallback]);
              onParseError("AI parser unavailable. Used fallback parser for this listing.");
            } catch (parseError) {
              const message = parseError instanceof Error ? parseError.message : "Could not parse listing details.";
              setError(message);
              onParseError(message);
            } finally {
              setSubmitting(false);
            }
          }}
        >
          {submitting ? "Parsing..." : "Submit"}
        </button>
      </div>
    </div>
  );
}

function UploadCsvPanel({ onBack, onAdd }: { onBack: () => void; onAdd: (items: ListingRecord[]) => void }) {
  const [parsed, setParsed] = useState<ListingRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <h3 style={{ margin: 0 }}>Upload CSV</h3>
      <Input
        type="file"
        accept=".csv,text/csv"
        onChange={async (event) => {
          setError(null);
          const file = event.target.files?.[0];
          if (!file) return;
          try {
            const text = await file.text();
            const rows = text
              .split(/\r?\n/)
              .map((line) => line.trim())
              .filter(Boolean);
            if (!rows.length) {
              setParsed([]);
              return;
            }

            const withoutHeader = /^address/i.test(rows[0]) ? rows.slice(1) : rows;
            const listings = withoutHeader.map((line) => buildListingFromLine(line)).filter(Boolean) as ListingRecord[];
            setParsed(listings);
          } catch {
            setError("Could not read CSV.");
          }
        }}
      />
      {error ? <div style={{ color: "#b91c1c" }}>{error}</div> : null}
      {parsed.length ? <div style={{ fontSize: 12, color: "#475569" }}>{parsed.length} addresses ready.</div> : null}
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <button className="btn secondary" onClick={onBack}>Back</button>
        <button className="btn" disabled={!parsed.length} onClick={() => onAdd(parsed)}>
          Add {parsed.length || ""}
        </button>
      </div>
    </div>
  );
}

function SearchPanel({ onBack, onAdd }: { onBack: () => void; onAdd: (items: ListingRecord[]) => void }) {
  const [query, setQuery] = useState("");
  const [commercialOnly, setCommercialOnly] = useState(true);
  const [searchResults, setSearchResults] = useState<SearchCandidate[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestSeq = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      setSearchResults([]);
      setError(null);
      return;
    }

    const timer = setTimeout(async () => {
      const seq = ++requestSeq.current;
      setSearching(true);
      setError(null);
      try {
        const queryParams = toAttomSearchParams(q);
        const fetchAttomAddress = async (params: Record<string, string>) => {
          const response = await fetch(`/api/attom/property-v1/address?${new URLSearchParams(params).toString()}`);
          const payload = (await response.json()) as AttomPropertySearchResponse | { error: string };
          if (!response.ok) {
            throw new Error("error" in payload ? payload.error : "ATTOM request failed");
          }
          return payload as AttomPropertySearchResponse;
        };

        let data: AttomPropertySearchResponse;

        if (commercialOnly && "postalcode" in queryParams) {
          const groupedResponses = await Promise.allSettled(
            ATTOM_COMMERCIAL_PROPERTY_TYPES.map((propertytype) =>
              (async () => {
                const first = await fetchAttomAddress({
                  ...queryParams,
                  propertytype,
                  page: "1",
                  pagesize: String(ATTOM_COMMERCIAL_PAGE_SIZE),
                });

                const total = Number(first.status?.total ?? first.property?.length ?? 0);
                const totalPages = Math.max(1, Math.ceil(total / ATTOM_COMMERCIAL_PAGE_SIZE));
                const pageLimit = Math.min(totalPages, ATTOM_COMMERCIAL_MAX_PAGES_PER_TYPE);

                if (pageLimit === 1) return [first];

                const rest = await Promise.all(
                  Array.from({ length: pageLimit - 1 }, (_, index) =>
                    fetchAttomAddress({
                      ...queryParams,
                      propertytype,
                      page: String(index + 2),
                      pagesize: String(ATTOM_COMMERCIAL_PAGE_SIZE),
                    }),
                  ),
                );

                return [first, ...rest];
              })(),
            ),
          );

          const seenIds = new Set<string>();
          const merged: NonNullable<AttomPropertySearchResponse["property"]> = [];

          for (const grouped of groupedResponses) {
            if (grouped.status !== "fulfilled") continue;
            for (const response of grouped.value) {
              for (const property of response.property ?? []) {
                const dedupeId = property.identifier?.attomId ?? property.address?.oneLine ?? property.address?.line1;
                if (!dedupeId || seenIds.has(dedupeId)) continue;
                seenIds.add(dedupeId);
                merged.push(property);
              }
            }
          }

          data = { property: merged };
        } else {
          data = await fetchAttomAddress({ ...queryParams, pagesize: "8" });
        }

        if (seq !== requestSeq.current) return;

        const next = normalizeAttomCandidates(data, false);
        setSearchResults(next);

        if (!next.length && /^\d{5}$/.test(q)) {
          setError("No listings found for that ZIP.");
        }
      } catch {
        if (seq !== requestSeq.current) return;
        setSearchResults([]);
        setError("No ATTOM results. Try ZIP (e.g. 02108) or full address format.");
      } finally {
        if (seq !== requestSeq.current) return;
        setSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query, commercialOnly]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const selectedCandidates = useMemo(
    () => searchResults.filter((candidate) => selectedSet.has(candidate.id)),
    [searchResults, selectedSet],
  );

  const sortedCandidates = useMemo(() => {
    const selectedTop = searchResults.filter((candidate) => selectedSet.has(candidate.id));
    const rest = searchResults.filter((candidate) => !selectedSet.has(candidate.id));
    return [...selectedTop, ...rest];
  }, [searchResults, selectedSet]);

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <h3 style={{ margin: 0 }}>Search Address API (ATTOM Property API)</h3>
      <Input
        placeholder="ZIP (02108) or full address (90 Broad St, New York NY 10004)"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, color: "#334155" }}>
        <input type="checkbox" checked={commercialOnly} onChange={(event) => setCommercialOnly(event.target.checked)} />
        Commercial only
      </label>

      {selectedCandidates.length ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {selectedCandidates.map((candidate) => (
            <span
              key={candidate.id}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: "#e2e8f0",
                color: "#0f172a",
                borderRadius: 999,
                padding: "4px 8px",
                fontSize: 12,
              }}
            >
              {candidate.label}
              <button
                onClick={() => setSelectedIds((prev) => prev.filter((id) => id !== candidate.id))}
                style={{ border: 0, background: "transparent", cursor: "pointer", padding: 0, lineHeight: 1 }}
                aria-label={`Remove ${candidate.label}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <div style={{ maxHeight: 220, overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: 8 }}>
        {sortedCandidates.map((candidate) => (
          <button
            key={candidate.id}
            className="btn secondary"
            style={{
              width: "100%",
              borderRadius: 0,
              border: 0,
              borderBottom: "1px solid #e2e8f0",
              textAlign: "left",
              background: selectedSet.has(candidate.id) ? "#dbeafe" : "#fff",
            }}
            onClick={() =>
              setSelectedIds((prev) =>
                prev.includes(candidate.id) ? prev.filter((id) => id !== candidate.id) : [...prev, candidate.id],
              )
            }
          >
            {candidate.label}
          </button>
        ))}
        {!sortedCandidates.length && !searching ? <div style={{ padding: 10, color: "#64748b" }}>Type 3+ chars to search.</div> : null}
        {searching ? <div style={{ padding: 10, color: "#64748b" }}>Searching ATTOM...</div> : null}
      </div>
      {error ? <div style={{ color: "#b91c1c", fontSize: 12 }}>{error}</div> : null}

      <div style={{ fontSize: 12, color: "#475569" }}>{selectedIds.length} addresses selected</div>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <button className="btn secondary" onClick={onBack}>Back</button>
        <button
          className="btn"
          disabled={!selectedIds.length}
          onClick={() => {
            const items = searchResults
              .filter((candidate) => selectedSet.has(candidate.id))
              .map((candidate) => candidate.listing);
            onAdd(items);
          }}
        >
          Add Selected
        </button>
      </div>
    </div>
  );
}

type AttomPropertySearchResponse = {
  status?: { total?: number; page?: number; pagesize?: number; msg?: string };
  property?: Array<{
    identifier?: { attomId?: string };
    address?: {
      oneLine?: string;
      line1?: string;
      line2?: string;
      locality?: string;
      countrySubd?: string;
      postal1?: string;
    };
    summary?: { propclass?: string; universalSize?: number };
    building?: { size?: { universalSize?: number; bldgsize?: number } };
    lot?: { lotSize2?: number };
  }>;
};

function toAttomSearchParams(q: string): Record<string, string> {
  const value = q.trim();

  if (/^\d{5}$/.test(value)) {
    return { postalcode: value };
  }

  const parts = value.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const [address1, ...rest] = parts;
    return { address1, address2: rest.join(", ") };
  }

  return { address: value };
}

function normalizeAttomCandidates(payload: AttomPropertySearchResponse, commercialOnly: boolean): SearchCandidate[] {
  const properties = payload.property ?? [];
  const mapped = properties.map((item, idx) => {
    const listing = listingFromAttomItem(item, idx);
    return {
      id: listing.id,
      label: formatListingAddress(listing),
      listing,
    };
  });

  if (!commercialOnly) return mapped;
  const filtered = mapped.filter((candidate) => isCommercialListing(candidate.listing));
  return filtered;
}

function isCommercialListing(listing: ListingRecord): boolean {
  const text = `${listing.propertyClass ?? ""} ${listing.title ?? ""}`.toLowerCase();
  if (!text.trim()) return true;
  return /(industrial|office|retail|commercial|medical|flex|mixed|warehouse|apartment|multifamily)/i.test(text);
}

function listingFromAttomItem(item: NonNullable<AttomPropertySearchResponse["property"]>[number], idx: number): ListingRecord {
  const address = item.address ?? {};
  const line1 = address.line1?.trim() || address.oneLine?.split(",")?.[0]?.trim() || "Unknown";
  const city = address.locality?.trim() || "";
  const state = address.countrySubd?.trim() || "";
  const postalCode = address.postal1?.trim() || "";

  const attomId = item.identifier?.attomId;
  const id = attomId ? `attom_${attomId}` : `attom_row_${idx}_${line1}_${postalCode}`;

  const squareFootage =
    item.summary?.universalSize ?? item.building?.size?.universalSize ?? item.building?.size?.bldgsize ?? item.lot?.lotSize2;
  const lotSizeSqft = item.lot?.lotSize2;

  return {
    id,
    title: line1,
    addressLine1: line1,
    addressLine2: address.line2?.trim(),
    city,
    state,
    postalCode,
    squareFootage: typeof squareFootage === "number" ? squareFootage : undefined,
    lotSizeAcres: typeof lotSizeSqft === "number" && lotSizeSqft > 0 ? Number((lotSizeSqft / 43560).toFixed(2)) : undefined,
    attomId,
    propertyClass: item.summary?.propclass,
    source: "ATTOM",
    listingType: "FOR_SALE",
    lifecycleStatus: "ACTIVE",
    spaces: [],
    disclosures: [],
    features: [],
    constraints: [],
    contacts: [],
    tenants: [],
  };
}

function buildListingFromLine(line: string): ListingRecord | null {
  const raw = line.trim();
  if (!raw) return null;

  const parts = raw.split(",").map((x) => x.trim()).filter(Boolean);
  const addressLine1 = parts[0] ?? raw;
  const city = parts[1] ?? "";
  let state = "";
  let postalCode = "";

  const trailing = parts[2] ?? "";
  const match = trailing.match(/^([A-Za-z]{2})\s*(\d{5})?/);
  if (match) {
    state = match[1]?.toUpperCase() ?? "";
    postalCode = match[2] ?? "";
  }

  return {
    id: `csv_${Math.random().toString(36).slice(2, 10)}`,
    title: addressLine1,
    addressLine1,
    city,
    state,
    postalCode,
    spaces: [],
    disclosures: [],
    features: [],
    constraints: [],
    contacts: [],
    tenants: [],
  };
}

function parseListingDetailsToRecord(text: string): ListingRecord | null {
  const raw = text.trim();
  if (!raw) return null;

  const sourceListingId = matchValue(raw, /Listing ID:\s*([^\n\r]+)/i);
  const listingType = inferListingType(raw);
  const dateOnMarket = matchValue(raw, /Date on Market:\s*([^\n\r]+)/i);
  const lastUpdatedAtSource = matchValue(raw, /Last Updated:\s*([^\n\r]+)/i);
  const addressCandidate =
    matchValue(raw, /Address:\s*([^\n\r]+)/i) ??
    matchValue(raw, /(\d+\s+[^\n\r,]+,\s*[^\n\r,]+,\s*[A-Z]{2}\s*\d{5})/);

  const parsedAddress = parseAddress(addressCandidate ?? "");
  const title = parsedAddress.addressLine1 ?? "Parsed Listing";

  const buildingSize = toNumber(matchValue(raw, /Building Size\s*([\d,]+)\s*SF/i)?.replace(/,/g, ""));
  const lotSizeAcres = toNumber(matchValue(raw, /([\d.]+)\s*AC\b/i));
  const rentalRate = toNumber(matchValue(raw, /Rental Rate\s*\$?([\d,.]+)\s*\/SF\/YR/i)?.replace(/,/g, ""));
  const spaces = parseLoopNetSpaces(raw);
  const features = parseLoopNetFeatures(raw);
  const disclosures = parseLoopNetDisclosures(raw);
  const constraints = disclosures.map((item) => item.text);
  const contacts = parseLoopNetContacts(raw);
  const tenants = parseLoopNetTenants(raw);
  const daysOnMarket = toDaysOnMarket(dateOnMarket);

  return {
    id: `details_${Math.random().toString(36).slice(2, 10)}`,
    title,
    addressLine1: parsedAddress.addressLine1 ?? "Unknown",
    city: parsedAddress.city ?? "",
    state: parsedAddress.state ?? "",
    postalCode: parsedAddress.postalCode ?? "",
    squareFootage: buildingSize,
    lotSizeAcres,
    rentalRatePerSfYr: rentalRate,
    sourceListingId,
    source: "LoopNet",
    listingType,
    lifecycleStatus: "ACTIVE",
    dateOnMarket,
    lastUpdatedAtSource,
    daysOnMarket,
    rawDetails: raw,
    spaces,
    disclosures,
    features,
    constraints,
    contacts,
    tenants,
  };
}

function parseLoopNetDisclosures(text: string): ListingDisclosureRecord[] {
  const out = new Set<string>();

  const zoning = matchValue(text, /Zoning\n([^\n\r]+)/i);
  if (zoning) out.add(`Zoning: ${zoning}`);

  const specialPermit = text.match(/special permit[^.\n]*/gi);
  specialPermit?.forEach((x) => out.add(x.trim()));

  const exclusions = text.match(/None of[^.\n]*\./gi);
  exclusions?.forEach((x) => out.add(x.trim()));

  if (/Upon Request/i.test(text)) out.add("Rental rate is upon request");

  return [...out].slice(0, 8).map((entry) => ({
    text: entry,
    sourceText: entry,
    source: "PARSED",
    isMaterial: true,
  }));
}

function toDaysOnMarket(dateText?: string): number | undefined {
  if (!dateText) return undefined;
  const parsed = new Date(dateText);
  if (Number.isNaN(parsed.getTime())) return undefined;

  const now = new Date();
  const startUtc = Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  const endUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.floor((endUtc - startUtc) / (1000 * 60 * 60 * 24));
  return diffDays >= 0 ? diffDays : 0;
}

function inferListingType(text: string): "FOR_LEASE" | "FOR_SALE" | "BOTH" | undefined {
  const hasLease = /For Lease/i.test(text);
  const hasSale = /For Sale/i.test(text);
  if (hasLease && hasSale) return "BOTH";
  if (hasLease) return "FOR_LEASE";
  if (hasSale) return "FOR_SALE";
  return undefined;
}

function parseLoopNetSpaces(text: string): ListingSpaceRecord[] {
  const spaces: ListingSpaceRecord[] = [];
  const rx = /([^\n\r]+)\nSize\n([^\n\r]+)\nTerm\n([^\n\r]+)\nRental Rate\n([^\n\r]+)\nSpace Use\n([^\n\r]+)\nBuild-Out\n([^\n\r]+)\nAvailable\n([^\n\r]+)/g;

  let match: RegExpExecArray | null;
  while ((match = rx.exec(text)) !== null) {
    const label = match[1]?.trim();
    const sizeRaw = match[2]?.trim();
    const termText = match[3]?.trim();
    const rentalRateDisplay = match[4]?.trim();
    const spaceUseRaw = match[5]?.trim();
    const buildOut = match[6]?.trim();
    const available = match[7]?.trim();

    const { min, max, single } = parseSfRange(sizeRaw);
    const rateNumeric = toNumber(rentalRateDisplay.match(/\$?([\d,.]+)/)?.[1]?.replace(/,/g, ""));
    const tags = spaceUseRaw.split(/[\/,&]/).map((x) => x.trim()).filter(Boolean);

    spaces.push({
      spaceLabel: label,
      floorLabel: label,
      sizeSf: single,
      minSizeSf: min,
      maxSizeSf: max,
      termText,
      rentalRatePerSfYr: rateNumeric,
      rentalRateDisplay,
      spaceUsePrimary: tags[0] ?? spaceUseRaw,
      spaceUseTags: tags,
      buildOut,
      availableDate: /^now$/i.test(available) ? undefined : available,
      availableNow: /^now$/i.test(available),
    });
  }

  return spaces;
}

function parseLoopNetFeatures(text: string): ListingFeatureRecord[] {
  const section = text.match(/Features\n([\s\S]*?)\nAll Available Space/i)?.[1] ?? "";
  const lines = section.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const features: ListingFeatureRecord[] = [];

  for (let i = 0; i < lines.length - 1; i += 2) {
    const key = lines[i];
    const value = lines[i + 1];
    if (!key || !value) continue;
    const num = toNumber(value.replace(/,/g, "").replace(/[’']/g, ""));
    features.push({
      featureKey: key,
      featureValueNumber: num,
      featureValueText: value,
      sourceText: `${key}: ${value}`,
      confidence: 0.82,
    });
  }

  return features;
}

function parseLoopNetContacts(text: string): ListingContactRecord[] {
  const section = text.match(/Contacts\n([\s\S]*?)\n\n\nListing ID:/i)?.[1] ?? "";
  const lines = section.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const deduped = [...new Set(lines)].filter((line) => line.length > 2 && !/^\(\d{3}\)/.test(line));

  const contacts: ListingContactRecord[] = deduped
    .filter((line) => !/LLC|Inc\.|Advisors|Portfolio|Message|Contact/i.test(line))
    .slice(0, 6)
    .map((name) => ({ name, role: "BROKER" }));

  const company = deduped.find((line) => /LLC|Inc\.|Advisors|Equity|Development|Real Estate/i.test(line));
  if (company && contacts.length) {
    contacts[0].company = company;
  }

  return contacts;
}

function parseLoopNetTenants(text: string): ListingTenantRecord[] {
  const section = text.match(/Select Tenants\n([\s\S]*?)\nMap/i)?.[1] ?? "";
  if (!section) return [];

  const lines = section
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !/^Floor$|^Tenant Name$|^Industry$/i.test(line));

  const tenants: ListingTenantRecord[] = [];
  for (let i = 0; i < lines.length; i += 3) {
    const floor = lines[i];
    const tenantName = lines[i + 1];
    const industry = lines[i + 2];
    if (!tenantName) continue;
    tenants.push({ tenantName, industry, floorLabel: floor });
  }
  return tenants;
}

function parseSfRange(value: string | undefined): { min?: number; max?: number; single?: number } {
  if (!value) return {};
  const cleaned = value.replace(/SF/gi, "").replace(/,/g, "").trim();
  const range = cleaned.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/);
  if (range) {
    const min = toNumber(range[1]);
    const max = toNumber(range[2]);
    return { min, max };
  }
  const single = toNumber(cleaned.match(/\d+(?:\.\d+)?/)?.[0]);
  return { single };
}

function parseAddress(value: string): { addressLine1?: string; city?: string; state?: string; postalCode?: string } {
  const trimmed = value.trim();
  if (!trimmed) return {};

  const m = trimmed.match(/^(.+?),\s*([^,]+),\s*([A-Z]{2})\s*(\d{5})?/i);
  if (!m) {
    return { addressLine1: trimmed };
  }

  return {
    addressLine1: m[1]?.trim(),
    city: m[2]?.trim(),
    state: m[3]?.toUpperCase().trim(),
    postalCode: m[4]?.trim(),
  };
}

function matchValue(text: string, regex: RegExp): string | undefined {
  const match = text.match(regex);
  return match?.[1]?.trim();
}

function enrichListingForCard(listing: ListingRecord): ListingRecord {
  const next = { ...listing };
  if (!next.heroImageUrl) {
    next.heroImageUrl = "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1400&q=80";
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
    .map((s) => s.trim())
    .find((sentence) => locationRegex.test(sentence));

  if (fromSummary) return fromSummary;

  const fromFeatures = listing.features
    .map((f) => f.featureValueText ?? f.sourceText ?? "")
    .find((value) => locationRegex.test(value));

  return fromFeatures || "Strategically located with strong regional access.";
}

function buildAutoSummary(listing: ListingRecord): string {
  const primarySpace = listing.spaces[0];
  const typeText = primarySpace?.spaceUsePrimary ?? listing.propertyClass ?? "commercial";
  const size = primarySpace?.sizeSf ?? listing.squareFootage;
  const location = [listing.city, listing.state].filter(Boolean).join(", ") || "the target market";
  const topFeature = listing.features.map((f) => f.featureValueText ?? f.sourceText).find(Boolean);
  const topDisclosure = listing.disclosures.map((d) => d.text).find(Boolean);

  const clauses = [
    `${listing.title || "This listing"} is a ${typeText.toLowerCase()} opportunity in ${location}`,
    size ? `with approximately ${size.toLocaleString()} SF available` : "with flexible occupancy potential",
    topFeature ? `and highlights including ${topFeature.toLowerCase()}` : undefined,
    topDisclosure ? `Key disclosure: ${topDisclosure}.` : "",
  ].filter(Boolean);

  return `${clauses.join(" ")}`.trim();
}

function formatListingAddress(listing: ListingRecord): string {
  return [listing.addressLine1, listing.addressLine2, [listing.city, listing.state, listing.postalCode].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
}

function formatNum(value?: number): string {
  return value == null ? "—" : value.toLocaleString();
}

function formatCurrency(value?: number): string {
  return value == null ? "—" : `$${value.toLocaleString()}`;
}

function formatRate(value?: number): string {
  return value == null ? "" : `$${value.toFixed(2)}/SF/YR`;
}

function formatSizeRange(min?: number, max?: number, single?: number): string {
  if (min != null && max != null) return `${min.toLocaleString()} - ${max.toLocaleString()} SF`;
  if (single != null) return `${single.toLocaleString()} SF`;
  return "—";
}

function toNumber(value: number | string | undefined): number | undefined {
  if (value == null) return undefined;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseRateNumber(value: string): number | undefined {
  const match = value.match(/\d+(?:\.\d+)?/);
  return toNumber(match?.[0]);
}

function badgeStyle(color = "#0f172a", background = "rgba(255,255,255,0.92)"): CSSProperties {
  return {
    color,
    background,
    border: "1px solid rgba(15,23,42,0.08)",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    padding: "6px 10px",
  };
}

const sectionLabelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "#64748b",
};

function Pill({ label }: { label: string }) {
  return (
    <span
      style={{
        background: "#eef2ff",
        color: "#1e293b",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        padding: "6px 10px",
      }}
    >
      {label}
    </span>
  );
}

function MetricBox({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 12, background: "#fcfdff" }}>
      <div style={{ color: "#64748b", marginBottom: 5, fontSize: 12 }}>{label}</div>
      <div style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.25 }}>{value}</div>
    </div>
  );
}

function MetricEditor({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 10, background: "#fcfdff", display: "grid", gap: 6 }}>
      <span style={{ color: "#64748b", fontSize: 12, fontWeight: 600 }}>{label}</span>
      <Input
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        style={{
          border: "1px solid #dbe3ef",
          borderRadius: 8,
          padding: "8px 10px",
          fontSize: 14,
          fontWeight: 600,
          color: "#0f172a",
          background: "#fff",
        }}
      />
    </label>
  );
}

function MetricSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 10, background: "#fcfdff", display: "grid", gap: 6 }}>
      <span style={{ color: "#64748b", fontSize: 12, fontWeight: 600 }}>{label}</span>
      <UiSelect
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </UiSelect>
    </label>
  );
}
