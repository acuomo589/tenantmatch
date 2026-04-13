import { NextResponse } from "next/server";
import { cloneThread, getThread } from "@/lib/store";

interface Params {
  params: Promise<{ threadId: string }>;
}

export async function POST(_: Request, { params }: Params) {
  const { threadId } = await params;
  const thread = getThread(threadId);
  if (!thread) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  const cloned = cloneThread(thread);
  return NextResponse.json({ thread: cloned });
}
