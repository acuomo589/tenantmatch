import { NextResponse } from "next/server";
import { requireTenantContext } from "@/lib/auth/requestContext";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";

export async function GET() {
  try {
    const context = await requireTenantContext();
    const workspaceState = await prisma.workspaceState.findUnique({
      where: { tenantId: context.tenantId },
    });
    const state = workspaceState?.stateJson ?? null;
    return NextResponse.json({ state });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ state: null });
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireTenantContext();
    const body = (await request.json()) as { state?: unknown };
    if (!body || typeof body !== "object" || !("state" in body)) {
      return NextResponse.json({ error: "state is required" }, { status: 400 });
    }

    const stateJson = body.state as Prisma.InputJsonValue;

    await prisma.workspaceState.upsert({
      where: { tenantId: context.tenantId },
      update: { stateJson },
      create: {
        tenantId: context.tenantId,
        stateJson,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : "Failed to persist workspace state.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
