import { NextResponse } from "next/server";
import { getStripeClient } from "@/lib/billing/stripe";
import { buildLiteLinkUrl } from "@/lib/lite/url";
import { getLiteLinkWithWorkbookByToken } from "@/lib/lite/service";
import { setLiteLinkCheckoutSession } from "@/lib/lite/store";
import { isMockAgenticFlowEnabled } from "@/lib/testing/mock-agentic-flow";

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const link = await getLiteLinkWithWorkbookByToken(token);

  if (!link) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (isMockAgenticFlowEnabled()) {
    const mockSessionId = `mock_checkout_${token}`;
    await setLiteLinkCheckoutSession(token, mockSessionId);
    return NextResponse.json({ url: `${buildLiteLinkUrl(token, request)}?checkout=mock` });
  }

  try {
    const stripe = getStripeClient();
    const successUrl = `${buildLiteLinkUrl(token, request)}?checkout=success`;
    const cancelUrl = `${buildLiteLinkUrl(token, request)}?checkout=canceled`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: link.buyerEmail,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        kind: "lite_link",
        liteLinkToken: token,
        buyerEmail: link.buyerEmail,
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: link.currency,
            unit_amount: link.priceCents,
            product_data: {
              name: `TenantMatch workbook for ${link.workbook.displayAddress}`,
            },
          },
        },
      ],
    });

    if (session.id) {
      await setLiteLinkCheckoutSession(token, session.id);
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create checkout session." },
      { status: 500 },
    );
  }
}
