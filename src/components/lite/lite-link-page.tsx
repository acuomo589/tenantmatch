import Link from "next/link";
import { LiteCheckoutButton } from "@/components/lite/lite-checkout-button";
import { LiteOpenedBeacon } from "@/components/lite/lite-opened-beacon";
import { LiteRequestAnotherForm } from "@/components/lite/lite-request-another-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { LiteLinkWithWorkbook } from "@/lib/lite/types";

function formatCurrency(amountCents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: 2,
  }).format(amountCents / 100);
}

export function LiteLinkPage(args: {
  token: string;
  link: LiteLinkWithWorkbook;
  fullAccess: boolean;
  mode: "public" | "admin";
  checkoutState?: string;
  adminSignature?: string | null;
}) {
  const previewRows = args.link.workbook.workbookRowsJson.slice(0, args.link.workbook.previewRowCount);
  const rows = args.fullAccess ? args.link.workbook.workbookRowsJson : previewRows;
  const isAdmin = args.mode === "admin";
  const adminQuery = isAdmin && args.adminSignature ? `?sig=${encodeURIComponent(args.adminSignature)}` : "";
  const csvHref = isAdmin ? `/a/${args.token}/download/csv${adminQuery}` : `/r/${args.token}/download/csv`;
  const pdfHref = isAdmin ? `/a/${args.token}/download/pdf${adminQuery}` : `/r/${args.token}/download/pdf`;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.12),_transparent_45%),linear-gradient(180deg,_#f8fafc,_#eef2ff_55%,_#f8fafc)] px-4 py-10">
      {isAdmin ? null : <LiteOpenedBeacon token={args.token} />}
      <div className="mx-auto grid max-w-5xl gap-6">
        <section className="rounded-[2rem] border bg-white/95 px-6 py-8 shadow-sm backdrop-blur md:px-8">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
            <div className="grid gap-3">
              <Badge variant="secondary">{isAdmin ? "TenantMatch Admin" : "TenantMatch"}</Badge>
              <div className="grid gap-2">
                <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">{args.link.workbook.displayAddress}</h1>
                <p className="max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
                  25 best-fit prospects for your listing showing in market signals.
                </p>
              </div>
            </div>

            <Card className="min-w-[18rem] border-sky-100 bg-sky-50/70">
              <CardContent className="grid gap-4 p-5">
                <div className="grid gap-1">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-800/70">Price</div>
                  <div className="text-3xl font-semibold text-sky-950">
                    {formatCurrency(args.link.priceCents, args.link.currency)}
                  </div>
                </div>

                {args.fullAccess ? (
                  <div className="grid gap-2">
                    <Button asChild>
                      <Link href={csvHref}>Download CSV</Link>
                    </Button>
                    <Button asChild variant="outline">
                      <Link href={pdfHref}>Download PDF</Link>
                    </Button>
                  </div>
                ) : (
                  <LiteCheckoutButton token={args.token} />
                )}

                {isAdmin ? (
                  <div className="rounded-2xl border border-sky-200 bg-white/80 px-3 py-2 text-sm text-sky-900">
                    Admin view. Full workbook and downloads are available without changing buyer payment state.
                  </div>
                ) : null}
                {args.checkoutState === "success" ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                    Payment completed. If your downloads do not appear yet, refresh in a moment.
                  </div>
                ) : null}
                {args.checkoutState === "canceled" ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    Checkout was canceled. Your preview link still works if you want to come back later.
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </section>

        <Card data-surface>
          <CardContent className="grid gap-5 p-6">
            <div className="flex items-center justify-between gap-3">
              <div className="grid gap-1">
                <h2 className="text-lg font-semibold tracking-tight">{args.fullAccess ? "Full workbook" : "Preview row"}</h2>
                {args.fullAccess ? <p className="text-sm text-muted-foreground">All 25 workbook rows are unlocked.</p> : null}
              </div>
              <Badge variant="outline">{isAdmin ? "Admin" : args.fullAccess ? "Paid" : "Preview"}</Badge>
            </div>

            <div className="overflow-hidden rounded-[1.5rem] border">
              <table className="w-full text-sm">
                <thead className="bg-muted/45">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Rank</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Business</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Location</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Fit</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Summary / rationale</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={`${row.priority_rank}-${row.business_name}`} className="border-t">
                      <td className="px-4 py-4 font-semibold">{row.priority_rank}</td>
                      <td className="px-4 py-4">
                        <div className="grid gap-1">
                          <div className="font-semibold text-foreground">{row.business_name}</div>
                          <div className="text-xs text-muted-foreground">
                            {row.category} · {row.property_type}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        {row.city}, {row.state}
                      </td>
                      <td className="px-4 py-4">{row.tenant_fit_score_100}/100</td>
                      <td className="px-4 py-4">
                        <div className="grid gap-1">
                          <div className="text-muted-foreground">{row.fit_summary}</div>
                          <div className="text-xs font-medium text-foreground/80">{row.rationale}</div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {args.fullAccess ? (
          <LiteRequestAnotherForm
            token={args.token}
            defaultBuyerEmail={args.link.buyerEmail}
            defaultBuyerName={args.link.buyerName}
            adminSignature={args.adminSignature}
            mode={args.mode}
          />
        ) : null}
      </div>
    </main>
  );
}
