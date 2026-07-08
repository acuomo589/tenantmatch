import { readFileSync } from "node:fs";
import path from "node:path";

export const LITE_WORKBOOK_ROW_COUNT = 25;

const DEFAULT_LITE_WORKBOOK_PROMPT = `You are a commercial real estate tenant matchmaker.

Your job is to take a property address, determine its type, and return a ranked list of real businesses that are strong leasing candidates.

Return exactly ${LITE_WORKBOOK_ROW_COUNT} data rows as CSV with this exact field order:
business_name,category,property_type,city,state,distance_miles,tenant_fit_score_100,move_probability_1_10,priority_rank,fit_summary,rationale,owner_contact_name

Do not wrap the CSV in markdown fences or commentary.`;

function loadLiteWorkbookPromptFile(): string {
  try {
    const promptPath = path.join(process.cwd(), "lite-workbook-prompt.txt");
    const prompt = readFileSync(promptPath, "utf8").trim();
    return prompt || DEFAULT_LITE_WORKBOOK_PROMPT;
  } catch {
    return DEFAULT_LITE_WORKBOOK_PROMPT;
  }
}

export function buildLiteWorkbookPrompt(): string {
  return loadLiteWorkbookPromptFile();
}
