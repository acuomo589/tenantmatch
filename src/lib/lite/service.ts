import { findLiteLinkByToken, listLiteLinks } from "@/lib/lite/store";
import type { LiteLinkListItem, LiteLinkWithWorkbook } from "@/lib/lite/types";
import { buildLiteLinkUrl } from "@/lib/lite/url";

export async function listLiteLinkItems(tenantId: string, request?: Request): Promise<LiteLinkListItem[]> {
  const links = await listLiteLinks(tenantId);
  return links.map((item) => toLiteLinkListItem(item, request));
}

export async function getLiteLinkWithWorkbookByToken(token: string): Promise<LiteLinkWithWorkbook | null> {
  return findLiteLinkByToken(token);
}

export function toLiteLinkListItem(item: LiteLinkWithWorkbook, request?: Request): LiteLinkListItem {
  return {
    id: item.id,
    address: item.workbook.displayAddress,
    buyerEmail: item.buyerEmail,
    buyerName: item.buyerName,
    status: item.status,
    paywallUrl: buildLiteLinkUrl(item.token, request),
    purchaserEmail: item.purchaserEmail,
    purchaserName: item.purchaserName,
    amountPaidCents: item.amountPaidCents,
    currency: item.currency,
    createdAt: item.createdAt.toISOString(),
    openedAt: item.openedAt?.toISOString() ?? null,
    paidAt: item.paidAt?.toISOString() ?? null,
    error: item.error,
  };
}

export function canDownloadLiteLink(link: LiteLinkWithWorkbook): boolean {
  return link.status === "PAID";
}
