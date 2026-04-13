import { NextResponse } from "next/server";
import { runStructuredListingParser } from "@/lib/ai/runStructuredListingParser";

export async function POST(request: Request) {
  const requestId = `parse_${Math.random().toString(36).slice(2, 8)}`;
  try {
    const body = (await request.json()) as { rawText?: string };
    const rawText = body.rawText?.trim();
    if (!rawText) {
      console.warn("[listings/parse] missing rawText", { requestId });
      return NextResponse.json({ error: "rawText is required" }, { status: 400 });
    }

    console.info("[listings/parse] parser request received", {
      requestId,
      rawTextLength: rawText.length,
    });

    const parsed = await runStructuredListingParser(rawText);
    console.info("[listings/parse] parser request succeeded", {
      requestId,
      listingId: parsed.id,
      title: parsed.title,
    });
    return NextResponse.json({ listing: parsed });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected parser failure";
    console.error("[listings/parse] parser request failed", {
      requestId,
      error: message,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
