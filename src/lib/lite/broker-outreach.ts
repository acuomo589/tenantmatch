import { getAiConfig } from "@/lib/ai/config";
import { isMockAgenticFlowEnabled } from "@/lib/testing/mock-agentic-flow";

type ResponsesPayload = {
  output_parsed?: unknown;
  output_text?: string;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
      json?: unknown;
    }>;
  }>;
};

export type LiteBrokerOutreachDraft = {
  subject: string;
  body: string;
};

export function buildLiteBrokerOutreachFallbackDraft(args: {
  listingAddress: string;
  propertyType: string;
  brokerName: string | null;
  paywallLink: string;
}): LiteBrokerOutreachDraft {
  return {
    subject: `TenantMatch workbook for ${args.listingAddress}`,
    body: [
      `Hi ${args.brokerName || "there"},`,
      "",
      `I put together a TenantMatch workbook for ${args.listingAddress} with 25 best-fit ${args.propertyType.toLowerCase()} prospects showing current market signals.`,
      `You can preview it here: ${args.paywallLink}`,
      "",
      "If useful, I can run more listings in your inventory as well.",
      "",
      "Best,",
      "Mike at TenantMatch",
    ].join("\n"),
  };
}

function extractJson(payload: ResponsesPayload): LiteBrokerOutreachDraft {
  if (payload.output_parsed && typeof payload.output_parsed === "object") {
    const parsed = payload.output_parsed as { subject?: unknown; body?: unknown };
    if (typeof parsed.subject === "string" && typeof parsed.body === "string") {
      return {
        subject: parsed.subject.trim(),
        body: parsed.body.trim(),
      };
    }
  }

  const text =
    (typeof payload.output_text === "string" ? payload.output_text : undefined) ??
    payload.output
      ?.flatMap((item) => item.content ?? [])
      .map((part) => {
        if (typeof part.text === "string") return part.text;
        if ((part.type === "output_json" || part.type === "json") && part.json != null) {
          return JSON.stringify(part.json);
        }
        return undefined;
      })
      .find((value): value is string => typeof value === "string" && value.trim().length > 0);

  if (!text) {
    throw new Error("Broker outreach model returned no parseable content.");
  }

  const parsed = JSON.parse(text) as { subject?: unknown; body?: unknown };
  if (typeof parsed.subject !== "string" || typeof parsed.body !== "string") {
    throw new Error("Broker outreach model returned an invalid JSON payload.");
  }

  return {
    subject: parsed.subject.trim(),
    body: parsed.body.trim(),
  };
}

export async function generateLiteBrokerOutreachDraft(args: {
  listingAddress: string;
  listingTitle: string;
  propertyType: string;
  brokerName: string | null;
  brokerEmail: string;
  sourceUrl: string | null;
  paywallLink: string;
}): Promise<LiteBrokerOutreachDraft> {
  if (isMockAgenticFlowEnabled()) {
    return buildLiteBrokerOutreachFallbackDraft(args);
  }

  const config = getAiConfig();
  if (!config.openAiApiKey) {
    throw new Error("OPENAI_API_KEY is not set.");
  }

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
            "You write concise, professional first-touch emails to commercial listing brokers. Return strict JSON only with keys: subject and body. Keep body under 220 words, plain text, no markdown.",
        },
        {
          role: "user",
          content: JSON.stringify(
            {
              request: "Write a short outreach email to the listing broker introducing TenantMatch and the workbook link.",
              sender: "Mike at TenantMatch",
              listing: {
                address: args.listingAddress,
                title: args.listingTitle,
                propertyType: args.propertyType,
                sourceUrl: args.sourceUrl,
              },
              broker: {
                name: args.brokerName,
                email: args.brokerEmail,
              },
              link: args.paywallLink,
              constraints: [
                "Be warm and direct.",
                "Mention the listing address and that the workbook shows 25 best-fit prospects with market signals.",
                "Invite them to take a quick look.",
                "Mention that more listings can be run if useful.",
                "Do not overhype or sound spammy.",
              ],
            },
            null,
            2,
          ),
        },
      ],
      max_output_tokens: 1000,
      text: {
        format: {
          type: "json_schema",
          name: "lite_broker_outreach",
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["subject", "body"],
            properties: {
              subject: { type: "string" },
              body: { type: "string" },
            },
          },
          strict: true,
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Broker outreach generation failed: ${response.status} ${await response.text()}`);
  }

  return extractJson((await response.json()) as ResponsesPayload);
}
