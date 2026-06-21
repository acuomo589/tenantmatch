import { NextResponse } from "next/server";
import { getAiConfig } from "@/lib/ai/config";
import { isMockAgenticFlowEnabled, MOCK_LISTING_RESEARCH_ANALYSIS } from "@/lib/testing/mock-agentic-flow";

export const runtime = "nodejs";

type ListingInput = {
  id: string;
  title: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  propertyClass?: string;
  listingType?: string;
  squareFootage?: number;
  lotSizeAcres?: number;
  listingSummary?: string;
  locationDescription?: string;
  ownerProvisions?: string;
  leaseTermYears?: number;
  features?: Array<{ featureValueText?: string; sourceText?: string }>;
  disclosures?: Array<{ text?: string }>;
  contacts?: Array<{ name?: string; role?: string; company?: string }>;
  tenants?: Array<{ tenantName?: string; industry?: string; floorLabel?: string }>;
};

const listingResearchSchema = {
  name: "listing_market_research",
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "listingSummary",
      "marketScore",
      "listingScore",
      "marketRationale",
      "listingRationale",
      "demandSignals",
      "headwinds",
      "assumptions",
      "confidence",
    ],
    properties: {
      listingSummary: { type: "string" },
      marketScore: { type: "integer", minimum: 0, maximum: 100 },
      listingScore: { type: "integer", minimum: 0, maximum: 100 },
      marketRationale: { type: "string" },
      listingRationale: { type: "string" },
      demandSignals: {
        type: "array",
        items: { type: "string" },
        minItems: 2,
        maxItems: 5,
      },
      headwinds: {
        type: "array",
        items: { type: "string" },
        minItems: 2,
        maxItems: 5,
      },
      assumptions: {
        type: "array",
        items: { type: "string" },
        minItems: 1,
        maxItems: 4,
      },
      confidence: {
        type: "string",
        enum: ["Low", "Medium", "High"],
      },
    },
  },
  strict: true,
} as const;

const LISTING_RESEARCH_SYSTEM_PROMPT = `You are a commercial real estate market research analyst.

Use the uploaded listing details and live web research to assess the greater-area market for this asset.
Return strict JSON only.
Be concise, commercial, and evidence-based.
Separate observed facts from inference.`;

type ResponsesPayload = {
  status?: string;
  incomplete_details?: unknown;
  output_parsed?: unknown;
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
      parsed?: unknown;
      json?: unknown;
    }>;
  }>;
};

function extractParsed(payload: ResponsesPayload): unknown {
  if (payload.status === "incomplete") {
    throw new Error(
      `Listing research response incomplete (likely token cap or tool/runtime stop). Details: ${JSON.stringify(payload.incomplete_details ?? {})}`,
    );
  }

  if (payload.output_parsed && typeof payload.output_parsed === "object") return payload.output_parsed;

  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return JSON.parse(payload.output_text);
  }

  const contentItems = payload.output?.flatMap((entry) => entry.content ?? []) ?? [];
  for (const content of contentItems) {
    if (content.parsed && typeof content.parsed === "object") return content.parsed;
    if (content.json && typeof content.json === "object") return content.json;
    if (typeof content.text === "string" && content.text.trim()) {
      try {
        return JSON.parse(content.text);
      } catch {
        // Keep checking other content items.
      }
    }
  }

  throw new Error("Listing research model did not return parseable structured output.");
}

const EXPECTED_ANALYSIS_EXAMPLE = {
  listingSummary:
    "Flexible mid-box industrial listing in the greater Columbus market with regional highway access, workable size, and enough utility for service or light-distribution demand, but not obviously differentiated on building quality.",
  marketScore: 78,
  listingScore: 64,
  marketRationale:
    "The broader Columbus industrial market still benefits from logistics demand, population growth, and infrastructure investment, though leasing velocity has normalized and newer product is creating more tenant choice.",
  listingRationale:
    "This listing has enough size and location utility to compete for practical users, but missing detail on clear height, loading, condition, and power keeps it from screening as a top-tier opportunity.",
  demandSignals: [
    "Regional logistics and service demand remain active in the greater area.",
    "Mid-size users still have deeper demand than very large box requirements.",
  ],
  headwinds: ["Tenant choice has improved versus the tightest years.", "Unknown building specs reduce leasing certainty."],
  assumptions: ["The property competes in the local industrial inventory.", "No major functional obsolescence beyond what was disclosed."],
  confidence: "Medium",
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { listing?: ListingInput };
    const listing = body.listing;
    if (!listing?.addressLine1) {
      return NextResponse.json({ error: "listing is required" }, { status: 400 });
    }

    if (isMockAgenticFlowEnabled()) {
      return NextResponse.json({ analysis: MOCK_LISTING_RESEARCH_ANALYSIS });
    }

    const config = getAiConfig();
    if (!config.openAiApiKey) {
      return NextResponse.json({ error: "OPENAI_API_KEY is not set." }, { status: 500 });
    }

    const listingAddress = [listing.addressLine1, listing.addressLine2, listing.city, listing.state, listing.postalCode]
      .filter(Boolean)
      .join(", ");

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.openAiApiKey}`,
      },
      body: JSON.stringify({
        model: config.listingResearchModel,
        input: [
          { role: "system", content: LISTING_RESEARCH_SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              `Analyze this listing for the UI using current web research.`,
              "",
              `Address: ${listingAddress}`,
              "",
              "Listing JSON:",
              JSON.stringify(listing, null, 2),
              "",
              "Tasks:",
              "- Research current market health in the greater area for this asset's location, building type, size band, and likely occupier or buyer profile.",
              "- Produce a marketScore from 0-100 for the broader market.",
              "- Produce a listingScore from 0-100 for this specific listing within that market.",
              "- Write a short listingSummary that blends the uploaded facts with what the market research implies.",
              "- Keep the analysis specific to this property and this geography, not a generic city summary.",
              "- Do not invent building facts. If something is unknown, state the assumption and lower confidence.",
              "",
              "Scoring guidance:",
              "- marketScore = strength of the broader market right now for this kind of asset in this greater area.",
              "- listingScore = strength of this specific listing relative to that market, based on its known details.",
              "- Be willing to score low.",
              "- 90-100 exceptional, 75-89 strong, 60-74 workable, 40-59 challenged, 0-39 weak.",
              "",
              "Return strict JSON only.",
            ].join("\n"),
          },
        ],
        reasoning: { effort: "low" },
        max_output_tokens: 2400,
        tools: [
          {
            type: "web_search",
            user_location: {
              type: "approximate",
              country: "US",
              city: listing.city || undefined,
              region: listing.state || undefined,
            },
          },
        ],
        tool_choice: "auto",
        text: {
          verbosity: "low",
          format: {
            type: "json_schema",
            name: listingResearchSchema.name,
            schema: listingResearchSchema.schema,
            strict: true,
          },
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Listing research generation failed: ${response.status} ${await response.text()}`);
    }

    const payload = (await response.json()) as ResponsesPayload;
    const analysis = extractParsed(payload);

    return NextResponse.json({ analysis });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected listing research generation failure";
    return NextResponse.json(
      {
        error: message,
        expectedAnalysisPayloadExample: EXPECTED_ANALYSIS_EXAMPLE,
      },
      { status: 500 },
    );
  }
}
