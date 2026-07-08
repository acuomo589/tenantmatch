import { getAiConfig } from "@/lib/ai/config";
import { normalizeLiteAddress, presentLiteAddress } from "@/lib/lite/address";
import {
  LITE_DISCOVERY_EMAIL_SOURCE_TYPES,
  type LiteDiscoveryCandidate,
  type LiteDiscoveryEmailSourceType,
  type LiteValidatedDiscovery,
  type LiteVerifiedBrokerContact,
} from "@/lib/lite/types";
import { isMockAgenticFlowEnabled } from "@/lib/testing/mock-agentic-flow";

type ResponsesPayload = {
  output_parsed?: unknown;
  output_text?: string;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
      parsed?: unknown;
      json?: unknown;
    }>;
  }>;
};

const DISCOVERY_QUERY_TEMPLATES = [
  `"{{propertyType}} space for lease" "{{zip}}"`,
  `site:loopnet.com "{{zip}}" "{{propertyType}}" "for lease"`,
  `site:crexi.com "{{zip}}" "{{propertyType}}"`,
] as const;

type DiscoveryCandidateSchema = {
  candidates: LiteDiscoveryCandidate[];
};

type ValidationSchema = {
  listingTitle: string;
  listingAddress: string;
  propertyType: "Retail" | "Industrial" | "Unknown";
  listingContactNames: string[];
  verifiedBrokerContacts: Array<{
    name: string;
    email: string;
    emailSourceType: LiteDiscoveryEmailSourceType;
    emailSourceUrl: string | null;
  }>;
  emailConfidence: "high" | "medium" | "low";
  isListingPage: boolean;
  isActive: boolean;
  notes: string;
};

const MOCK_DISCOVERY_DATA: Array<{
  zip: string;
  sourceUrl: string;
  sourceDomain: string;
  listingTitle: string;
  rawAddress: string;
  propertyTypeGuess: string;
  brokerName: string | null;
  brokerEmail: string | null;
  confidence: "high" | "medium" | "low";
  isListingPage: boolean;
  isActive: boolean;
  emailConfidence: "high" | "medium" | "low";
  listingContactNames: string[];
  verifiedBrokerContacts: LiteVerifiedBrokerContact[];
}> = [
  {
    zip: "01749",
    sourceUrl: "https://loopnet.example/retail-hudson-1",
    sourceDomain: "loopnet.example",
    listingTitle: "Hudson Retail Center",
    rawAddress: "10 Main St, Hudson, MA 01749",
    propertyTypeGuess: "Retail",
    brokerName: "Joseph Gozlan",
    brokerEmail: "joseph@example.com",
    confidence: "high",
    isListingPage: true,
    isActive: true,
    emailConfidence: "high",
    listingContactNames: ["Joseph Gozlan"],
    verifiedBrokerContacts: [
      {
        name: "Joseph Gozlan",
        email: "joseph@example.com",
        emailSourceType: "listing_page",
        emailSourceUrl: "https://loopnet.example/retail-hudson-1",
      },
    ],
  },
  {
    zip: "01749",
    sourceUrl: "https://crexi.example/hudson-industrial-1",
    sourceDomain: "crexi.example",
    listingTitle: "Hudson Flex Industrial",
    rawAddress: "25 River Rd, Hudson, MA 01749",
    propertyTypeGuess: "Industrial",
    brokerName: "Morgan West",
    brokerEmail: "morgan@example.com",
    confidence: "high",
    isListingPage: true,
    isActive: true,
    emailConfidence: "high",
    listingContactNames: ["Morgan West", "Avery Stone"],
    verifiedBrokerContacts: [
      {
        name: "Morgan West",
        email: "morgan@example.com",
        emailSourceType: "broker_profile_page",
        emailSourceUrl: "https://westadvisors.example.com/team/morgan-west",
      },
      {
        name: "Avery Stone",
        email: "avery@example.com",
        emailSourceType: "brokerage_website_page",
        emailSourceUrl: "https://westadvisors.example.com/team/avery-stone",
      },
    ],
  },
  {
    zip: "01749",
    sourceUrl: "https://market.example/hudson-retail-duplicate",
    sourceDomain: "market.example",
    listingTitle: "Hudson Retail Center Duplicate",
    rawAddress: "10 Main St, Hudson, MA 01749",
    propertyTypeGuess: "Retail",
    brokerName: "Joseph Gozlan",
    brokerEmail: "joseph@example.com",
    confidence: "medium",
    isListingPage: true,
    isActive: true,
    emailConfidence: "high",
    listingContactNames: ["Joseph Gozlan"],
    verifiedBrokerContacts: [
      {
        name: "Joseph Gozlan",
        email: "joseph@example.com",
        emailSourceType: "listing_page",
        emailSourceUrl: "https://market.example/hudson-retail-duplicate",
      },
    ],
  },
  {
    zip: "01749",
    sourceUrl: "https://loopnet.example/hudson-no-email",
    sourceDomain: "loopnet.example",
    listingTitle: "Hudson Retail Pad",
    rawAddress: "77 Broad St, Hudson, MA 01749",
    propertyTypeGuess: "Retail",
    brokerName: "Casey Lane",
    brokerEmail: null,
    confidence: "medium",
    isListingPage: true,
    isActive: true,
    emailConfidence: "low",
    listingContactNames: ["Casey Lane"],
    verifiedBrokerContacts: [],
  },
  {
    zip: "01749",
    sourceUrl: "https://loopnet.example/hudson-stale",
    sourceDomain: "loopnet.example",
    listingTitle: "Hudson Former Warehouse",
    rawAddress: "90 South St, Hudson, MA 01749",
    propertyTypeGuess: "Industrial",
    brokerName: "Taylor Brooks",
    brokerEmail: "taylor@example.com",
    confidence: "medium",
    isListingPage: true,
    isActive: false,
    emailConfidence: "high",
    listingContactNames: ["Taylor Brooks"],
    verifiedBrokerContacts: [
      {
        name: "Taylor Brooks",
        email: "taylor@example.com",
        emailSourceType: "listing_page",
        emailSourceUrl: "https://loopnet.example/hudson-stale",
      },
    ],
  },
];

const TRUSTED_EMAIL_SOURCE_TYPES = new Set<LiteDiscoveryEmailSourceType>([
  "listing_page",
  "broker_profile_page",
  "brokerage_website_page",
]);

const CONFIDENCE_SCORES: Record<LiteDiscoveryCandidate["confidence"], number> = {
  high: 3,
  medium: 2,
  low: 1,
};

function extractParsed<T>(payload: ResponsesPayload): T {
  if (payload.output_parsed && typeof payload.output_parsed === "object") {
    return payload.output_parsed as T;
  }

  const text =
    (typeof payload.output_text === "string" ? payload.output_text : undefined) ??
    payload.output
      ?.flatMap((item) => item.content ?? [])
      .map((part) => {
        if (part.parsed && typeof part.parsed === "object") return JSON.stringify(part.parsed);
        if (part.json && typeof part.json === "object") return JSON.stringify(part.json);
        return typeof part.text === "string" ? part.text : undefined;
      })
      .find((value): value is string => typeof value === "string" && value.trim().length > 0);

  if (!text) {
    throw new Error("Discovery model returned no structured output.");
  }

  return JSON.parse(text) as T;
}

function normalizePropertyType(value: string): "Retail" | "Industrial" | "Unknown" {
  const normalized = value.trim().toLowerCase();
  if (normalized.includes("industrial")) return "Industrial";
  if (normalized.includes("retail")) return "Retail";
  return "Unknown";
}

function normalizeEmailSourceType(value: string | null | undefined): LiteDiscoveryEmailSourceType {
  if (!value) return "unknown";
  const normalized = value.trim().toLowerCase();
  if (LITE_DISCOVERY_EMAIL_SOURCE_TYPES.includes(normalized as LiteDiscoveryEmailSourceType)) {
    return normalized as LiteDiscoveryEmailSourceType;
  }
  return "unknown";
}

function normalizePersonKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeVerifiedBrokerContacts(
  contacts: ValidationSchema["verifiedBrokerContacts"],
  fallbackListingUrl: string,
): LiteVerifiedBrokerContact[] {
  return contacts
    .map((contact) => ({
      name: contact.name.trim(),
      email: contact.email.trim(),
      emailSourceType: normalizeEmailSourceType(contact.emailSourceType),
      emailSourceUrl:
        normalizeEmailSourceType(contact.emailSourceType) === "listing_page"
          ? contact.emailSourceUrl?.trim() || fallbackListingUrl
          : contact.emailSourceUrl?.trim() || null,
    }))
    .filter((contact) => Boolean(contact.name) && Boolean(contact.email));
}

export function getOrderedTrustedLiteBrokerContacts(candidate: LiteValidatedDiscovery): LiteVerifiedBrokerContact[] {
  const trustedContacts = candidate.verifiedBrokerContacts.filter((contact) => {
    if (!TRUSTED_EMAIL_SOURCE_TYPES.has(contact.emailSourceType)) {
      return false;
    }

    if (contact.emailSourceType !== "listing_page" && !contact.emailSourceUrl?.trim()) {
      return false;
    }

    return Boolean(contact.name.trim()) && Boolean(contact.email.trim());
  });

  if (!trustedContacts.length) {
    return [];
  }

  const orderedContacts: LiteVerifiedBrokerContact[] = [];
  const seenEmails = new Set<string>();

  for (const listingContactName of candidate.listingContactNames.map((name) => name.trim()).filter(Boolean)) {
    const listingKey = normalizePersonKey(listingContactName);
    const match = trustedContacts.find((contact) => normalizePersonKey(contact.name) === listingKey);
    if (!match) {
      continue;
    }

    const emailKey = match.email.trim().toLowerCase();
    if (seenEmails.has(emailKey)) {
      continue;
    }

    orderedContacts.push({
      ...match,
      name: listingContactName,
    });
    seenEmails.add(emailKey);
  }

  for (const contact of trustedContacts) {
    const emailKey = contact.email.trim().toLowerCase();
    if (seenEmails.has(emailKey)) {
      continue;
    }

    orderedContacts.push(contact);
    seenEmails.add(emailKey);
  }

  return orderedContacts;
}

export function selectPreferredLiteBrokerContact(args: {
  listingContactNames: string[];
  verifiedBrokerContacts: LiteVerifiedBrokerContact[];
}): LiteVerifiedBrokerContact | null {
  return (
    getOrderedTrustedLiteBrokerContacts({
      sourceUrl: "",
      sourceDomain: "",
      listingTitle: "",
      listingAddress: "",
      normalizedAddress: "",
      propertyType: "Unknown",
      listingContactNames: args.listingContactNames,
      verifiedBrokerContacts: args.verifiedBrokerContacts,
      brokerName: null,
      brokerEmail: null,
      brokerEmailSourceType: "unknown",
      brokerEmailSourceUrl: null,
      isListingPage: true,
      isActive: true,
      emailConfidence: "high",
      notes: "",
    })[0] ?? null
  );
}

function buildSourceDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function classifyListingSource(candidate: LiteDiscoveryCandidate): number {
  const url = candidate.sourceUrl.toLowerCase();
  const domain = (candidate.sourceDomain || buildSourceDomain(candidate.sourceUrl)).toLowerCase();

  if (domain.includes("crexi.com") && url.includes("/lease/properties/")) return 4;
  if (domain.includes("crexi.com") && url.includes("/properties/")) return 4;
  if (domain.includes("loopnet.com") && url.includes("/listing/")) return 4;
  if (domain.includes("showcase.com")) return 4;
  if (domain.includes("commercialsearch.com")) return 3;
  if (domain.includes("commercialcafe.com")) return 3;
  if (domain.includes("property-record")) return 1;
  return 2;
}

function compareDiscoveryCandidates(left: LiteDiscoveryCandidate, right: LiteDiscoveryCandidate): number {
  const confidenceDelta = CONFIDENCE_SCORES[right.confidence] - CONFIDENCE_SCORES[left.confidence];
  if (confidenceDelta !== 0) {
    return confidenceDelta;
  }

  const sourceDelta = classifyListingSource(right) - classifyListingSource(left);
  if (sourceDelta !== 0) {
    return sourceDelta;
  }

  return 0;
}

export function rankLiteDiscoveryCandidates(candidates: LiteDiscoveryCandidate[]): LiteDiscoveryCandidate[] {
  return [...candidates].sort(compareDiscoveryCandidates);
}

async function postOpenAiResponses(body: Record<string, unknown>): Promise<Response> {
  const config = getAiConfig();
  if (!config.openAiApiKey) {
    throw new Error("OPENAI_API_KEY is not set.");
  }

  try {
    return await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.openAiApiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(config.timeoutMs),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new Error(`OpenAI Responses request timed out after ${config.timeoutMs}ms.`);
    }
    throw error;
  }
}

async function runDiscoverySearch(args: {
  zip: string;
  propertyType: "Retail" | "Industrial";
  query: string;
}): Promise<LiteDiscoveryCandidate[]> {
  const config = getAiConfig();

  const response = await postOpenAiResponses({
      model: config.listingResearchModel,
      input: [
        {
          role: "system",
          content:
            "You are finding public commercial real estate listings. Use web search. Return strict JSON only. Prefer direct listing pages over summaries or directory pages.",
        },
        {
          role: "user",
          content: [
            `Search query: ${args.query}`,
            `ZIP: ${args.zip}`,
            `Target property type: ${args.propertyType}`,
            "Return up to 8 public listing-page candidates.",
            "Only include candidates that look like commercial listings for lease or sale.",
            "If broker name or email is not visible, return null for that field.",
          ].join("\n"),
        },
      ],
      tools: [
        {
          type: "web_search",
          user_location: {
            type: "approximate",
            country: "US",
          },
        },
      ],
      tool_choice: "auto",
      max_output_tokens: 2000,
      text: {
        format: {
          type: "json_schema",
          name: "lite_discovery_candidates",
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["candidates"],
            properties: {
              candidates: {
                type: "array",
                maxItems: 8,
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: [
                    "sourceUrl",
                    "sourceDomain",
                    "listingTitle",
                    "rawAddress",
                    "propertyTypeGuess",
                    "brokerName",
                    "brokerEmail",
                    "confidence",
                  ],
                  properties: {
                    sourceUrl: { type: "string" },
                    sourceDomain: { type: "string" },
                    listingTitle: { type: "string" },
                    rawAddress: { type: "string" },
                    propertyTypeGuess: { type: "string" },
                    brokerName: { type: ["string", "null"] },
                    brokerEmail: { type: ["string", "null"] },
                    confidence: {
                      type: "string",
                      enum: ["high", "medium", "low"],
                    },
                  },
                },
              },
            },
          },
          strict: true,
        },
      },
    });

  if (!response.ok) {
    throw new Error(`ZIP discovery search failed: ${response.status} ${await response.text()}`);
  }

  const payload = extractParsed<DiscoveryCandidateSchema>((await response.json()) as ResponsesPayload);
  return payload.candidates.map((candidate) => ({
    ...candidate,
    sourceDomain: candidate.sourceDomain || buildSourceDomain(candidate.sourceUrl),
  }));
}

export function hasTrustedLiteBrokerEmail(candidate: LiteValidatedDiscovery): boolean {
  return candidate.emailConfidence === "high" && getOrderedTrustedLiteBrokerContacts(candidate).length > 0;
}

export async function discoverLiteZipCandidates(args: {
  zip: string;
  propertyTypes: Array<"Retail" | "Industrial">;
}): Promise<LiteDiscoveryCandidate[]> {
  if (isMockAgenticFlowEnabled()) {
    return MOCK_DISCOVERY_DATA.filter((item) => item.zip === args.zip).map((item) => ({
      sourceUrl: item.sourceUrl,
      sourceDomain: item.sourceDomain,
      listingTitle: item.listingTitle,
      rawAddress: item.rawAddress,
      propertyTypeGuess: item.propertyTypeGuess,
      brokerName: item.brokerName,
      brokerEmail: item.brokerEmail,
      confidence: item.confidence,
    }));
  }

  const queryJobs = args.propertyTypes.flatMap((propertyType) =>
    DISCOVERY_QUERY_TEMPLATES.map((template) => ({
      propertyType,
      query: template.replace("{{propertyType}}", propertyType).replace("{{zip}}", args.zip),
    })),
  );
  const results = await Promise.all(
    queryJobs.map((job) =>
      runDiscoverySearch({
        zip: args.zip,
        propertyType: job.propertyType,
        query: job.query,
      }),
    ),
  );
  const aggregated = new Map<string, LiteDiscoveryCandidate>();

  for (const candidates of results) {
    for (const candidate of candidates) {
      aggregated.set(candidate.sourceUrl, candidate);
    }
  }

  return Array.from(aggregated.values());
}

export async function validateLiteDiscoveredCandidate(args: {
  zip: string;
  candidate: LiteDiscoveryCandidate;
}): Promise<LiteValidatedDiscovery> {
  if (isMockAgenticFlowEnabled()) {
    const matched = MOCK_DISCOVERY_DATA.find((item) => item.sourceUrl === args.candidate.sourceUrl);
    const listingAddress = presentLiteAddress(matched?.rawAddress || args.candidate.rawAddress);
    const verifiedBrokerContacts = matched?.verifiedBrokerContacts ?? [];
    const listingContactNames = matched?.listingContactNames ?? [];
    const preferredBroker = selectPreferredLiteBrokerContact({
      listingContactNames,
      verifiedBrokerContacts,
    });
    return {
      sourceUrl: args.candidate.sourceUrl,
      sourceDomain: args.candidate.sourceDomain || buildSourceDomain(args.candidate.sourceUrl),
      listingTitle: matched?.listingTitle || args.candidate.listingTitle,
      listingAddress,
      normalizedAddress: normalizeLiteAddress(listingAddress),
      propertyType: normalizePropertyType(matched?.propertyTypeGuess || args.candidate.propertyTypeGuess) as
        | "Retail"
        | "Industrial"
        | "Unknown",
      listingContactNames,
      verifiedBrokerContacts,
      brokerName: preferredBroker?.name ?? listingContactNames[0] ?? matched?.brokerName ?? args.candidate.brokerName,
      brokerEmail: preferredBroker?.email ?? matched?.brokerEmail ?? args.candidate.brokerEmail,
      brokerEmailSourceType: preferredBroker?.emailSourceType ?? "unknown",
      brokerEmailSourceUrl: preferredBroker?.emailSourceUrl ?? null,
      isListingPage: matched?.isListingPage ?? true,
      isActive: matched?.isActive ?? true,
      emailConfidence: matched?.emailConfidence ?? "high",
      notes:
        matched?.isActive === false
          ? "Listing appears stale or off-market."
          : matched?.verifiedBrokerContacts?.[0]?.emailSourceType === "broker_profile_page"
            ? "Mock validation passed. Broker email was confirmed on an official broker profile page."
            : "Mock validation passed.",
    };
  }

  const config = getAiConfig();

  const response = await postOpenAiResponses({
      model: config.listingResearchModel,
      input: [
        {
          role: "system",
          content:
            "You validate public commercial real estate listing candidates with web search. Be conservative. Return strict JSON only.",
        },
        {
          role: "user",
          content: JSON.stringify(
            {
              request: "Validate this listing candidate as a real active public listing page in the target ZIP.",
              zip: args.zip,
              candidate: args.candidate,
              rules: [
                "Confirm whether this is truly a commercial listing page, not a directory or article.",
                "Confirm whether the listing appears active/open rather than stale or off-market.",
                "Resolve the listing address if possible.",
                "Resolve property type to Retail or Industrial when justified, else Unknown.",
                "Extract all named listing contacts shown on the listing page in the same displayed order.",
                "You may use a trusted secondary source for the broker email only after confirming the listing page is real and active.",
                "Trusted secondary sources are limited to official broker profile pages and official brokerage website pages that clearly match the broker or brokerage on the listing.",
                "Do not use generic directories, people-search pages, social profiles, data brokers, or guessed email patterns.",
                "Return verifiedBrokerContacts only for contacts whose email is explicitly present on the listing page itself, an official broker profile page, or an official brokerage website page clearly tied to the named listing broker or brokerage.",
                "If multiple listing contacts are named, attempt to verify each one conservatively and return each verified contact separately.",
                "Keep listingContactNames in listing-page order. The first verified listing contact should be treated as the preferred outreach target.",
                "If an email comes from a secondary source, set emailSourceType accordingly, return the exact emailSourceUrl, and explain the linkage in notes.",
              ],
            },
            null,
            2,
          ),
        },
      ],
      tools: [
        {
          type: "web_search",
          user_location: {
            type: "approximate",
            country: "US",
          },
        },
      ],
      tool_choice: "auto",
      max_output_tokens: 1600,
      text: {
        format: {
          type: "json_schema",
          name: "lite_discovery_validation",
          schema: {
            type: "object",
            additionalProperties: false,
            required: [
              "listingTitle",
              "listingAddress",
              "propertyType",
              "listingContactNames",
              "verifiedBrokerContacts",
              "emailConfidence",
              "isListingPage",
              "isActive",
              "notes",
            ],
            properties: {
              listingTitle: { type: "string" },
              listingAddress: { type: "string" },
              propertyType: {
                type: "string",
                enum: ["Retail", "Industrial", "Unknown"],
              },
              listingContactNames: {
                type: "array",
                items: { type: "string" },
                maxItems: 10,
              },
              verifiedBrokerContacts: {
                type: "array",
                maxItems: 10,
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["name", "email", "emailSourceType", "emailSourceUrl"],
                  properties: {
                    name: { type: "string" },
                    email: { type: "string" },
                    emailSourceType: {
                      type: "string",
                      enum: [...LITE_DISCOVERY_EMAIL_SOURCE_TYPES],
                    },
                    emailSourceUrl: { type: ["string", "null"] },
                  },
                },
              },
              emailConfidence: {
                type: "string",
                enum: ["high", "medium", "low"],
              },
              isListingPage: { type: "boolean" },
              isActive: { type: "boolean" },
              notes: { type: "string" },
            },
          },
          strict: true,
        },
      },
    });

  if (!response.ok) {
    throw new Error(`ZIP discovery validation failed: ${response.status} ${await response.text()}`);
  }

  const payload = extractParsed<ValidationSchema>((await response.json()) as ResponsesPayload);
  const listingAddress = presentLiteAddress(payload.listingAddress || args.candidate.rawAddress);
  const verifiedBrokerContacts = normalizeVerifiedBrokerContacts(payload.verifiedBrokerContacts, args.candidate.sourceUrl);
  const listingContactNames = payload.listingContactNames.map((name) => name.trim()).filter(Boolean);
  const preferredBroker = selectPreferredLiteBrokerContact({
    listingContactNames,
    verifiedBrokerContacts,
  });

  return {
    sourceUrl: args.candidate.sourceUrl,
    sourceDomain: args.candidate.sourceDomain || buildSourceDomain(args.candidate.sourceUrl),
    listingTitle: payload.listingTitle || args.candidate.listingTitle,
    listingAddress,
    normalizedAddress: normalizeLiteAddress(listingAddress),
    propertyType: normalizePropertyType(payload.propertyType),
    listingContactNames,
    verifiedBrokerContacts,
    brokerName: preferredBroker?.name ?? listingContactNames[0] ?? args.candidate.brokerName,
    brokerEmail: preferredBroker?.email ?? null,
    brokerEmailSourceType: preferredBroker?.emailSourceType ?? "unknown",
    brokerEmailSourceUrl: preferredBroker?.emailSourceUrl ?? null,
    isListingPage: payload.isListingPage,
    isActive: payload.isActive,
    emailConfidence: payload.emailConfidence,
    notes: payload.notes,
  };
}
