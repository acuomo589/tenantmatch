import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getAiConfig } from "@/lib/ai/config";
import { consumeEntitlement, EntitlementError } from "@/lib/billing/entitlements";
import { requireTenantContext } from "@/lib/auth/requestContext";
import { hasSupabaseConfig, isSupabaseConfigError } from "@/lib/auth/supabaseConfig";
import { isMockAgenticFlowEnabled, MOCK_WORKBOOK_CSV, MOCK_WORKBOOK_ROWS } from "@/lib/testing/mock-agentic-flow";
import { parseWorkbookCsv } from "@/lib/workbookCsv";

type ListingInput = {
  id: string;
  title: string;
  addressLine1: string;
  city: string;
  state: string;
  postalCode: string;
  propertyClass?: string;
  listingType?: string;
  squareFootage?: number;
  lotSizeAcres?: number;
  listingSummary?: string;
  ownerProvisions?: string;
  leaseTermYears?: number;
  features?: Array<{ featureValueText?: string; sourceText?: string }>;
  disclosures?: Array<{ text?: string }>;
};

type ResponsesPayload = {
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
      json?: unknown;
    }>;
  }>;
};

const MIN_WORKBOOK_ROWS = 20;

async function loadWorkbookPrompt(): Promise<string> {
  const promptPath = path.join(process.cwd(), "workbook-prompt.txt");
  const prompt = await readFile(promptPath, "utf8");
  const trimmed = prompt.trim();
  if (!trimmed) {
      return [
        "Return ONLY CSV with this exact header order:",
        "business_name,category,property_type,type,city,state,distance_miles,tenant_fit_score_100,move_probability_1_10,priority_rank,fit_summary,rationale,owner_contact_name",
        "Generate 20 rows with realistic tenant prospects based on the listing context.",
        "Set type to Signal for signal-backed rows and Fit for fit-only rows with no current move signal.",
        "Do not wrap in markdown fences.",
      ].join("\n");
  }
  return trimmed;
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
    throw new Error(`Workbook generation failed: ${response.status} ${await response.text()}`);
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
  const normalizedParseError = args.parseError.toLowerCase();
  const propertyTypeFixInstructions = normalizedParseError.includes("property_type")
    ? [
        "Every row MUST include `property_type` immediately after `category` and before `type`.",
        "Use one exact listing type per row: Industrial, Retail / Restaurant, Office, Medical, or Mixed-use.",
      ]
    : [];
  const typeFixInstructions = normalizedParseError.includes("type")
    ? [
        "Every row MUST include `type` immediately after `property_type` and before `city`.",
        "Use exactly `Signal` or `Fit`.",
        "Use `Signal` only when a current market or move signal was actually found.",
        "Use `Fit` for fit-based suggestions with no current move signal found.",
      ]
    : [];
  const rationaleFixInstructions = normalizedParseError.includes("rationale")
    ? [
        "Every row MUST include `rationale` immediately after `fit_summary` and before `owner_contact_name`.",
        "Each rationale must be <=300 chars and cite a concrete property-fit signal.",
      ]
    : [];
  const repairPrompt = [
    args.workbookPrompt,
    "",
    "You are now in CSV repair mode.",
    "Fix only CSV formatting/schema issues while preserving the original tenant intent.",
    "Return ONLY CSV, with the exact required headers and valid CSV escaping.",
    ...propertyTypeFixInstructions,
    ...typeFixInstructions,
    ...rationaleFixInstructions,
    "Do not add commentary.",
  ].join("\n");

  const repairUserContent = [
    args.userContent,
    "",
    `Parser error to fix: ${args.parseError}`,
    "",
    "Candidate CSV to repair:",
    args.csvCandidate,
  ].join("\n");

  return requestWorkbookCsv({
    apiKey: args.apiKey,
    model: args.model,
    workbookPrompt: repairPrompt,
    userContent: repairUserContent,
  });
}

export async function POST(request: Request) {
  const requestId = `workbook_${Math.random().toString(36).slice(2, 8)}`;
  try {
    if (isMockAgenticFlowEnabled()) {
      return NextResponse.json({
        csv: MOCK_WORKBOOK_CSV,
        rows: MOCK_WORKBOOK_ROWS,
      });
    }

    let context: Awaited<ReturnType<typeof requireTenantContext>> | null = null;

    if (hasSupabaseConfig()) {
      try {
        context = await requireTenantContext();
      } catch (error) {
        if (!isSupabaseConfigError(error)) {
          throw error;
        }
      }
    }

    const body = (await request.json()) as { listing?: ListingInput };
    const listing = body.listing;
    if (!listing?.addressLine1) {
      console.warn("[workbooks/from-listing] missing listing payload", { requestId });
      return NextResponse.json({ error: "listing is required" }, { status: 400 });
    }

    const config = getAiConfig();
    if (!config.openAiApiKey) {
      console.error("[workbooks/from-listing] missing OPENAI_API_KEY", { requestId });
      return NextResponse.json({ error: "OPENAI_API_KEY is not set." }, { status: 500 });
    }

    const workbookPrompt = await loadWorkbookPrompt();
    const listingAddress = [listing.addressLine1, listing.city, listing.state, listing.postalCode].filter(Boolean).join(", ");

    const listingContext = {
      title: listing.title,
      address: listingAddress,
      propertyClass: listing.propertyClass,
      listingType: listing.listingType,
      squareFootage: listing.squareFootage,
      lotSizeAcres: listing.lotSizeAcres,
      listingSummary: listing.listingSummary,
      ownerProvisions: listing.ownerProvisions,
      leaseTermYears: listing.leaseTermYears,
      features: (listing.features ?? []).map((x) => x.featureValueText ?? x.sourceText).filter(Boolean),
      disclosures: (listing.disclosures ?? []).map((x) => x.text).filter(Boolean),
    };

    const executeSuffix =
      "\n\nADDRESS IS PROVIDED. Execute now and return ONLY CSV rows with the required header. Do not ask for more input.";

    const attempts: Array<{ model: string; userContent: string }> = [
      { model: config.workbookModel, userContent: `${listingAddress}${executeSuffix}` },
      {
        model: config.workbookModel,
        userContent: `Property address: ${listingAddress}\n\nListing context JSON:\n${JSON.stringify(listingContext, null, 2)}${executeSuffix}`,
      },
      { model: config.openAiModel, userContent: `${listingAddress}${executeSuffix}` },
      {
        model: config.openAiModel,
        userContent: `Property address: ${listingAddress}\n\nListing context JSON:\n${JSON.stringify(listingContext, null, 2)}${executeSuffix}`,
      },
    ];

    let csv: string | undefined;
    let rows: ReturnType<typeof parseWorkbookCsv> | undefined;
    let lastParseError: string | undefined;

    console.info("[workbooks/from-listing] request received", {
      requestId,
      address: listingAddress,
      workbookModel: config.workbookModel,
      fallbackModel: config.openAiModel,
      attemptCount: attempts.length,
    });

    for (let i = 0; i < attempts.length; i += 1) {
      const attempt = attempts[i];
      console.info("[workbooks/from-listing] generation attempt", {
        requestId,
        attemptIndex: i + 1,
        model: attempt.model,
      });

      const candidateCsv = await requestWorkbookCsv({
        apiKey: config.openAiApiKey,
        model: attempt.model,
        workbookPrompt,
        userContent: attempt.userContent,
      });

      if (!candidateCsv) {
        console.warn("[workbooks/from-listing] empty candidate CSV", {
          requestId,
          attemptIndex: i + 1,
          model: attempt.model,
        });
        continue;
      }

      try {
        const parsed = parseWorkbookCsv(candidateCsv);
        if (parsed.length < MIN_WORKBOOK_ROWS) {
          lastParseError = `Workbook CSV returned ${parsed.length} rows; minimum is ${MIN_WORKBOOK_ROWS}.`;
          console.warn("[workbooks/from-listing] candidate CSV row threshold failure", {
            requestId,
            attemptIndex: i + 1,
            rowCount: parsed.length,
            minRows: MIN_WORKBOOK_ROWS,
          });
        } else {
          csv = candidateCsv;
          rows = parsed;
          console.info("[workbooks/from-listing] candidate CSV parse succeeded", {
            requestId,
            attemptIndex: i + 1,
            rowCount: parsed.length,
          });
          break;
        }
      } catch (error) {
        lastParseError = error instanceof Error ? error.message : "Unknown workbook CSV parse error.";
        console.warn("[workbooks/from-listing] candidate CSV parse failed", {
          requestId,
          attemptIndex: i + 1,
          error: lastParseError,
        });
      }

      console.info("[workbooks/from-listing] repair attempt", {
        requestId,
        attemptIndex: i + 1,
        model: attempt.model,
        parseError: lastParseError,
      });

      const repairedCsv = await repairWorkbookCsv({
        apiKey: config.openAiApiKey,
        model: attempt.model,
        workbookPrompt,
        userContent: attempt.userContent,
        csvCandidate: candidateCsv,
        parseError: lastParseError ?? "Unknown parse error",
      });

      if (!repairedCsv) {
        console.warn("[workbooks/from-listing] empty repaired CSV", {
          requestId,
          attemptIndex: i + 1,
          model: attempt.model,
        });
        continue;
      }

      try {
        const parsed = parseWorkbookCsv(repairedCsv);
        if (parsed.length < MIN_WORKBOOK_ROWS) {
          lastParseError = `Workbook CSV returned ${parsed.length} rows after repair; minimum is ${MIN_WORKBOOK_ROWS}.`;
          console.warn("[workbooks/from-listing] repaired CSV row threshold failure", {
            requestId,
            attemptIndex: i + 1,
            rowCount: parsed.length,
            minRows: MIN_WORKBOOK_ROWS,
          });
          continue;
        }
        csv = repairedCsv;
        rows = parsed;
        console.info("[workbooks/from-listing] repaired CSV parse succeeded", {
          requestId,
          attemptIndex: i + 1,
          rowCount: parsed.length,
        });
        break;
      } catch (error) {
        lastParseError = error instanceof Error ? error.message : "Unknown workbook CSV parse error after repair.";
        console.warn("[workbooks/from-listing] repaired CSV parse failed", {
          requestId,
          attemptIndex: i + 1,
          error: lastParseError,
        });
      }
    }

    if (!csv || !rows) {
      console.error("[workbooks/from-listing] request failed", {
        requestId,
        error: lastParseError ?? "Workbook generation returned no CSV",
      });
      return NextResponse.json(
        {
          error:
            lastParseError ??
            "Model returned empty workbook output. Try a shorter prompt or switch AI_WORKBOOK_MODEL to gpt-4.1-mini.",
        },
        { status: 500 },
      );
    }

    if (context) {
      await consumeEntitlement({
        tenantId: context.tenantId,
        metric: "WORKBOOKS",
        increment: 1,
      });
      await consumeEntitlement({
        tenantId: context.tenantId,
        metric: "WORKBOOK_ROWS",
        increment: rows.length,
      });
    }

    console.info("[workbooks/from-listing] request succeeded", {
      requestId,
      rowCount: rows.length,
      authMode: context ? "tenant" : "local",
    });
    return NextResponse.json({ csv, rows });
  } catch (error) {
    if (error instanceof EntitlementError) {
      return NextResponse.json({ error: error.message, details: error.details }, { status: 402 });
    }
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : "Unexpected workbook generation failure";
    console.error("[workbooks/from-listing] unexpected failure", {
      requestId,
      error: message,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
