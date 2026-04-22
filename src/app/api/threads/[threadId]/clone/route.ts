import { NextResponse } from "next/server";
import { cloneThread, getThread } from "@/lib/store";
import { requireTenantContext } from "@/lib/auth/requestContext";

interface Params {
  params: Promise<{ threadId: string }>;
}

export async function POST(_: Request, { params }: Params) {
  try {
    const context = await requireTenantContext();
    const { threadId } = await params;
    const thread = getThread(context.tenantId, threadId);
    if (!thread) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    const cloned = cloneThread(context.tenantId, thread);
    return NextResponse.json({ thread: cloned });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
