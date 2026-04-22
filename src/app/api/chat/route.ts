import { NextResponse } from "next/server";
import { runBasePrompt } from "@/lib/ai/runBasePrompt";
import { parseAndNormalizeCsv, toCsv } from "@/lib/csv";
import { addMessage, getThread, setRunOutput, updateThread } from "@/lib/store";
import { consumeEntitlement, EntitlementError } from "@/lib/billing/entitlements";
import { requireTenantContext } from "@/lib/auth/requestContext";
import type { ChatRequest } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const context = await requireTenantContext();
    const body = (await request.json()) as ChatRequest;
    if (!body.threadId || !body.message?.trim()) {
      return NextResponse.json(
        { error: "threadId and message are required" },
        { status: 400 },
      );
    }

    const thread = getThread(context.tenantId, body.threadId);
    if (!thread) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    addMessage(context.tenantId, thread, "user", body.message);

    const refinementNotes = thread.messages
      .filter((message) => message.role === "user")
      .map((message) => `- ${message.content.trim()}`)
      .join("\n");

    thread.currentPrompt = `${thread.basePrompt}

Refinement notes from user:
${refinementNotes}

Adjust candidate selection and ranking accordingly.`;

    updateThread(context.tenantId, thread);

    const run = await runBasePrompt({
      intake: thread.intake,
      currentPrompt: thread.currentPrompt,
    });

    const rows = parseAndNormalizeCsv(run.csv);
    await consumeEntitlement({
      tenantId: context.tenantId,
      metric: "WORKBOOK_ROWS",
      increment: rows.length,
    });

    setRunOutput(context.tenantId, thread, rows, toCsv(rows));

    addMessage(
      context.tenantId,
      thread,
      "assistant",
      `Applied refinement and regenerated ${rows.length} candidates${run.usedMock ? " (mock mode)" : ""}.`,
    );

    return NextResponse.json({ thread });
  } catch (error) {
    if (error instanceof EntitlementError) {
      return NextResponse.json({ error: error.message, details: error.details }, { status: 402 });
    }
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : "Unexpected chat failure";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
