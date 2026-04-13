import { NextResponse } from "next/server";
import { getThread } from "@/lib/store";

interface Params {
  params: Promise<{ threadId: string }>;
}

export async function GET(_: Request, { params }: Params) {
  const { threadId } = await params;
  const thread = getThread(threadId);
  if (!thread) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  return NextResponse.json({ thread });
}
