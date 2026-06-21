"use client";

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { FileUp, Search, Wand2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  formatListingAddress,
  type ListingContactRecord,
  type ListingDisclosureRecord,
  type ListingFeatureRecord,
  type ListingRecord,
  type ListingSpaceRecord,
  type ListingTenantRecord,
} from "@/lib/workspace-client";

export type AddMode = "chooser" | "upload" | "search" | "details";

type SearchCandidate = {
  id: string;
  label: string;
  listing: ListingRecord;
};

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

const ATTOM_COMMERCIAL_PROPERTY_TYPES = [
  "COMMERCIAL (NEC)",
  "COMMERCIAL BUILDING",
  "OFFICE BUILDING",
  "RETAIL TRADE",
  "INDUSTRIAL (NEC)",
] as const;

const ATTOM_COMMERCIAL_PAGE_SIZE = 100;
const ATTOM_COMMERCIAL_MAX_PAGES_PER_TYPE = 3;

function ModeCard({
  icon,
  title,
  description,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="grid gap-3 rounded-[1.5rem] border bg-card p-4 text-left shadow-xs transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-sm"
    >
      <span className="flex size-10 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground">{icon}</span>
      <div className="grid gap-1">
        <span className="text-sm font-semibold">{title}</span>
        <span className="text-sm leading-6 text-muted-foreground">{description}</span>
      </div>
    </button>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{children}</div>;
}

export function AddListingModal({
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
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="w-[min(96vw,42rem)] p-0">
        <div className="grid gap-0">
          <DialogHeader className="border-b px-6 py-5">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Listing intake</Badge>
              {mode !== "chooser" ? <Badge variant="outline">{mode}</Badge> : null}
            </div>
            <DialogTitle>Add listing</DialogTitle>
            <DialogDescription>Choose an intake path and turn raw listing information into a usable deal workspace.</DialogDescription>
          </DialogHeader>

          <div className="px-6 py-6">
        {mode === "chooser" ? (
          <div className="grid gap-4">
            <div className="grid gap-3 md:grid-cols-3">
              <ModeCard
                icon={<Wand2 className="size-4" />}
                title="Submit details"
                description="Paste a listing narrative and let the parser turn it into structured deal context."
                onClick={() => onChangeMode("details")}
              />
              <ModeCard
                icon={<FileUp className="size-4" />}
                title="Upload CSV"
                description="Bring in a list of addresses quickly from a lightweight CSV file."
                onClick={() => onChangeMode("upload")}
              />
              <ModeCard
                icon={<Search className="size-4" />}
                title="Search ATTOM"
                description="Search commercial properties by ZIP or full address and select what to add."
                onClick={() => onChangeMode("search")}
              />
            </div>
            <div className="flex justify-end">
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        ) : null}

        {mode === "upload" ? <UploadCsvPanel onBack={() => onChangeMode("chooser")} onAdd={onAdd} /> : null}
        {mode === "search" ? <SearchPanel onBack={() => onChangeMode("chooser")} onAdd={onAdd} /> : null}
        {mode === "details" ? (
          <ListingDetailsPanel onBack={() => onChangeMode("chooser")} onAdd={onAdd} onParseError={onParseError} />
        ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
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
  const [addressInput, setAddressInput] = useState("");
  const [rawInput, setRawInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  return (
    <div className="grid gap-5">
      <div className="grid gap-2">
        <FieldLabel>Address</FieldLabel>
        <Input
          placeholder="123 Main St, City, ST 12345"
          required
          value={addressInput}
          onChange={(event) => setAddressInput(event.target.value)}
        />
      </div>
      <div className="grid gap-2">
        <FieldLabel>Listing details</FieldLabel>
        <Textarea
          rows={14}
          placeholder="Paste broker remarks, owner notes, and listing details"
          value={rawInput}
          onChange={(event) => setRawInput(event.target.value)}
        />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button
          disabled={submitting}
          onClick={async () => {
            if (!addressInput.trim()) {
              setError("Please add a listing address.");
              return;
            }

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
                body: JSON.stringify({ rawText: rawInput, address: addressInput }),
              });
              const payload = (await response.json()) as { error?: string; listing?: ListingRecord };
              if (response.ok && payload.listing) {
                onAdd([payload.listing]);
                return;
              }

              const fallback = parseListingDetailsToRecord(rawInput, addressInput);
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
        </Button>
      </div>
    </div>
  );
}

function UploadCsvPanel({ onBack, onAdd }: { onBack: () => void; onAdd: (items: ListingRecord[]) => void }) {
  const [parsed, setParsed] = useState<ListingRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="grid gap-5">
      <div className="grid gap-1">
        <h3 className="text-lg font-semibold tracking-tight">Upload CSV</h3>
        <p className="text-sm text-muted-foreground">Add one or more listing addresses from a CSV file.</p>
      </div>
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
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {parsed.length ? <p className="text-sm text-muted-foreground">{parsed.length} addresses ready.</p> : null}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button disabled={!parsed.length} onClick={() => onAdd(parsed)}>
          Add {parsed.length || ""}
        </Button>
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
    <div className="grid gap-5">
      <div className="grid gap-1">
        <h3 className="text-lg font-semibold tracking-tight">Search ATTOM Property API</h3>
        <p className="text-sm text-muted-foreground">Search by ZIP or full address, then add the best candidates.</p>
      </div>
      <Input
        placeholder="ZIP (02108) or full address (90 Broad St, New York NY 10004)"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
        <input type="checkbox" checked={commercialOnly} onChange={(event) => setCommercialOnly(event.target.checked)} />
        Commercial only
      </label>

      {selectedCandidates.length ? (
        <div className="flex flex-wrap gap-2">
          {selectedCandidates.map((candidate) => (
            <span key={candidate.id} className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
              {candidate.label}
              <button
                onClick={() => setSelectedIds((prev) => prev.filter((id) => id !== candidate.id))}
                className="rounded-full text-secondary-foreground/70 transition-colors hover:text-secondary-foreground"
                aria-label={`Remove ${candidate.label}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <div className="max-h-56 overflow-y-auto rounded-2xl border bg-card">
        {sortedCandidates.map((candidate) => (
          <button
            key={candidate.id}
            className={`flex w-full items-center justify-between gap-3 border-b px-4 py-3 text-left text-sm transition-colors last:border-b-0 ${
              selectedSet.has(candidate.id) ? "bg-accent text-accent-foreground" : "hover:bg-muted/45"
            }`}
            onClick={() =>
              setSelectedIds((prev) =>
                prev.includes(candidate.id) ? prev.filter((id) => id !== candidate.id) : [...prev, candidate.id],
              )
            }
          >
            <span>{candidate.label}</span>
            {selectedSet.has(candidate.id) ? <Badge variant="secondary">Selected</Badge> : null}
          </button>
        ))}
        {!sortedCandidates.length && !searching ? <div className="px-4 py-6 text-sm text-muted-foreground">Type 3+ chars to search.</div> : null}
        {searching ? <div className="px-4 py-6 text-sm text-muted-foreground">Searching ATTOM...</div> : null}
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="text-sm text-muted-foreground">{selectedIds.length} addresses selected</div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button
          disabled={!selectedIds.length}
          onClick={() => {
            const items = searchResults
              .filter((candidate) => selectedSet.has(candidate.id))
              .map((candidate) => candidate.listing);
            onAdd(items);
          }}
        >
          Add Selected
        </Button>
      </div>
    </div>
  );
}

function toAttomSearchParams(q: string): Record<string, string> {
  const value = q.trim();

  if (/^\d{5}$/.test(value)) {
    return { postalcode: value };
  }

  const parts = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

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
  return mapped.filter((candidate) => isCommercialListing(candidate.listing));
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

  const parts = raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
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

function parseListingDetailsToRecord(text: string, explicitAddress?: string): ListingRecord | null {
  const raw = text.trim();
  const normalizedAddress = explicitAddress?.trim();
  if (!raw || !normalizedAddress) return null;

  const sourceListingId = matchValue(raw, /Listing ID:\s*([^\n\r]+)/i);
  const listingType = inferListingType(raw);
  const dateOnMarket = matchValue(raw, /Date on Market:\s*([^\n\r]+)/i);
  const lastUpdatedAtSource = matchValue(raw, /Last Updated:\s*([^\n\r]+)/i);
  const addressCandidate =
    normalizedAddress ??
    matchValue(raw, /Address:\s*([^\n\r]+)/i) ??
    matchValue(raw, /(\d+\s+[^\n\r,]+,\s*[^\n\r,]+,\s*[A-Z]{2}\s*\d{5})/);

  const parsedAddress = parseAddress(addressCandidate ?? "");
  const normalizedTitle = stripTrailingLocation(
    parsedAddress.addressLine1 ?? "",
    parsedAddress.city,
    parsedAddress.state,
    parsedAddress.postalCode,
  );
  const title = normalizedTitle || "Parsed Listing";

  const buildingSize = toNumber(matchValue(raw, /Building Size\s*([\d,]+)\s*SF/i)?.replace(/,/g, ""));
  const lotSizeAcres = toNumber(matchValue(raw, /([\d.]+)\s*AC\b/i));
  const rentalRate = toNumber(matchValue(raw, /Rental Rate\s*\$?([\d,.]+)\s*\/SF\/YR/i)?.replace(/,/g, ""));
  const leaseTermYears = toNumber(matchValue(raw, /(?:Lease\s*Term|Term)\s*:?\s*(\d+(?:\.\d+)?)\s*(?:year|yr)s?/i));
  const ownerProvisions =
    matchValue(raw, /(?:Owner\s*Provisions|Landlord\s*Provisions|Incentives|Concessions)\s*:?\s*([^\n\r]+)/i) ??
    undefined;
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
    addressLine1: normalizedTitle || "Unknown",
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
    ownerProvisions,
    leaseTermYears,
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
  specialPermit?.forEach((entry) => out.add(entry.trim()));

  const exclusions = text.match(/None of[^.\n]*\./gi);
  exclusions?.forEach((entry) => out.add(entry.trim()));

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
  const rx =
    /([^\n\r]+)\nSize\n([^\n\r]+)\nTerm\n([^\n\r]+)\nRental Rate\n([^\n\r]+)\nSpace Use\n([^\n\r]+)\nBuild-Out\n([^\n\r]+)\nAvailable\n([^\n\r]+)/g;

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
    const tags = spaceUseRaw
      .split(/[\/,&]/)
      .map((item) => item.trim())
      .filter(Boolean);

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
  const lines = section
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const features: ListingFeatureRecord[] = [];

  for (let index = 0; index < lines.length - 1; index += 2) {
    const key = lines[index];
    const value = lines[index + 1];
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
  const lines = section
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
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
  for (let index = 0; index < lines.length; index += 3) {
    const floor = lines[index];
    const tenantName = lines[index + 1];
    const industry = lines[index + 2];
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

  const match = trimmed.match(/^(.+?),\s*([^,]+),\s*([A-Z]{2})\s*(\d{5})?/i);
  if (!match) {
    return { addressLine1: trimmed };
  }

  return {
    addressLine1: match[1]?.trim(),
    city: match[2]?.trim(),
    state: match[3]?.toUpperCase().trim(),
    postalCode: match[4]?.trim(),
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripTrailingLocation(value: string, city?: string, state?: string, postalCode?: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const normalizedCity = city?.trim();
  const normalizedState = state?.trim();
  const normalizedPostalCode = postalCode?.trim();
  const suffixPatterns: RegExp[] = [];

  if (normalizedCity && normalizedState) {
    const cityPattern = escapeRegExp(normalizedCity);
    const statePattern = escapeRegExp(normalizedState);
    const postalPattern = normalizedPostalCode
      ? `(?:\\s*${escapeRegExp(normalizedPostalCode)})?`
      : "(?:\\s*\\d{5}(?:-\\d{4})?)?";

    suffixPatterns.push(new RegExp(`^(.+),\\s*${cityPattern},\\s*${statePattern}${postalPattern}$`, "i"));
    suffixPatterns.push(new RegExp(`^(.+),\\s*${cityPattern}\\s+${statePattern}${postalPattern}$`, "i"));
  }

  suffixPatterns.push(/^(.+),\s*[^,]+,\s*[A-Z]{2}(?:\s*\d{5}(?:-\d{4})?)?$/i);
  suffixPatterns.push(/^(.+),\s*[A-Z]{2}(?:\s*\d{5}(?:-\d{4})?)?$/i);

  for (const pattern of suffixPatterns) {
    const match = trimmed.match(pattern);
    if (match?.[1]?.trim()) {
      return match[1].trim();
    }
  }

  return trimmed;
}

function matchValue(text: string, regex: RegExp): string | undefined {
  const match = text.match(regex);
  return match?.[1]?.trim();
}

function toNumber(value: number | string | undefined): number | undefined {
  if (value == null) return undefined;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
