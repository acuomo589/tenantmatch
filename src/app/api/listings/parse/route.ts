import { NextResponse } from "next/server";
import { runStructuredListingParser } from "@/lib/ai/runStructuredListingParser";
import { isMockAgenticFlowEnabled, MOCK_PARSED_LISTING } from "@/lib/testing/mock-agentic-flow";

export async function POST(request: Request) {
  const requestId = `parse_${Math.random().toString(36).slice(2, 8)}`;
  try {
    const body = (await request.json()) as { rawText?: string; address?: string };
    const rawText = body.rawText?.trim();
    const address = body.address?.trim();
    if (!rawText) {
      console.warn("[listings/parse] missing rawText", { requestId });
      return NextResponse.json({ error: "rawText is required" }, { status: 400 });
    }
    if (!address) {
      console.warn("[listings/parse] missing address", { requestId });
      return NextResponse.json({ error: "address is required" }, { status: 400 });
    }

    if (isMockAgenticFlowEnabled()) {
      return NextResponse.json({
        listing: {
          ...MOCK_PARSED_LISTING,
          addressLine1: address,
          rawDetails: rawText,
        },
      });
    }

    console.info("[listings/parse] parser request received", {
      requestId,
      addressLength: address.length,
      rawTextLength: rawText.length,
    });

    const parsed = await runStructuredListingParser(rawText, address);
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
