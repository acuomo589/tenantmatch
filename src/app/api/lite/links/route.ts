import { NextResponse } from "next/server";
import { listLiteLinkItems } from "@/lib/lite/service";
import { resolveLiteTenantId } from "@/lib/lite/runtime";

export async function GET(request: Request) {
  try {
    const tenantId = await resolveLiteTenantId();
    const links = await listLiteLinkItems(tenantId, request);
    return NextResponse.json({ links });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to load links." }, { status: 500 });
  }
}
