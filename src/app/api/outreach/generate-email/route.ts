import { NextResponse } from "next/server";
import { getAiConfig } from "@/lib/ai/config";
import type { WorkbookRow } from "@/lib/workbookCsv";

type ListingInput = {
  title?: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  propertyClass?: string;
  listingSummary?: string;
  ownerProvisions?: string;
  leaseTermYears?: number;
};

type ContactInput = {
  name?: string;
  title?: string;
  email?: string;
};

export async function POST(request: Request) {
  const requestId = `outreach_email_${Math.random().toString(36).slice(2, 8)}`;

  try {
    const body = (await request.json()) as {
      listing?: ListingInput;
      workbookRow?: WorkbookRow;
      contact?: ContactInput | null;
    };

    if (!body.listing || !body.workbookRow) {
      return NextResponse.json({ error: "listing and workbookRow are required" }, { status: 400 });
    }

    const config = getAiConfig();
    if (!config.openAiApiKey) {
      return NextResponse.json({ error: "OPENAI_API_KEY is not set." }, { status: 500 });
    }

    const listingAddress = [body.listing.addressLine1, body.listing.city, body.listing.state, body.listing.postalCode]
      .filter(Boolean)
      .join(", ");

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.openAiApiKey}`,
      },
      body: JSON.stringify({
        model: config.outreachEmailModel,
        input: [
          {
            role: "system",
            content:
              "You are an outreach email agent for commercial real estate leasing. Generate a concise, professional outbound email tailored to one target business. Return STRICT JSON only with keys: subject (string), body (string). Body must be plain text, no markdown. Keep under 300 words.",
          },
          {
            role: "user",
            content: JSON.stringify(
              {
                request: "Generate a first-touch leasing outreach email",
                listing: {
                  title: body.listing.title,
                  address: listingAddress,
                  propertyClass: body.listing.propertyClass,
                  listingSummary: body.listing.listingSummary,
                  ownerProvisions: body.listing.ownerProvisions,
                  leaseTermYears: body.listing.leaseTermYears,
                },
                targetBusiness: body.workbookRow,
                selectedContact: body.contact,
                styleReference:
                  "Start with location + opportunity, mention fit based on operational context, mention owner flexibility/provisions when available, and close with a specific CTA for a quick call this week.",
              },
              null,
              2,
            ),
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "outreach_email",
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                subject: { type: "string" },
                body: { type: "string" },
              },
              required: ["subject", "body"],
            },
            strict: true,
          },
        },
        max_output_tokens: 1200,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[outreach/generate-email] upstream failure", {
        requestId,
        status: response.status,
        bodyPreview: errorText.slice(0, 600),
      });
      return NextResponse.json({ error: `Email generation failed: ${response.status}` }, { status: 500 });
    }

    const payload = (await response.json()) as {
      output_parsed?: unknown;
      output_text?: string;
    };

    let subject = "";
    let emailBody = "";

    if (payload.output_parsed && typeof payload.output_parsed === "object") {
      const parsed = payload.output_parsed as { subject?: unknown; body?: unknown };
      subject = typeof parsed.subject === "string" ? parsed.subject.trim() : "";
      emailBody = typeof parsed.body === "string" ? parsed.body.trim() : "";
    }

    if ((!subject || !emailBody) && typeof payload.output_text === "string") {
      try {
        const fallback = JSON.parse(payload.output_text) as { subject?: unknown; body?: unknown };
        subject = subject || (typeof fallback.subject === "string" ? fallback.subject.trim() : "");
        emailBody = emailBody || (typeof fallback.body === "string" ? fallback.body.trim() : "");
      } catch {
        // ignore
      }
    }

    if (!subject || !emailBody) {
      return NextResponse.json({ error: "Model returned invalid email payload." }, { status: 500 });
    }

    return NextResponse.json({ subject, body: emailBody });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected outreach email generation failure";
    console.error("[outreach/generate-email] unexpected failure", { requestId, error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}