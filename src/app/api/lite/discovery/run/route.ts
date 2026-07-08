import { NextResponse } from "next/server";
import { requireLiteAutomationTenantId } from "@/lib/lite/automation-auth";
import { runLiteZipDiscovery } from "@/lib/lite/automation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const tenantId = await requireLiteAutomationTenantId(request);
    const summary = await runLiteZipDiscovery({
      tenantId,
      request,
    });

    return NextResponse.json({ summary });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to run ZIP discovery.",
      },
      { status: 500 },
    );
  }
}
