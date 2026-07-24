import { getAiConfig } from "@/lib/ai/config";
import { buildLiteWorkbookPrompt, LITE_WORKBOOK_ROW_COUNT } from "@/lib/lite/prompt";
import { presentLiteAddress } from "@/lib/lite/address";
import { isMockAgenticFlowEnabled, MOCK_WORKBOOK_ROWS } from "@/lib/testing/mock-agentic-flow";
import type { WorkbookRow } from "@/lib/workbookCsv";
import { parseWorkbookCsv } from "@/lib/workbookCsv";

type ResponsesPayload = {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
      json?: unknown;
    }>;
  }>;
};

const EXTRA_MOCK_NAMES = [
  "Metro Packaging Services",
  "Arrowpoint Supply Group",
  "Lakefront Specialty Foods",
  "Redline Assembly Partners",
  "Northstar Service Depot",
  "Union Yard Equipment Co.",
  "Meridian Process Support",
];

const WORKBOOK_REQUEST_MAX_ATTEMPTS = 3;
const WORKBOOK_RETRY_DELAYS_MS = [1000, 2500];
const RETRYABLE_RESPONSE_STATUSES = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function escapeCsvCell(value: string | number): string {
  const stringValue = String(value);
  if (!/[",\n]/.test(stringValue)) return stringValue;
  return `"${stringValue.replaceAll('"', '""')}"`;
}

function buildWorkbookCsv(rows: WorkbookRow[]): string {
  const headers = [
    "business_name",
    "category",
    "property_type",
    "type",
    "city",
    "state",
    "distance_miles",
    "tenant_fit_score_100",
    "move_probability_1_10",
    "priority_rank",
    "fit_summary",
    "rationale",
    "owner_contact_name",
  ];

  return [
    headers.join(","),
    ...rows.map((row) =>
      [
        row.business_name,
        row.category,
        row.property_type,
        row.type,
        row.city,
        row.state,
        row.distance_miles,
        row.tenant_fit_score_100,
        row.move_probability_1_10,
        row.priority_rank,
        row.fit_summary,
        row.rationale,
        row.owner_contact_name,
      ]
        .map(escapeCsvCell)
        .join(","),
    ),
  ].join("\n");
}

function buildMockLiteWorkbookRows(): WorkbookRow[] {
  const seeded = [...MOCK_WORKBOOK_ROWS];

  for (let index = seeded.length; index < LITE_WORKBOOK_ROW_COUNT; index += 1) {
    seeded.push({
      business_name: EXTRA_MOCK_NAMES[index - MOCK_WORKBOOK_ROWS.length] ?? `Prospect ${index + 1}`,
      category: index % 2 === 0 ? "Service logistics" : "Industrial supply",
      property_type: "Industrial",
      type: index < 10 ? "Signal" : "Fit",
      city: index % 3 === 0 ? "Columbus" : "Gahanna",
      state: "OH",
      distance_miles: Number((4.5 + index * 0.7).toFixed(1)),
      tenant_fit_score_100: Math.max(68, 92 - index),
      move_probability_1_10: index < 10 ? Math.max(5, 9 - Math.floor(index / 4)) : Math.max(1, 3 - Math.floor((index - 10) / 5)),
      priority_rank: index + 1,
      fit_summary:
        index < 10
          ? "Expansion signal found - access, loading, and flexible bay depth make this worth a broker call."
          : "No move signal found - access, loading, and flexible bay depth make it a fit-based industrial prospect.",
      rationale: "Clear height and loading fit light industrial users; regional highway access supports distribution economics.",
      owner_contact_name: `Contact ${index + 1}`,
    });
  }

  return seeded.slice(0, LITE_WORKBOOK_ROW_COUNT).map((row, index) => ({
    ...row,
    priority_rank: index + 1,
  }));
}

function extractCsvFromResponsesPayload(payload: ResponsesPayload): string | undefined {
  const extracted =
    (typeof payload.output_text === "string" ? payload.output_text : undefined) ??
    payload.output
      ?.flatMap((item) => item.content ?? [])
      .map((part) => {
        if (typeof part.text === "string") return part.text;
        if ((part.type === "output_json" || part.type === "json") && part.json != null) {
          return typeof part.json === "string" ? part.json : JSON.stringify(part.json);
        }
        return undefined;
      })
      .find((value): value is string => typeof value === "string" && value.trim().length > 0);

  return extracted
    ?.replace(/^```(?:csv)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

function isRetryableWorkbookRequestError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    error.name === "AbortError" ||
    error.name === "TimeoutError" ||
    message.includes("fetch failed") ||
    message.includes("network") ||
    message.includes("timeout")
  );
}

async function fetchWorkbookResponsesWithRetry(args: {
  apiKey: string;
  body: Record<string, unknown>;
  timeoutMs: number;
}): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= WORKBOOK_REQUEST_MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${args.apiKey}`,
        },
        body: JSON.stringify(args.body),
        signal: AbortSignal.timeout(args.timeoutMs),
      });

      if (!RETRYABLE_RESPONSE_STATUSES.has(response.status) || attempt >= WORKBOOK_REQUEST_MAX_ATTEMPTS) {
        return response;
      }

      await response.body?.cancel();
      await sleep(WORKBOOK_RETRY_DELAYS_MS[attempt - 1] ?? WORKBOOK_RETRY_DELAYS_MS.at(-1) ?? 1000);
    } catch (error) {
      lastError = error;
      if (!isRetryableWorkbookRequestError(error) || attempt >= WORKBOOK_REQUEST_MAX_ATTEMPTS) {
        throw error;
      }

      await sleep(WORKBOOK_RETRY_DELAYS_MS[attempt - 1] ?? WORKBOOK_RETRY_DELAYS_MS.at(-1) ?? 1000);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Workbook request failed after retries.");
}

function canonicalizeWorkbookRows(rows: WorkbookRow[]): WorkbookRow[] {
  if (rows.length < LITE_WORKBOOK_ROW_COUNT) {
    throw new Error(`Workbook CSV returned ${rows.length} rows; expected ${LITE_WORKBOOK_ROW_COUNT}.`);
  }

  return rows.slice(0, LITE_WORKBOOK_ROW_COUNT).map((row, index) => ({
    ...row,
    priority_rank: index + 1,
  }));
}

async function requestWorkbookCsv(args: {
  apiKey: string;
  model: string;
  workbookPrompt: string;
  userContent: string;
  timeoutMs: number;
}): Promise<string | undefined> {
  const response = await fetchWorkbookResponsesWithRetry({
    apiKey: args.apiKey,
    timeoutMs: args.timeoutMs,
    body: {
      model: args.model,
      input: [
        { role: "system", content: args.workbookPrompt },
        { role: "user", content: args.userContent },
      ],
      max_output_tokens: 5000,
    },
  });

  if (!response.ok) {
    throw new Error(`Lite workbook generation failed: ${response.status} ${await response.text()}`);
  }

  const payload = (await response.json()) as ResponsesPayload;
  return extractCsvFromResponsesPayload(payload);
}

async function repairWorkbookCsv(args: {
  apiKey: string;
  model: string;
  workbookPrompt: string;
  userContent: string;
  csvCandidate: string;
  parseError: string;
  timeoutMs: number;
}): Promise<string | undefined> {
  const normalizedParseError = args.parseError.toLowerCase();
  const propertyTypeFixInstructions = normalizedParseError.includes("property_type")
    ? [
        "Every row MUST include `property_type` immediately after `category` and before `type`.",
        "Use one exact listing type per row: Industrial, Retail / Restaurant, Office, Medical, or Mixed-use.",
        "Repeat the inferred listing type consistently across all rows for the same workbook unless the property is truly mixed-use.",
      ]
    : [];
  const typeFixInstructions = normalizedParseError.includes("type")
    ? [
        "Every row MUST include `type` immediately after `property_type` and before `city`.",
        "Use exactly `Signal` or `Fit`.",
        "Use `Signal` only when a current market or move signal was actually found.",
        "Use `Fit` when the candidate is a real fit-based suggestion with no current move signal found.",
      ]
    : [];
  const rationaleFixInstructions = normalizedParseError.includes("rationale")
    ? [
        "Every row MUST include `rationale` immediately after `fit_summary` and before `owner_contact_name`.",
        "Each rationale must be <=300 chars and sound like a plain leasing note for a skeptical broker.",
        "Do not use phrases like address-inferred, observed signal, positioning angle, broker-actionable, or unlock.",
        "Retail / restaurant rationale must cite anchor, co-tenancy, open lane, no-overlap logic, or say what to verify if site context is missing.",
        "Office rationale must cite a move trigger plus building-class, commute, recruiting, or amenity logic.",
        "Industrial rationale must cite clear height, dock, power, yard, highway access, logistics, or labor logic.",
        "Medical rationale must cite payer mix, demographics, specialty clustering, hospital proximity, or referral logic.",
      ]
    : [];

  return requestWorkbookCsv({
    apiKey: args.apiKey,
    model: args.model,
    timeoutMs: args.timeoutMs,
    workbookPrompt: [
      args.workbookPrompt,
      "",
      "You are now fixing CSV format or row-count issues.",
      `Return ONLY valid CSV with exactly ${LITE_WORKBOOK_ROW_COUNT} data rows.`,
      "Preserve the same overall prospect intent while fixing formatting and row count.",
      ...propertyTypeFixInstructions,
      ...typeFixInstructions,
      ...rationaleFixInstructions,
    ].join("\n"),
    userContent: [
      args.userContent,
      "",
      `Parser issue: ${args.parseError}`,
      "",
      "Candidate CSV:",
      args.csvCandidate,
    ].join("\n"),
  });
}

export async function generateLiteWorkbookFromAddress(
  inputAddress: string,
  options?: {
    siteContextJson?: string | null;
  },
): Promise<{
  displayAddress: string;
  csv: string;
  rows: WorkbookRow[];
}> {
  const displayAddress = presentLiteAddress(inputAddress);

  if (isMockAgenticFlowEnabled()) {
    const rows = buildMockLiteWorkbookRows();
    return {
      displayAddress,
      csv: buildWorkbookCsv(rows),
      rows,
    };
  }

  const config = getAiConfig();
  if (!config.openAiApiKey) {
    throw new Error("OPENAI_API_KEY is not set.");
  }

  const workbookPrompt = buildLiteWorkbookPrompt();
  const userContent = [
    `Address: ${displayAddress}`,
    options?.siteContextJson?.trim()
      ? `\n\nSite context JSON:\n${options.siteContextJson}\n\nUse the supplied site context as stronger evidence than generic geocoding assumptions.`
      : "",
    "\n\nReturn the workbook now.",
  ].join("");
  const attemptModels = [config.workbookModel, config.openAiModel];
  let lastError = "Model returned no workbook CSV.";

  for (const model of attemptModels) {
    const candidateCsv = await requestWorkbookCsv({
      apiKey: config.openAiApiKey,
      model,
      workbookPrompt,
      userContent,
      timeoutMs: config.timeoutMs,
    });

    if (!candidateCsv) continue;

    try {
      const rows = canonicalizeWorkbookRows(parseWorkbookCsv(candidateCsv));
      return {
        displayAddress,
        csv: buildWorkbookCsv(rows),
        rows,
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Unknown workbook CSV parse error.";

      const repairedCsv = await repairWorkbookCsv({
        apiKey: config.openAiApiKey,
        model,
        workbookPrompt,
        userContent,
        csvCandidate: candidateCsv,
        parseError: lastError,
        timeoutMs: config.timeoutMs,
      });

      if (!repairedCsv) continue;

      try {
        const rows = canonicalizeWorkbookRows(parseWorkbookCsv(repairedCsv));
        return {
          displayAddress,
          csv: buildWorkbookCsv(rows),
          rows,
        };
      } catch (repairError) {
        lastError = repairError instanceof Error ? repairError.message : lastError;

        const validationRepairCsv = await repairWorkbookCsv({
          apiKey: config.openAiApiKey,
          model,
          workbookPrompt,
          userContent,
          csvCandidate: repairedCsv,
          parseError: lastError,
          timeoutMs: config.timeoutMs,
        });

        if (!validationRepairCsv) continue;

        try {
          const rows = canonicalizeWorkbookRows(parseWorkbookCsv(validationRepairCsv));
          return {
            displayAddress,
            csv: buildWorkbookCsv(rows),
            rows,
          };
        } catch (validationRepairError) {
          lastError = validationRepairError instanceof Error ? validationRepairError.message : lastError;
        }
      }
    }
  }

  throw new Error(lastError);
}
