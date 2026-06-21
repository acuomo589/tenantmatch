import { getStripeClient } from "@/lib/billing/stripe";
import { findLiteLinkByToken, listLiteLinks, markLiteLinkFailed, markLiteLinkPaid } from "@/lib/lite/store";
import type { LiteLinkListItem, LiteLinkWithWorkbook } from "@/lib/lite/types";
import { buildLiteLinkUrl } from "@/lib/lite/url";

export async function listLiteLinkItems(tenantId: string, request?: Request): Promise<LiteLinkListItem[]> {
  const links = await listLiteLinks(tenantId);
  return links.map((item) => toLiteLinkListItem(item, request));
}

export async function getLiteLinkWithWorkbookByToken(token: string): Promise<LiteLinkWithWorkbook | null> {
  return findLiteLinkByToken(token);
}

export async function confirmLiteLinkPayment(
  token: string,
  explicitSessionId?: string | null,
): Promise<LiteLinkWithWorkbook | null> {
  const link = await findLiteLinkByToken(token);
  if (!link) return null;
  if (link.status === "PAID") return link;

  const sessionId = explicitSessionId?.trim() || link.stripeCheckoutSessionId;
  if (!sessionId) {
    return link;
  }

  const stripe = getStripeClient();
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  const sessionToken = session.metadata?.liteLinkToken?.trim() || null;
  const paidEmail =
    session.customer_details?.email?.trim().toLowerCase() ?? session.customer_email?.trim().toLowerCase() ?? null;
  const expectedEmail = link.buyerEmail.trim().toLowerCase();

  if (sessionToken && sessionToken !== token) {
    await markLiteLinkFailed(token, `Checkout token mismatch. Expected ${token} but received ${sessionToken}.`);
    return findLiteLinkByToken(token);
  }

  if (session.payment_status !== "paid") {
    return link;
  }

  if (!paidEmail || paidEmail !== expectedEmail) {
    await markLiteLinkFailed(
      token,
      `Checkout email mismatch. Expected ${expectedEmail} but received ${paidEmail ?? "none"}.`,
    );
    return findLiteLinkByToken(token);
  }

  return markLiteLinkPaid({
    token,
    purchaserEmail: session.customer_details?.email ?? session.customer_email ?? null,
    purchaserName: session.customer_details?.name ?? null,
    amountPaidCents: session.amount_total ?? null,
    stripeCheckoutSessionId: session.id,
    stripePaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : null,
  });
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
