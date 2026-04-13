import { NextResponse } from "next/server";
import { runBasePrompt } from "@/lib/ai/runBasePrompt";
import { parseAndNormalizeCsv, toCsv } from "@/lib/csv";
import { addMessage, getThread, setRunOutput, updateThread } from "@/lib/store";
import type { ChatRequest } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ChatRequest;
    if (!body.threadId || !body.message?.trim()) {
      return NextResponse.json(
        { error: "threadId and message are required" },
        { status: 400 },
      );
    }

    const thread = getThread(body.threadId);
    if (!thread) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    addMessage(thread, "user", body.message);

    const refinementNotes = thread.messages
      .filter((message) => message.role === "user")
      .map((message) => `- ${message.content.trim()}`)
      .join("\n");

    thread.currentPrompt = `${thread.basePrompt}

Refinement notes from user:
${refinementNotes}

Adjust candidate selection and ranking accordingly.`;

    updateThread(thread);

    const run = await runBasePrompt({
      intake: thread.intake,
      currentPrompt: thread.currentPrompt,
    });

    const rows = parseAndNormalizeCsv(run.csv);
    setRunOutput(thread, rows, toCsv(rows));

    addMessage(
      thread,
      "assistant",
      `Applied refinement and regenerated ${rows.length} candidates${run.usedMock ? " (mock mode)" : ""}.`,
    );

    return NextResponse.json({ thread });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected chat failure";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
