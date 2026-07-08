import Link from "next/link";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { ProcessSheetButton } from "@/components/lite/process-sheet-button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { getLiteConfig } from "@/lib/lite/config";
import { listLiteLinkItems } from "@/lib/lite/service";
import { resolveLiteTenantId } from "@/lib/lite/runtime";
import type { LiteLinkListItem } from "@/lib/lite/types";

export const dynamic = "force-dynamic";

function formatDateTime(value: string | null): string {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

function formatCurrency(amountCents: number | null, currency: string): string {
  if (amountCents == null) return "—";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: 2,
  }).format(amountCents / 100);
}

function StatusBadge({ status }: { status: LiteLinkListItem["status"] }) {
  const tone =
    status === "PAID" ? "bg-emerald-100 text-emerald-900" : status === "OPENED" ? "bg-sky-100 text-sky-900" : status === "FAILED" ? "bg-rose-100 text-rose-900" : "bg-amber-100 text-amber-900";

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold tracking-[0.14em] ${tone}`}>
      {status}
    </span>
  );
}

export default async function WorkspacePage() {
  const tenantId = await resolveLiteTenantId();
  const links = await listLiteLinkItems(tenantId);
  const config = getLiteConfig();

  return (
    <WorkspaceShell>
      <div className="grid gap-6">
        <PageHeader
          eyebrow="Admin"
          title="Process sheet rows into paid workbook links"
          description="Add rows to your intake tab with broker name, email, and listing address, then run the batch processor here. New preview links write back to the intake row while a separate archive tab stores workbook backups and payment state."
          actions={<ProcessSheetButton />}
        >
          <div className="grid gap-3 text-sm text-muted-foreground md:grid-cols-3">
            <div className="rounded-[1.5rem] border bg-muted/25 px-4 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em]">Sheet columns</div>
              <div className="mt-2 leading-6">Required: `listing_address`, `email`</div>
              <div className="leading-6">Optional: `broker_name`</div>
              <div className="leading-6">Optional: `site_context`, `site_context_image_urls`, `force_regenerate`</div>
              <div className="leading-6">Output: `link`, `error` (auto-created)</div>
            </div>
            <div className="rounded-[1.5rem] border bg-muted/25 px-4 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em]">Archive tab</div>
              <div className="mt-2 leading-6">{config.googleLinksTabName}</div>
              <div className="leading-6">Stores workbook CSV backups</div>
              <div className="leading-6">Tracks opened, paid, and Stripe state</div>
            </div>
            <div className="rounded-[1.5rem] border bg-muted/25 px-4 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em]">Spreadsheet</div>
              <div className="mt-2 break-all leading-6">{config.googleSheetUrl || "LITE_GOOGLE_SHEET_URL not configured yet"}</div>
              <div className="leading-6">Intake tab: {config.googleSheetTabName || "first tab in sheet"}</div>
            </div>
          </div>
        </PageHeader>

        {links.length === 0 ? (
          <EmptyState
            title="No generated links yet"
            description="Once the intake tab has rows with blank `link` cells, click `Process new rows` and the generated buyer URLs will appear here."
          />
        ) : (
          <section className="rounded-[2rem] border bg-card/95 px-6 py-6 shadow-sm">
            <div className="grid gap-1">
              <h2 className="text-lg font-semibold tracking-tight">Recent links</h2>
              <p className="text-sm text-muted-foreground">These rows come from the archive tab, which keeps each link's workbook backup and payment lifecycle.</p>
            </div>

            <div className="mt-5">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Address</TableHead>
                    <TableHead>Buyer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Paywall URL</TableHead>
                    <TableHead>Purchaser</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Opened</TableHead>
                    <TableHead>Paid</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {links.map((link) => (
                    <TableRow key={link.id}>
                      <TableCell className="font-medium">{link.address}</TableCell>
                      <TableCell>
                        <div className="grid gap-1">
                          <div>{link.buyerName || "Unnamed buyer"}</div>
                          <div className="text-xs text-muted-foreground">{link.buyerEmail}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={link.status} />
                      </TableCell>
                      <TableCell className="max-w-[18rem]">
                        <Link href={link.paywallUrl} className="break-all text-sky-700 underline-offset-4 hover:underline" target="_blank">
                          {link.paywallUrl}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div className="grid gap-1">
                          <div>{link.purchaserName || "—"}</div>
                          <div className="text-xs text-muted-foreground">{link.purchaserEmail || "—"}</div>
                        </div>
                      </TableCell>
                      <TableCell>{formatCurrency(link.amountPaidCents, link.currency)}</TableCell>
                      <TableCell>{formatDateTime(link.createdAt)}</TableCell>
                      <TableCell>{formatDateTime(link.openedAt)}</TableCell>
                      <TableCell>{formatDateTime(link.paidAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
        )}
      </div>
    </WorkspaceShell>
  );
}
