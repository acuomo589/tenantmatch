import { NextResponse } from "next/server";
import { markLiteLinkOpened } from "@/lib/lite/store";

export async function POST(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const link = await markLiteLinkOpened(token);
  if (!link) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, status: link.status });
}
