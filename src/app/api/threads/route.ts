import { NextResponse } from "next/server";
import { listThreads } from "@/lib/store";

export async function GET() {
  return NextResponse.json({ threads: listThreads() });
}
