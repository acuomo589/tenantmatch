export type PropertyType =
  | "Industrial"
  | "Retail"
  | "Office"
  | "Restaurant / Hospitality"
  | "Mixed-use"
  | "Any";

export type TenantType =
  | "Manufacturing"
  | "Distribution"
  | "Medical"
  | "Professional Services"
  | "Food & Beverage"
  | "Local Retail"
  | "Any";

export interface ListingIntake {
  address: string;
  radiusMiles: number;
  propertyType: PropertyType;
  tenantTypes: TenantType[];
  tenantSpecs: string;
  ownerIncentives: string;
}

export interface CandidateRow {
  business_name: string;
  category: string;
  property_type: string;
  type: "Signal" | "Fit";
  tenant_fit_score_100: number;
  move_probability_1_10: number;
  priority_rank: number;
  fit_summary: string;
  rationale: string;
  owner_contact_name: string;
  priority_score?: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
}

export interface ListingThread {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  intake: ListingIntake;
  basePrompt: string;
  currentPrompt: string;
  messages: ChatMessage[];
  candidates: CandidateRow[];
  rawCsv: string;
}

export interface RunRequest {
  threadId?: string;
  intake: ListingIntake;
}

export interface ChatRequest {
  threadId: string;
  message: string;
}
