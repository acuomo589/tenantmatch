import { NextResponse } from "next/server";
import { requireTenantContext } from "@/lib/auth/requestContext";
import { findPlanByCode } from "@/lib/billing/plans";
import { prisma } from "@/lib/db";
import { getStripeClient } from "@/lib/billing/stripe";

type CheckoutRequest = {
  planCode?: "PLUS" | "PRO";
};

export async function POST(request: Request) {
  try {
    const context = await requireTenantContext();
    const body = (await request.json()) as CheckoutRequest;
    const planCode = body.planCode;

    if (!planCode || (planCode !== "PLUS" && planCode !== "PRO")) {
      return NextResponse.json({ error: "planCode must be PLUS or PRO" }, { status: 400 });
    }

    const plan = findPlanByCode(planCode);
    if (!plan?.stripePriceId) {
      return NextResponse.json({ error: `${planCode} is not configured for checkout yet.` }, { status: 400 });
    }

    const membership = await prisma.tenantMembership.findFirst({ where: { tenantId: context.tenantId, userId: context.user.id } });
    if (!membership) {
      return NextResponse.json({ error: "Membership not found." }, { status: 404 });
    }

    const stripe = getStripeClient();
    const origin = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: plan.stripePriceId, quantity: 1 }],
      success_url: `${origin}/workspace?billing=success`,
      cancel_url: `${origin}/pricing?billing=canceled`,
      metadata: {
        tenantId: context.tenantId,
        planCode,
      },
      customer_email: context.user.email,
      allow_promotion_codes: true,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : "Failed to create checkout session.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
