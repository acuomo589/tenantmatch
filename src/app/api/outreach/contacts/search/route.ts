import { NextResponse } from "next/server";
import { searchApolloPeople } from "@/lib/apollo/client";
import { consumeEntitlement, EntitlementError } from "@/lib/billing/entitlements";
import { requireTenantContext } from "@/lib/auth/requestContext";

export const runtime = "nodejs";

type SearchBody = {
  businessName?: string;
  city?: string;
  state?: string;
  category?: string;
  cursor?: string | null;
};

export async function POST(request: Request) {
  try {
    const context = await requireTenantContext();
    const body = (await request.json()) as SearchBody;
    const businessName = body.businessName?.trim();

    if (!businessName) {
      return NextResponse.json({ error: "businessName is required" }, { status: 400 });
    }

    const page = Number(body.cursor ?? "1");
    const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;

    const result = await searchApolloPeople({
      businessName,
      city: body.city?.trim(),
      state: body.state?.trim(),
      category: body.category?.trim(),
      page: safePage,
      limit: 3,
    });

    const consumed = Array.isArray(result.contacts) ? result.contacts.length : 0;
    if (consumed > 0) {
      await consumeEntitlement({
        tenantId: context.tenantId,
        metric: "CONTACTS",
        increment: consumed,
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof EntitlementError) {
      return NextResponse.json({ error: error.message, details: error.details }, { status: 402 });
    }
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : "Apollo contact search failed.";

    // Graceful fallback for plan/access restrictions so UI can keep using seeded contacts
    // without surfacing a hard 500 to the user.
    if (/free plan|not accessible|forbidden|403/i.test(message)) {
      return NextResponse.json({
        contacts: [],
        hasMore: false,
        nextCursor: null,
        providerStatus: "unavailable",
        providerMessage: message,
      });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
