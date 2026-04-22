import { NextResponse } from "next/server";
import { listThreadsForTenant } from "@/lib/store";
import { requireTenantContext } from "@/lib/auth/requestContext";

export async function GET() {
  try {
    const context = await requireTenantContext();
    return NextResponse.json({ threads: listThreadsForTenant(context.tenantId) });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
