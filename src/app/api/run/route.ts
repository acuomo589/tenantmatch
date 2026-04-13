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
    const body = (await request.json()) as RunRequest;
    const error = validateIntake(body.intake);
    if (error) return NextResponse.json({ error }, { status: 400 });

    const incoming = body.threadId ? getThread(body.threadId) : null;
    const thread = incoming ?? createThread(body.intake);
    thread.intake = body.intake;
    updateThread(thread);

    const run = await runBasePrompt({
      intake: thread.intake,
      currentPrompt: thread.currentPrompt,
    });

    thread.currentPrompt = run.finalPrompt;
    const rows = parseAndNormalizeCsv(run.csv);
    setRunOutput(thread, rows, toCsv(rows));

    addMessage(
      thread,
      "assistant",
      `Generated ${rows.length} candidates${run.usedMock ? " (mock mode)" : ""}.`,
    );

    return NextResponse.json({ thread });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected run failure";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
