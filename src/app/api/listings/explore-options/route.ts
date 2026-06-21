import { NextResponse } from "next/server";
import { getAiConfig } from "@/lib/ai/config";
import { isMockAgenticFlowEnabled, MOCK_EXPLORE_OPTIONS_ANALYSIS } from "@/lib/testing/mock-agentic-flow";

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

const exploreOptionsSchema = {
  name: "explore_options_analysis",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["propertySnapshot", "finalVerdict", "developerSummary", "redFlags", "scenarios"],
    properties: {
      propertySnapshot: { type: "string" },
      finalVerdict: {
        type: "string",
        enum: ["Strong candidate", "Worth exploring", "Only works with subsidy or basis reset", "Pass"],
      },
      developerSummary: { type: "string" },
      redFlags: {
        type: "array",
        items: { type: "string" },
      },
      scenarios: {
        type: "array",
        minItems: 2,
        maxItems: 4,
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "id",
            "name",
            "whyItFits",
            "whatMustBeTrue",
            "scopeLevel",
            "entitlementDifficulty",
            "operatorSkillRequired",
            "exitFlipability",
            "timeline",
            "financeability",
            "hardCostPerSfUsd",
            "softCostPct",
            "contingencyPct",
            "totalProjectCostLowUsd",
            "totalProjectCostHighUsd",
            "targetTenantOrBuyer",
            "revenueModel",
            "exitStrategy",
            "marginView",
            "buildOutScope",
            "incentives",
            "killPoints",
          ],
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            whyItFits: { type: "string" },
            whatMustBeTrue: { type: "array", items: { type: "string" } },
            scopeLevel: {
              type: "string",
              enum: ["Light reposition", "Heavy rehab", "Gut renovation", "Partial demo", "Teardown"],
            },
            entitlementDifficulty: { type: "string", enum: ["Low", "Medium", "High"] },
            operatorSkillRequired: { type: "string" },
            exitFlipability: { type: "string" },
            timeline: { type: "string" },
            financeability: { type: "string", enum: ["Low", "Medium", "High"] },
            hardCostPerSfUsd: { type: "string" },
            softCostPct: { type: "string" },
            contingencyPct: { type: "string" },
            totalProjectCostLowUsd: { type: "string" },
            totalProjectCostHighUsd: { type: "string" },
            targetTenantOrBuyer: { type: "string" },
            revenueModel: { type: "string" },
            exitStrategy: { type: "string" },
            marginView: { type: "string", enum: ["Strong", "Thin", "Negative/speculative"] },
            buildOutScope: {
              type: "array",
              items: { type: "string" },
            },
            incentives: {
              type: "array",
              items: { type: "string" },
            },
            killPoints: {
              type: "array",
              items: { type: "string" },
            },
          },
        },
      },
    },
  },
  strict: true,
} as const;

const EXPLORE_OPTIONS_SYSTEM_PROMPT = `You are a senior commercial real estate developer, zoning analyst, adaptive-reuse specialist, and credit-focused real estate underwriter.

Your task is to return a decision-grade investment analysis in STRICT JSON matching the provided schema.

Rules:
- Be blunt and commercial.
- Distinguish known facts from assumptions.
- Use practical ranges; avoid fake precision.
- Return 2-4 realistic scenarios only.
- Exclude speculative or legally implausible paths.
- Keep each field concise and useful for UI cards.
- Do not include markdown.`;

function extractParsed(payload: {
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
}): unknown {
  if (payload.status === "incomplete") {
    throw new Error(
      `Explore options response incomplete (likely token cap or tool/runtime stop). Details: ${JSON.stringify(payload.incomplete_details ?? {})}`,
    );
  }

  if (payload.output_parsed && typeof payload.output_parsed === "object") return payload.output_parsed;

  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return safeParseJson(payload.output_text);
  }

  const contentItems = payload.output?.flatMap((entry) => entry.content ?? []) ?? [];
  for (const content of contentItems) {
    if (content.parsed && typeof content.parsed === "object") return content.parsed;
    if (content.json && typeof content.json === "object") return content.json;
    if (typeof content.text === "string" && content.text.trim()) {
      try {
        return safeParseJson(content.text);
      } catch {
        // Continue trying other content items.
      }
    }
  }

  throw new Error("Explore options model did not return parseable structured output.");
}

function safeParseJson(value: string): unknown {
  return JSON.parse(value);
}

const EXPECTED_ANALYSIS_EXAMPLE = {
  propertySnapshot: "41K SF former office asset with dated interiors; strong arterial access; moderate parking constraints.",
  finalVerdict: "Worth exploring",
  developerSummary: "Viable if basis is disciplined and tenanting strategy is pre-leased before major capex.",
  redFlags: ["Potential zoning friction for change of use", "Unknown HVAC/electrical upgrade scope"],
  scenarios: [
    {
      id: "s1",
      name: "Medical office reposition",
      whyItFits: "Existing floorplate and access support outpatient tenancy with moderate retrofit.",
      whatMustBeTrue: ["Parking ratio accepted by code", "Anchor medical tenant pre-LOI"],
      scopeLevel: "Heavy rehab",
      entitlementDifficulty: "Medium",
      operatorSkillRequired: "Healthcare tenant improvement execution",
      exitFlipability: "High if leased",
      timeline: "12-18 months",
      financeability: "Medium",
      hardCostPerSfUsd: "$90-$140/SF",
      softCostPct: "18%-24%",
      contingencyPct: "10%-12%",
      totalProjectCostLowUsd: "$8.5M",
      totalProjectCostHighUsd: "$12.4M",
      targetTenantOrBuyer: "Regional medical groups",
      revenueModel: "NNN leases with annual escalations",
      exitStrategy: "Sell stabilized at year 3-5",
      marginView: "Thin",
      buildOutScope: ["MEP upgrades", "Lobby and common area refresh"],
      incentives: ["Local facade grant (if eligible)"],
      killPoints: ["Cost bids exceed $150/SF", "No pre-leasing traction by DD milestone"],
    },
  ],
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { listing?: ListingInput };
    const listing = body.listing;
    if (!listing?.addressLine1) {
      return NextResponse.json({ error: "listing is required" }, { status: 400 });
    }

    if (isMockAgenticFlowEnabled()) {
      return NextResponse.json({ analysis: MOCK_EXPLORE_OPTIONS_ANALYSIS });
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
        model: config.exploreOptionsModel,
        input: [
          { role: "system", content: EXPLORE_OPTIONS_SYSTEM_PROMPT },
          {
            role: "user",
            content: `Address: ${listingAddress}\n\nListing context JSON:\n${JSON.stringify(listing, null, 2)}\n\nAnalyze this property now and return strict JSON only.`,
          },
        ],
        reasoning: { effort: "low" },
        max_output_tokens: 3200,
        text: {
          verbosity: "low",
          format: {
            type: "json_schema",
            name: exploreOptionsSchema.name,
            schema: exploreOptionsSchema.schema,
            strict: true,
          },
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Explore options generation failed: ${response.status} ${await response.text()}`);
    }

    const payload = (await response.json()) as {
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
    const analysis = extractParsed(payload);

    return NextResponse.json({ analysis });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected explore options generation failure";
    return NextResponse.json(
      {
        error: message,
        expectedAnalysisPayloadExample: EXPECTED_ANALYSIS_EXAMPLE,
      },
      { status: 500 },
    );
  }
}
