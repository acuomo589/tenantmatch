import { NextResponse } from "next/server";
import { processLiteSheet } from "@/lib/lite/sheets";
import { resolveLiteTenantId } from "@/lib/lite/runtime";

function readRowLimit(request: Request): number | undefined {
  const rawLimit = new URL(request.url).searchParams.get("limit");
  if (!rawLimit) return undefined;

  const parsedLimit = Number.parseInt(rawLimit, 10);
  if (!Number.isFinite(parsedLimit) || parsedLimit < 1) {
    return undefined;
  }

  return Math.min(parsedLimit, 100);
}

export async function POST(request: Request) {
  try {
    const tenantId = await resolveLiteTenantId();
    const summary = await processLiteSheet({ tenantId, request, maxRows: readRowLimit(request) });
    return NextResponse.json({ summary });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process sheet rows." },
      { status: 500 },
    );
  }
}
