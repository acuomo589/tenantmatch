const APOLLO_DEFAULT_BASE_URL = "https://api.apollo.io/api/v1";

type ApolloSearchPayload = {
  people?: unknown;
  total_entries?: number;
  pagination?: {
    page?: number;
    per_page?: number;
    has_more?: boolean;
  };
  has_more?: boolean;
};

export type ApolloContact = {
  id: string;
  name: string;
  title: string;
  email?: string;
  confidence: "high" | "medium" | "low";
};

export type ApolloPeopleSearchInput = {
  businessName: string;
  city?: string;
  state?: string;
  category?: string;
  page?: number;
  limit?: number;
};

function getApolloConfig() {
  const apiKey = (process.env.APOLLO_API_KEY || process.env.APOLLO_KEY || "").trim();
  const baseUrl = (process.env.APOLLO_BASE_URL?.trim() || APOLLO_DEFAULT_BASE_URL).replace(/\/$/, "");

  if (!apiKey) {
    throw new Error("APOLLO_API_KEY is not configured");
  }

  return { apiKey, baseUrl };
}

export async function searchApolloPeople(input: ApolloPeopleSearchInput): Promise<{
  contacts: ApolloContact[];
  hasMore: boolean;
  nextCursor: string | null;
}> {
  const { apiKey, baseUrl } = getApolloConfig();
  const page = Math.max(1, input.page ?? 1);
  const limit = Math.max(1, Math.min(25, input.limit ?? 3));
  const location = [input.city, input.state].filter(Boolean).join(", ");

  const requestBody = {
    q_organization_names: [input.businessName],
    ...(input.category ? { q_keywords: input.category } : {}),
    ...(location ? { person_locations: [location] } : {}),
    page,
    per_page: limit,
  };

  const queryParams = new URLSearchParams();
  queryParams.append("q_organization_names[]", input.businessName);
  if (input.category) queryParams.append("q_keywords", input.category);
  if (location) queryParams.append("person_locations[]", location);
  queryParams.append("page", String(page));
  queryParams.append("per_page", String(limit));

  const attempts: Array<{
    endpoint: string;
    method?: "POST" | "GET";
    headers?: Record<string, string>;
    body: Record<string, unknown>;
  }> = [
    {
      endpoint: `${baseUrl}/mixed_people/api_search?${queryParams.toString()}`,
      method: "POST",
      headers: { "x-api-key": apiKey },
      body: {},
    },
    {
      endpoint: `${baseUrl}/mixed_people/search`,
      headers: { "X-Api-Key": apiKey },
      body: requestBody,
    },
    {
      endpoint: `${baseUrl}/mixed_people/search`,
      body: { ...requestBody, api_key: apiKey },
    },
    {
      endpoint: `${baseUrl}/people/search`,
      body: { ...requestBody, api_key: apiKey },
    },
    {
      endpoint: `${baseUrl}/people/search`,
      headers: { "X-Api-Key": apiKey },
      body: requestBody,
    },
  ];

  let payload: ApolloSearchPayload = {};
  let lastError = "Apollo people search failed";

  for (const attempt of attempts) {
    const response = await fetch(attempt.endpoint, {
      method: attempt.method ?? "POST",
      headers: {
        "Content-Type": "application/json",
        ...(attempt.headers ?? {}),
      },
      cache: "no-store",
      body: JSON.stringify(attempt.body),
    });

    const text = await response.text();
    payload = (text ? safeJson(text) : {}) as ApolloSearchPayload;

    if (response.ok) {
      break;
    }

    const message = readApolloErrorMessage(payload);
    lastError = `Apollo people search failed (${response.status})${message ? `: ${message}` : ""}`;

    if (![401, 403, 404, 422].includes(response.status)) {
      throw new Error(lastError);
    }

    if (attempt === attempts[attempts.length - 1]) {
      throw new Error(lastError);
    }
  }

  const people = Array.isArray(payload.people) ? payload.people : [];
  const contacts = people
    .map((person) => mapApolloPersonToContact(person))
    .filter((person): person is ApolloContact => person !== null);

  const hasMore =
    payload.pagination?.has_more ??
    payload.has_more ??
    (typeof payload.total_entries === "number" ? page * limit < payload.total_entries : undefined) ??
    (payload.pagination?.per_page ? contacts.length >= payload.pagination.per_page : contacts.length >= limit);

  return {
    contacts,
    hasMore,
    nextCursor: hasMore ? String(page + 1) : null,
  };
}

function readApolloErrorMessage(payload: ApolloSearchPayload): string | null {
  if (!payload || typeof payload !== "object") return null;
  const value = payload as Record<string, unknown>;
  if (typeof value.error === "string" && value.error.trim()) return value.error.trim();
  if (typeof value.message === "string" && value.message.trim()) return value.message.trim();
  return null;
}

function mapApolloPersonToContact(person: unknown): ApolloContact | null {
  if (!person || typeof person !== "object") return null;
  const value = person as Record<string, unknown>;

  const firstName = typeof value.first_name === "string" ? value.first_name.trim() : "";
  const lastName = typeof value.last_name === "string" ? value.last_name.trim() : "";
  const obfuscatedLast =
    typeof value.last_name_obfuscated === "string" ? value.last_name_obfuscated.trim() : "";
  const nameFromParts = [firstName, lastName || obfuscatedLast].filter(Boolean).join(" ").trim();
  const name =
    nameFromParts ||
    (typeof value.name === "string" ? value.name.trim() : "") ||
    (typeof value.full_name === "string" ? value.full_name.trim() : "");

  if (!name) return null;

  const title =
    (typeof value.title === "string" && value.title.trim()) ||
    (typeof value.headline === "string" && value.headline.trim()) ||
    "Contact";

  const email = typeof value.email === "string" && value.email.trim() ? value.email.trim() : undefined;
  const idSeed =
    (typeof value.id === "string" && value.id.trim()) ||
    email ||
    `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}_${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  return {
    id: `apollo_${idSeed}`,
    name,
    title,
    email,
    confidence: email ? "high" : "medium",
  };
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { raw: text };
  }
}
