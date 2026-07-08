import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { getAiConfig } from "@/lib/ai/config";

type SiteContextConfidence = "high" | "medium" | "low";

type LiteSiteContext = {
  center_type: string;
  anchor_tenants: string[];
  visible_cotenants: Array<{
    name: string;
    same_center_confidence: SiteContextConfidence;
  }>;
  adjacent_uses: string[];
  parking_style: string;
  frontage_roads: string[];
  site_signals: string[];
  confidence_notes: string;
  source_summary: string;
};

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

const DEFAULT_SITE_CONTEXT_PROMPT = `Extract strict JSON commercial site context from the supplied evidence. Return only JSON.`;
const ALLOWED_CONFIDENCE: SiteContextConfidence[] = ["high", "medium", "low"];

function loadSiteContextPrompt(): string {
  try {
    const promptPath = path.join(process.cwd(), "lite-site-context-prompt.txt");
    const prompt = readFileSync(promptPath, "utf8").trim();
    return prompt || DEFAULT_SITE_CONTEXT_PROMPT;
  } catch {
    return DEFAULT_SITE_CONTEXT_PROMPT;
  }
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0);
}

function normalizeSiteContext(value: unknown): LiteSiteContext {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const visible_cotenants = Array.isArray(record.visible_cotenants)
    ? record.visible_cotenants
        .map((item) => {
          const candidate = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
          const name = typeof candidate.name === "string" ? candidate.name.trim() : "";
          const confidence =
            typeof candidate.same_center_confidence === "string" &&
            ALLOWED_CONFIDENCE.includes(candidate.same_center_confidence as SiteContextConfidence)
              ? (candidate.same_center_confidence as SiteContextConfidence)
              : "low";

          return name ? { name, same_center_confidence: confidence } : null;
        })
        .filter((item): item is { name: string; same_center_confidence: SiteContextConfidence } => item != null)
    : [];

  return {
    center_type: typeof record.center_type === "string" ? record.center_type.trim() : "",
    anchor_tenants: normalizeStringArray(record.anchor_tenants),
    visible_cotenants,
    adjacent_uses: normalizeStringArray(record.adjacent_uses),
    parking_style: typeof record.parking_style === "string" ? record.parking_style.trim() : "",
    frontage_roads: normalizeStringArray(record.frontage_roads),
    site_signals: normalizeStringArray(record.site_signals),
    confidence_notes: typeof record.confidence_notes === "string" ? record.confidence_notes.trim() : "",
    source_summary: typeof record.source_summary === "string" ? record.source_summary.trim() : "",
  };
}

function extractResponseText(payload: ResponsesPayload): string | undefined {
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

  return extracted?.trim();
}

function extractJsonCandidate(value: string): string {
  const trimmed = value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }
  return trimmed;
}

function guessMimeType(imagePath: string): string {
  const extension = path.extname(imagePath).toLowerCase();
  if (extension === ".png") return "image/png";
  if (extension === ".webp") return "image/webp";
  if (extension === ".gif") return "image/gif";
  return "image/jpeg";
}

function resolveImageRef(imageRef: string): string | null {
  const trimmed = imageRef.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("data:image/")) {
    return trimmed;
  }
  if (trimmed.startsWith("/") && existsSync(trimmed)) {
    const base64 = readFileSync(trimmed).toString("base64");
    return `data:${guessMimeType(trimmed)};base64,${base64}`;
  }
  return null;
}

export function normalizeSiteContextImageRefs(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export function buildSiteContextJson(value: unknown): string {
  return JSON.stringify(normalizeSiteContext(value));
}

export async function generateLiteSiteContext(args: {
  inputAddress: string;
  siteContextHint?: string | null;
  siteContextImageRefs?: string[];
}): Promise<string | null> {
  const imageRefs = (args.siteContextImageRefs ?? []).map(resolveImageRef).filter((value): value is string => Boolean(value));
  const hint = args.siteContextHint?.trim() ?? "";

  if (!hint && imageRefs.length === 0) {
    return null;
  }

  const config = getAiConfig();
  if (!config.openAiApiKey) {
    throw new Error("OPENAI_API_KEY is not set.");
  }

  const prompt = loadSiteContextPrompt();
  const userContent: Array<Record<string, string>> = [
    {
      type: "input_text",
      text: [
        `Property address: ${args.inputAddress}`,
        hint ? `\n\nAdditional listing evidence:\n${hint}` : "",
        "\n\nExtract site context now.",
      ].join(""),
    },
    ...imageRefs.map((image_url) => ({
      type: "input_image",
      image_url,
    })),
  ];

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.openAiApiKey}`,
    },
    body: JSON.stringify({
      model: config.siteContextModel,
      input: [
        { role: "system", content: prompt },
        { role: "user", content: userContent },
      ],
      max_output_tokens: 2000,
    }),
  });

  if (!response.ok) {
    throw new Error(`Lite site-context generation failed: ${response.status} ${await response.text()}`);
  }

  const payload = (await response.json()) as ResponsesPayload;
  const output = extractResponseText(payload);
  if (!output) {
    throw new Error("Site context model returned no output.");
  }

  return buildSiteContextJson(JSON.parse(extractJsonCandidate(output)) as unknown);
}
