export type AiProvider = "openai" | "vertex";

export interface AiConfig {
  provider: AiProvider;
  openAiApiKey?: string;
  openAiModel: string;
  listingParserModel: string;
  workbookModel: string;
  outreachEmailModel: string;
  vertexModel: string;
  timeoutMs: number;
  langsmithApiKey?: string;
  langsmithProject: string;
  langsmithTracingEnabled: boolean;
}

export function getAiConfig(): AiConfig {
  const openAiApiKey = process.env.OPENAI_API_KEY ?? process.env.OPEN_API_KEY;

  return {
    provider: (process.env.AI_PROVIDER as AiProvider) ?? "openai",
    openAiApiKey,
    openAiModel: process.env.AI_ANALYSIS_MODEL ?? "gpt-4.1-mini",
    listingParserModel: process.env.AI_LISTING_PARSER_MODEL ?? "o3-mini",
    workbookModel: process.env.AI_WORKBOOK_MODEL ?? "gpt-5.4",
    outreachEmailModel: process.env.AI_OUTREACH_EMAIL_MODEL ?? "gpt-4o",
    vertexModel: process.env.VERTEX_ANALYSIS_MODEL ?? "gemini-2.0-flash",
    timeoutMs: Number(process.env.AI_TIMEOUT_MS ?? 30000),
    langsmithApiKey: process.env.LANGSMITH_API_KEY,
    langsmithProject: process.env.LANGSMITH_PROJECT ?? "timpani-proto",
    langsmithTracingEnabled: process.env.LANGSMITH_TRACING === "true",
  };
}
