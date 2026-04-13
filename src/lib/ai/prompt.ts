import type { ListingIntake } from "@/lib/types";

export const BASE_PROMPT = `You are a commercial real estate tenant matchmaker.

Return ONLY CSV with this exact header order:
business_name,category,tenant_fit_score_100,move_probability_1_10,priority_rank,fit_summary,owner_contact_name

Rules:
- Return 20-30 rows.
- Realistic business names only (no placeholders like "ABC Co").
- tenant_fit_score_100 must be integer 0-100.
- move_probability_1_10 must be integer 1-10.
- fit_summary max 400 chars.
- owner_contact_name should be N/A when unknown.
- No markdown, no prose before or after CSV.
`;

export function buildPrompt(intake: ListingIntake, currentPrompt?: string): string {
  const prompt = currentPrompt ?? BASE_PROMPT;

  return `${prompt}

Property intake:
- Address: ${intake.address}
- Radius miles: ${intake.radiusMiles}
- Property type preference: ${intake.propertyType}
- Tenant type filters: ${intake.tenantTypes.join(", ") || "Any"}
- Tenant specs: ${intake.tenantSpecs || "None provided"}
- Owner incentives: ${intake.ownerIncentives || "None provided"}

Build ranked candidates that match this intake.`;
}
