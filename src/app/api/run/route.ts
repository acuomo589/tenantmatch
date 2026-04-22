import { NextResponse } from "next/server";
import { runBasePrompt } from "@/lib/ai/runBasePrompt";
import { parseAndNormalizeCsv, toCsv } from "@/lib/csv";
import {
  addMessage,
  createThread,
  getThread,
  setRunOutput,
  updateThread,
} from "@/lib/store";
import { consumeEntitlement, EntitlementError } from "@/lib/billing/entitlements";
import { requireTenantContext } from "@/lib/auth/requestContext";
import type { ListingIntake, RunRequest } from "@/lib/types";

function validateIntake(intake: ListingIntake): string | null {
  if (!intake?.address?.trim()) return "Address is required";
  if (!Number.isFinite(intake.radiusMiles) || intake.radiusMiles <= 0) {
    return "Radius must be a positive number";
  }
  return null;
}

export async function POST(request: Request) {
  try {
    const context = await requireTenantContext();
    const body = (await request.json()) as RunRequest;
    const error = validateIntake(body.intake);
    if (error) return NextResponse.json({ error }, { status: 400 });

    const incoming = body.threadId ? getThread(context.tenantId, body.threadId) : null;
    if (!incoming) {
      await consumeEntitlement({ tenantId: context.tenantId, metric: "LISTINGS", increment: 1 });
    }

    const thread = incoming ?? createThread(context.tenantId, body.intake);
    thread.intake = body.intake;
    updateThread(context.tenantId, thread);

    const run = await runBasePrompt({
      intake: thread.intake,
      currentPrompt: thread.currentPrompt,
    });

    thread.currentPrompt = run.finalPrompt;
    const rows = parseAndNormalizeCsv(run.csv);
    setRunOutput(context.tenantId, thread, rows, toCsv(rows));

    addMessage(
      context.tenantId,
      thread,
      "assistant",
      `Generated ${rows.length} candidates${run.usedMock ? " (mock mode)" : ""}.`,
    );

    return NextResponse.json({ thread });
  } catch (error) {
    if (error instanceof EntitlementError) {
      return NextResponse.json({ error: error.message, details: error.details }, { status: 402 });
    }
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : "Unexpected run failure";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
