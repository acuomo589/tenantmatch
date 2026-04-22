import { NextResponse } from "next/server";
import { getUsageSnapshot } from "@/lib/billing/entitlements";
import { requireTenantContext } from "@/lib/auth/requestContext";

export async function GET() {
  try {
    const context = await requireTenantContext();
    const snapshot = await getUsageSnapshot(context.tenantId);
    return NextResponse.json(snapshot);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : "Failed to load usage.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
