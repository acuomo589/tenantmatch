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

function escapeCsvCell(value: string | number): string {
  const stringValue = String(value);
  if (!/[",\n]/.test(stringValue)) return stringValue;
  return `"${stringValue.replaceAll('"', '""')}"`;
}

function buildWorkbookCsv(rows: WorkbookRow[]): string {
  const headers = [
    "business_name",
    "category",
    "city",
    "state",
    "distance_miles",
    "tenant_fit_score_100",
    "move_probability_1_10",
    "priority_rank",
    "fit_summary",
    "owner_contact_name",
  ];

  return [
    headers.join(","),
    ...rows.map((row) =>
      [
        row.business_name,
        row.category,
        row.city,
        row.state,
        row.distance_miles,
        row.tenant_fit_score_100,
        row.move_probability_1_10,
        row.priority_rank,
        row.fit_summary,
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
      city: index % 3 === 0 ? "Columbus" : "Gahanna",
      state: "OH",
      distance_miles: Number((4.5 + index * 0.7).toFixed(1)),
      tenant_fit_score_100: Math.max(68, 92 - index),
      move_probability_1_10: Math.max(4, 9 - Math.floor(index / 4)),
      priority_rank: index + 1,
      fit_summary: "Operationally aligned with the building's access, loading profile, and flexible bay depth.",
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
}): Promise<string | undefined> {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${args.apiKey}`,
    },
    body: JSON.stringify({
      model: args.model,
      input: [
        { role: "system", content: args.workbookPrompt },
        { role: "user", content: args.userContent },
      ],
      max_output_tokens: 5000,
    }),
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
}): Promise<string | undefined> {
  return requestWorkbookCsv({
    apiKey: args.apiKey,
    model: args.model,
    workbookPrompt: [
      args.workbookPrompt,
      "",
      "You are now fixing CSV format or row-count issues.",
      `Return ONLY valid CSV with exactly ${LITE_WORKBOOK_ROW_COUNT} data rows.`,
      "Preserve the same overall prospect intent while fixing formatting and row count.",
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

export async function generateLiteWorkbookFromAddress(inputAddress: string): Promise<{
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
  const userContent = `Address: ${displayAddress}\n\nReturn the workbook now.`;
  const attemptModels = [config.workbookModel, config.openAiModel];
  let lastError = "Model returned no workbook CSV.";

  for (const model of attemptModels) {
    const candidateCsv = await requestWorkbookCsv({
      apiKey: config.openAiApiKey,
      model,
      workbookPrompt,
      userContent,
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
      }
    }
  }

  throw new Error(lastError);
}
