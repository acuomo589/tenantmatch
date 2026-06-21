import { getAiConfig } from "@/lib/ai/config";

type ParsedListing = {
  title?: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  squareFootage?: number;
  lotSizeAcres?: number;
  propertyClass?: string;
  listingType?: "FOR_LEASE" | "FOR_SALE" | "BOTH";
  locationDescription?: string;
  listingSummary?: string;
  ownerProvisions?: string;
  leaseTermYears?: number;
  features?: Array<{ featureValueText?: string }>;
  disclosures?: Array<{ text?: string }>;
};

type ListingRecordLike = {
  id: string;
  title: string;
  addressLine1: string;
  city: string;
  state: string;
  postalCode: string;
  squareFootage?: number;
  lotSizeAcres?: number;
  propertyClass?: string;
  listingType?: "FOR_LEASE" | "FOR_SALE" | "BOTH";
  locationDescription?: string;
  listingSummary?: string;
  ownerProvisions?: string;
  leaseTermYears?: number;
  source: "AI_PARSE";
  features: Array<{ featureValueText: string; sourceText: string }>;
  disclosures: Array<{ text: string; sourceText: string; source: "PARSED"; isMaterial: true }>;
  constraints: string[];
  spaces: [];
  contacts: [];
  tenants: [];
};

type AddressOverride = {
  addressLine1: string;
  city?: string;
  state?: string;
  postalCode?: string;
};

const parserSchema = {
  name: "listing_structured_parser",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      title: { type: "string" },
      addressLine1: { type: "string" },
      city: { type: "string" },
      state: { type: "string" },
      postalCode: { type: "string" },
      squareFootage: { type: "number" },
      lotSizeAcres: { type: "number" },
      propertyClass: { type: "string" },
      listingType: { type: "string", enum: ["FOR_LEASE", "FOR_SALE", "BOTH"] },
      locationDescription: { type: "string" },
      listingSummary: { type: "string" },
      ownerProvisions: { type: "string" },
      leaseTermYears: { type: "number" },
      features: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            featureValueText: { type: "string" },
          },
        },
      },
      disclosures: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            text: { type: "string" },
          },
        },
      },
    },
  },
  strict: false,
} as const;

class RetryableParserError extends Error {}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripTrailingLocation(value: string, city?: string, state?: string, postalCode?: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const normalizedCity = city?.trim();
  const normalizedState = state?.trim();
  const normalizedPostalCode = postalCode?.trim();
  const suffixPatterns: RegExp[] = [];

  if (normalizedCity && normalizedState) {
    const cityPattern = escapeRegExp(normalizedCity);
    const statePattern = escapeRegExp(normalizedState);
    const postalPattern = normalizedPostalCode
      ? `(?:\\s*${escapeRegExp(normalizedPostalCode)})?`
      : "(?:\\s*\\d{5}(?:-\\d{4})?)?";

    suffixPatterns.push(new RegExp(`^(.+),\\s*${cityPattern},\\s*${statePattern}${postalPattern}$`, "i"));
    suffixPatterns.push(new RegExp(`^(.+),\\s*${cityPattern}\\s+${statePattern}${postalPattern}$`, "i"));
  }

  suffixPatterns.push(/^(.+),\s*[^,]+,\s*[A-Z]{2}(?:\s*\d{5}(?:-\d{4})?)?$/i);
  suffixPatterns.push(/^(.+),\s*[A-Z]{2}(?:\s*\d{5}(?:-\d{4})?)?$/i);

  for (const pattern of suffixPatterns) {
    const match = trimmed.match(pattern);
    if (match?.[1]?.trim()) {
      return match[1].trim();
    }
  }

  return trimmed;
}

function normalizeParsedListing(parsed: ParsedListing): ListingRecordLike {
  const features = (parsed.features ?? [])
    .map((feature) => feature.featureValueText?.trim() ?? "")
    .filter(Boolean)
    .map((text) => ({ featureValueText: text, sourceText: text }));

  const disclosures = (parsed.disclosures ?? [])
    .map((disclosure) => disclosure.text?.trim() ?? "")
    .filter(Boolean)
    .map((text) => ({ text, sourceText: text, source: "PARSED" as const, isMaterial: true as const }));

  const normalizedTitle = stripTrailingLocation(
    parsed.addressLine1?.trim() || parsed.title?.trim() || "",
    parsed.city,
    parsed.state,
    parsed.postalCode,
  );

  return {
    id: `ai_${Math.random().toString(36).slice(2, 10)}`,
    title: normalizedTitle || parsed.title?.trim() || "Parsed Listing",
    addressLine1: normalizedTitle || "Unknown",
    city: parsed.city?.trim() || "",
    state: parsed.state?.trim() || "",
    postalCode: parsed.postalCode?.trim() || "",
    squareFootage: typeof parsed.squareFootage === "number" ? parsed.squareFootage : undefined,
    lotSizeAcres: typeof parsed.lotSizeAcres === "number" ? parsed.lotSizeAcres : undefined,
    propertyClass: parsed.propertyClass?.trim() || undefined,
    listingType: parsed.listingType,
    locationDescription:
      parsed.locationDescription?.trim() ||
      parsed.listingSummary
        ?.split(/(?<=[.!?])\s+/)
        .find((sentence) => /(located|location|access|route|turnpike|highway|corridor|transit|near|proximity)/i.test(sentence))
        ?.trim() ||
      features
        .map((feature) => feature.featureValueText)
        .find((value) => /(located|location|access|route|turnpike|highway|corridor|transit|near|proximity)/i.test(value)) ||
      undefined,
    listingSummary: parsed.listingSummary?.trim() || undefined,
    ownerProvisions: parsed.ownerProvisions?.trim() || undefined,
    leaseTermYears: typeof parsed.leaseTermYears === "number" ? Math.round(parsed.leaseTermYears) : undefined,
    source: "AI_PARSE",
    features,
    disclosures,
    constraints: disclosures.map((item) => item.text),
    spaces: [],
    contacts: [],
    tenants: [],
  };
}

function parseAddressOverride(value: string): AddressOverride {
  const trimmed = value.trim();
  const match = trimmed.match(/^(.+?),\s*([^,]+),\s*([A-Z]{2})\s*(\d{5})?/i);
  if (!match) {
    return { addressLine1: trimmed };
  }

  return {
    addressLine1: match[1]?.trim() || trimmed,
    city: match[2]?.trim() || undefined,
    state: match[3]?.toUpperCase().trim() || undefined,
    postalCode: match[4]?.trim() || undefined,
  };
}

function applyAddressOverride(listing: ListingRecordLike, override: AddressOverride): ListingRecordLike {
  const city = override.city ?? listing.city;
  const state = override.state ?? listing.state;
  const postalCode = override.postalCode ?? listing.postalCode;
  const normalizedStreet = stripTrailingLocation(override.addressLine1 || listing.addressLine1, city, state, postalCode);

  return {
    ...listing,
    title: normalizedStreet || listing.title,
    addressLine1: normalizedStreet || listing.addressLine1,
    city,
    state,
    postalCode,
  };
}

export async function runStructuredListingParser(
  rawText: string,
  explicitAddress?: string,
  signal?: AbortSignal,
): Promise<ListingRecordLike> {
  const config = getAiConfig();
  if (!config.openAiApiKey) {
    throw new Error("OPENAI_API_KEY is not set.");
  }
  const addressOverride = explicitAddress?.trim() ? parseAddressOverride(explicitAddress) : null;
  const parserInput = addressOverride ? `Explicit listing address: ${explicitAddress}\n\n${rawText}` : rawText;

  console.info("[runStructuredListingParser] request", {
    model: config.listingParserModel,
    explicitAddressProvided: Boolean(addressOverride),
    rawTextLength: parserInput.length,
  });

  const maxAttempts = 2;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.openAiApiKey}`,
      },
      body: JSON.stringify({
        model: config.listingParserModel,
        input: [
          {
            role: "system",
            content:
              "Extract commercial listing details into strict JSON. Prefer concrete values from text. Set addressLine1 to the street address. For locationDescription, capture the strongest location/access phrase from the source text (e.g., near highways, routes, turnpike, transit, or logistics corridors). Also extract ownerProvisions as what ownership is willing to offer the right tenant (e.g., free rent, TI allowance, landlord buildout, rent ramp, flexible term) and leaseTermYears when explicitly stated. Leave missing fields empty.",
          },
          {
            role: "user",
            content: parserInput,
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: parserSchema.name,
            schema: parserSchema.schema,
            strict: false,
          },
        },
        max_output_tokens: 3000,
      }),
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[runStructuredListingParser] upstream failure", {
        status: response.status,
        bodyPreview: errorText.slice(0, 800),
        attempt,
      });
      throw new Error(`Listing parser failed: ${response.status} ${errorText}`);
    }

    const payload = (await response.json()) as {
      output_text?: string;
      output_parsed?: unknown;
      output?: Array<{
        content?: Array<{
          type?: string;
          text?: string;
          json?: unknown;
        }>;
      }>;
    };

    if (payload.output_parsed && typeof payload.output_parsed === "object") {
      console.info("[runStructuredListingParser] using output_parsed object", { attempt });
      const normalized = normalizeParsedListing(payload.output_parsed as ParsedListing);
      return addressOverride ? applyAddressOverride(normalized, addressOverride) : normalized;
    }

    const extractedText =
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

    if (!extractedText) {
      const error = new RetryableParserError("Listing parser did not return parseable output.");
      if (attempt < maxAttempts) {
        console.warn("[runStructuredListingParser] retrying after missing output_parsed / parseable text", {
          attempt,
          hasOutputText: typeof payload.output_text === "string",
          outputItems: payload.output?.length ?? 0,
        });
        continue;
      }
      throw error;
    }

    try {
      const parsed = JSON.parse(extractedText) as ParsedListing;
      console.warn("[runStructuredListingParser] fallback to JSON text parse (output_parsed missing)", {
        attempt,
        extractedLength: extractedText.length,
      });
      const normalized = normalizeParsedListing(parsed);
      return addressOverride ? applyAddressOverride(normalized, addressOverride) : normalized;
    } catch {
      if (attempt < maxAttempts) {
        console.warn("[runStructuredListingParser] retrying after JSON parse failure", {
          attempt,
          extractedPreview: extractedText.slice(0, 400),
        });
        continue;
      }

      console.error("[runStructuredListingParser] JSON parse failure", {
        extractedPreview: extractedText.slice(0, 800),
        attempt,
      });
      throw new Error("Listing parser returned invalid JSON.");
    }
  }

  throw new Error("Listing parser failed after retry.");
}
