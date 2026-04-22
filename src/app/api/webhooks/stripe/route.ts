import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripeClient } from "@/lib/billing/stripe";
import { PLAN_CATALOG } from "@/lib/billing/plans";
import { prisma } from "@/lib/db";

function resolvePlanCodeFromPriceId(priceId?: string | null): "FREE" | "PLUS" | "PRO" | null {
  if (!priceId) return null;
  const match = PLAN_CATALOG.find((plan) => plan.stripePriceId === priceId);
  return match?.code ?? null;
}

export async function POST(request: Request) {
  try {
    const signature = request.headers.get("stripe-signature");
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!signature || !webhookSecret) {
      return NextResponse.json({ error: "Stripe webhook not configured." }, { status: 400 });
    }

    const stripe = getStripeClient();
    const payload = await request.text();
    const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const tenantId = session.metadata?.tenantId;
      const subscriptionId = typeof session.subscription === "string" ? session.subscription : null;

      if (tenantId && subscriptionId) {
        const subscriptionResponse = await stripe.subscriptions.retrieve(subscriptionId);
        const subscription = subscriptionResponse as unknown as Stripe.Subscription;
        const subscriptionAny = subscription as unknown as {
          current_period_start?: number;
          current_period_end?: number;
          items?: { data?: Array<{ current_period_start?: number; current_period_end?: number }> };
        };

        const periodStartUnix =
          subscriptionAny.current_period_start ??
          subscriptionAny.items?.data?.[0]?.current_period_start ??
          Math.floor(Date.now() / 1000);
        const periodEndUnix =
          subscriptionAny.current_period_end ??
          subscriptionAny.items?.data?.[0]?.current_period_end ??
          periodStartUnix + 30 * 24 * 60 * 60;

        const firstItem = subscription.items.data[0];
        const planCode = resolvePlanCodeFromPriceId(firstItem?.price.id ?? null);

        if (planCode) {
          const plan = await prisma.plan.findUnique({ where: { code: planCode } });
          if (plan) {
            await prisma.tenantSubscription.updateMany({
              where: { tenantId, status: "ACTIVE" },
              data: { status: "CANCELED" },
            });

            await prisma.tenantSubscription.create({
              data: {
                tenantId,
                planId: plan.id,
                status: "ACTIVE",
                stripeCustomerId: typeof session.customer === "string" ? session.customer : null,
                stripeSubscriptionId: subscription.id,
                currentPeriodStart: new Date(periodStartUnix * 1000),
                currentPeriodEnd: new Date(periodEndUnix * 1000),
              },
            });
          }
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook handling failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
