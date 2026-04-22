"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type ListingRecord = {
  id: string;
  title: string;
  addressLine1: string;
  city: string;
  state: string;
  postalCode: string;
  squareFootage?: number;
  lotSizeAcres?: number;
  propertyClass?: string;
  locationDescription?: string;
  listingSummary?: string;
  ownerProvisions?: string;
  leaseTermYears?: number;
  dateOnMarket?: string;
  lastUpdatedAtSource?: string;
  spaces: Array<{
    sizeSf?: number;
    spaceUsePrimary?: string;
  }>;
  disclosures: Array<{ text: string }>;
  features: Array<{ featureValueText?: string; sourceText?: string }>;
};

type WorkspaceState = {
  listings: ListingRecord[];
  workbooks: Array<{ listingId: string }>;
  outreachTargets: Array<{ listingId: string }>;
  exploreOptionsByListing?: Record<string, { analysis?: { scenarios?: Array<unknown> } }>;
};

const LOCAL_PERSISTENCE_KEY = "timpani:workspace:v1";

export default function ListingDetailPage() {
  const params = useParams<{ address: string }>();
  const decodedAddress = decodeURIComponent(params?.address ?? "");

  const [state, setState] = useState<WorkspaceState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [creatingWorkbook, setCreatingWorkbook] = useState(false);
  const [exploringOptions, setExploringOptions] = useState(false);

  useEffect(() => {
    let mounted = true;

    const readLocal = (): WorkspaceState | null => {
      if (typeof window === "undefined") return null;
      try {
        const raw = window.localStorage.getItem(LOCAL_PERSISTENCE_KEY);
        return raw ? (JSON.parse(raw) as WorkspaceState) : null;
      } catch {
        return null;
      }
    };

    void (async () => {
      try {
        const response = await fetch("/api/workspace/state", { method: "GET" });
        const payload = response.ok ? ((await response.json()) as { state?: WorkspaceState | null }) : null;
        if (mounted) setState(payload?.state ?? readLocal());
      } catch {
        if (mounted) setState(readLocal());
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const listing = useMemo(() => {
    if (!state?.listings?.length) return null;
    return (
      state.listings.find((x) => x.addressLine1 === decodedAddress) ??
      state.listings.find((x) => x.addressLine1.toLowerCase() === decodedAddress.toLowerCase()) ??
      null
    );
  }, [state, decodedAddress]);

  const createWorkbook = async () => {
    if (!listing) return;
    setCreatingWorkbook(true);
    setError(null);
    setInfoMessage(null);

    try {
      const response = await fetch("/api/workbooks/from-listing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listing }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not create workbook.");
      }

      setInfoMessage("Workbook created. Return to Workbooks to view it.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create workbook.");
    } finally {
      setCreatingWorkbook(false);
    }
  };

  const exploreOptions = async () => {
    if (!listing) return;
    setExploringOptions(true);
    setError(null);
    setInfoMessage(null);

    try {
      const response = await fetch("/api/listings/explore-options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listing }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not explore options.");
      }

      setInfoMessage("Explore options generated. Return to Listings → Options to review.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not explore options.");
    } finally {
      setExploringOptions(false);
    }
  };

  if (!state) {
    return <main style={{ padding: 16 }}>Loading listing…</main>;
  }

  if (!listing) {
    return (
      <main style={{ padding: 16, display: "grid", gap: 12 }}>
        <strong>Listing not found</strong>
        <Link href="/workspace?tab=listings" className="btn secondary" style={{ width: "fit-content" }}>
          Back to listings
        </Link>
      </main>
    );
  }

  const primarySpace = listing.spaces[0];
  const buildingType = primarySpace?.spaceUsePrimary ?? listing.propertyClass ?? "Retail";
  const sizeValue = primarySpace?.sizeSf ?? listing.squareFootage;
  const workbookCount = state.workbooks.filter((x) => x.listingId === listing.id).length;
  const proposalCount = state.exploreOptionsByListing?.[listing.id]?.analysis?.scenarios?.length ?? 0;
  const outreachCount = state.outreachTargets.filter((x) => x.listingId === listing.id).length;

  return (
    <main style={{ padding: 16, display: "grid", gap: 12 }}>
      <section style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div>
          <strong style={{ fontSize: 18 }}>{listing.addressLine1 || listing.title}</strong>
          <div style={{ color: "#64748b", marginTop: 4 }}>{[listing.city, listing.state, listing.postalCode].filter(Boolean).join(", ")}</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Button variant="secondary" onClick={exploreOptions} disabled={exploringOptions}>
            {exploringOptions ? "Exploring..." : "Explore Options"}
          </Button>
          <Button onClick={createWorkbook} disabled={creatingWorkbook}>
            {creatingWorkbook ? "Creating Workbook..." : "Create Workbook"}
          </Button>
          <Link href="/workspace?tab=listings" className="btn secondary">
            Back
          </Link>
        </div>
      </section>

      <section style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Badge>{buildingType}</Badge>
        <Badge variant="outline">Last edited: {formatDate(listing.lastUpdatedAtSource ?? listing.dateOnMarket)}</Badge>
        <Badge variant="outline">Workbooks: {workbookCount}</Badge>
        <Badge variant="outline">Proposals: {proposalCount}</Badge>
        <Badge variant="outline">Outreach: {outreachCount}</Badge>
      </section>

      <Card>
        <CardContent style={{ display: "grid", gap: 12, padding: 18 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
            <Metric label="Total Size" value={sizeValue != null ? `${sizeValue.toLocaleString()} SF` : "—"} />
            <Metric label="Lot Size (AC)" value={listing.lotSizeAcres != null ? String(listing.lotSizeAcres) : "—"} />
            <Metric label="Property Type" value={buildingType} />
          </div>

          <div>
            <div style={sectionLabelStyle}>Location description</div>
            <div>{listing.locationDescription || "—"}</div>
          </div>

          <div>
            <div style={sectionLabelStyle}>Property highlights</div>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {listing.features.length ? listing.features.map((f, idx) => <li key={idx}>{f.featureValueText ?? f.sourceText ?? "—"}</li>) : <li>—</li>}
            </ul>
          </div>

          <div>
            <div style={sectionLabelStyle}>Disclosures</div>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {listing.disclosures.length ? listing.disclosures.map((d, idx) => <li key={idx}>{d.text}</li>) : <li>—</li>}
            </ul>
          </div>

          <div>
            <div style={sectionLabelStyle}>Listing summary</div>
            <div>{listing.listingSummary || "—"}</div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
            <Metric label="Owner Provisions" value={listing.ownerProvisions || "—"} />
            <Metric label="Lease Term Length (Years)" value={listing.leaseTermYears != null ? String(listing.leaseTermYears) : "—"} />
          </div>
        </CardContent>
      </Card>

      {error ? <div style={{ color: "#b91c1c", fontSize: 12 }}>{error}</div> : null}
      {infoMessage ? <div style={{ color: "#1d4ed8", fontSize: 12 }}>{infoMessage}</div> : null}
    </main>
  );
}

function formatDate(value?: string): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 10, background: "#fcfdff" }}>
      <div style={{ color: "#64748b", fontSize: 12, marginBottom: 4 }}>{label}</div>
      <div style={{ fontWeight: 600 }}>{value}</div>
    </div>
  );
}

const sectionLabelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "#64748b",
};
