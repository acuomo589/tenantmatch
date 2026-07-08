import { NextResponse } from "next/server";
import { getLiteFallbackTenantId } from "@/lib/lite/store";
import { getLiteLinkWithWorkbookByToken } from "@/lib/lite/service";
import { getLiteConfig } from "@/lib/lite/config";
import { createLiteSheetAdapter } from "@/lib/lite/google-sheet";
import { buildIntakeHeaderState, buildIntakeRowUpdates, nextSheetRowNumber, readIntakeRowSnapshot } from "@/lib/lite/intake-sheet";
import { processLiteSheet } from "@/lib/lite/sheets";
import { buildLiteAdminLinkUrl, isValidLiteAdminLinkSignature } from "@/lib/lite/url";

export const runtime = "nodejs";

type RequestAnotherBody = {
  token?: string;
  adminSignature?: string | null;
  listingAddress?: string;
  buyerEmail?: string;
  buyerName?: string | null;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestAnotherBody;
    const token = body.token?.trim();
    const listingAddress = body.listingAddress?.trim();

    if (!token || !listingAddress) {
      return NextResponse.json({ error: "token and listingAddress are required." }, { status: 400 });
    }

    const existingLink = await getLiteLinkWithWorkbookByToken(token);
    if (!existingLink) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const hasAdminAccess = isValidLiteAdminLinkSignature(token, body.adminSignature);
    const hasPaidAccess = existingLink.status === "PAID";
    if (!hasAdminAccess && !hasPaidAccess) {
      return NextResponse.json({ error: "Full workbook access is required." }, { status: 403 });
    }

    const adapter = await createLiteSheetAdapter();
    const config = getLiteConfig();
    const intakeValues = await adapter.readValues(adapter.tabs.intakeTabName);
    const intakeHeaderState = buildIntakeHeaderState(intakeValues, adapter.tabs.intakeTabName);
    const rowNumber = nextSheetRowNumber(intakeValues);

    await adapter.writeValues([
      ...intakeHeaderState.headerUpdates,
      ...buildIntakeRowUpdates(adapter.tabs.intakeTabName, rowNumber, intakeHeaderState.headerIndex, {
        brokerName: body.buyerName?.trim() || existingLink.buyerName || "",
        email: body.buyerEmail?.trim() || existingLink.buyerEmail,
        listingAddress,
      }),
    ]);

    await processLiteSheet({
      tenantId: existingLink.workbook.tenantId || config.automationTenantId || getLiteFallbackTenantId(),
      request,
      rowNumbers: [rowNumber],
    });

    const refreshedValues = await adapter.readValues(adapter.tabs.intakeTabName);
    const refreshedHeaderState = buildIntakeHeaderState(refreshedValues, adapter.tabs.intakeTabName);
    const intakeRow = readIntakeRowSnapshot(refreshedValues, rowNumber, refreshedHeaderState.headerIndex);

    if (!intakeRow.link) {
      return NextResponse.json(
        {
          error: intakeRow.error || "The new listing row did not produce a preview link.",
        },
        { status: 500 },
      );
    }

    const nextToken = intakeRow.link.split("/").pop()?.split("?")[0]?.trim();
    return NextResponse.json({
      url: intakeRow.link,
      adminUrl: nextToken ? buildLiteAdminLinkUrl(nextToken, request) : null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to create another listing request.",
      },
      { status: 500 },
    );
  }
}
