import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Building2, Clock3, LayoutGrid, Megaphone, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { ListingRecord } from "@/lib/workspace-client";
import { formatLastEdited, getListingDisplayTitle } from "@/lib/workspace-client";

function ListingSummaryCard({
  listing,
  workbookCount,
  outreachCount,
}: {
  listing: ListingRecord;
  workbookCount: number;
  outreachCount: number;
}) {
  const primarySpace = listing.spaces[0];
  const buildingType = primarySpace?.spaceUsePrimary ?? listing.propertyClass ?? "Commercial";
  const addressPath = encodeURIComponent(listing.addressLine1 || listing.title || listing.id);
  const displayTitle = getListingDisplayTitle(listing);
  const location = [listing.city, [listing.state, listing.postalCode].filter(Boolean).join(" ")].filter(Boolean).join(", ");

  return (
    <Link href={`/listings/${addressPath}`} className="group block">
      <Card className="overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
        <CardContent className="grid gap-5 p-5 md:grid-cols-[minmax(0,1.6fr)_minmax(14rem,1fr)] md:p-6">
          <div className="grid gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="gap-1">
                <Building2 className="size-3.5" />
                {buildingType}
              </Badge>
              <Badge variant="outline" className="gap-1">
                <Clock3 className="size-3.5" />
                Updated {formatLastEdited(listing)}
              </Badge>
            </div>

            <div className="grid gap-2">
              <div className="text-xl font-semibold tracking-tight text-foreground">{displayTitle}</div>
              <div className="text-sm text-muted-foreground">{location || "Location unavailable"}</div>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                {listing.listingSummary || "No listing summary is available yet. Add details or run the parser to build a stronger brief."}
              </p>
            </div>
          </div>

          <div className="grid gap-3 rounded-[1.5rem] border bg-muted/35 p-4">
            <div className="grid grid-cols-2 gap-3">
              <Tile label="Size" value={listing.squareFootage ? `${listing.squareFootage.toLocaleString()} SF` : "Pending"} />
              <Tile label="Rate" value={listing.rentalRatePerSfYr ? `$${listing.rentalRatePerSfYr}/SF` : "Pending"} />
              <Tile label="Workbooks" value={String(workbookCount)} icon={<LayoutGrid className="size-3.5" />} />
              <Tile label="Outreach" value={String(outreachCount)} icon={<Megaphone className="size-3.5" />} />
            </div>

            <div className="flex items-center justify-between rounded-2xl border bg-card px-3 py-2.5 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-2">
                <Sparkles className="size-4 text-primary" />
                Open deal workspace
              </span>
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function Tile({ label, value, icon }: { label: string; value: string; icon?: ReactNode }) {
  return (
    <div className="rounded-2xl border bg-card p-3">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-sm font-semibold text-foreground">{value}</div>
    </div>
  );
}

export { ListingSummaryCard };
