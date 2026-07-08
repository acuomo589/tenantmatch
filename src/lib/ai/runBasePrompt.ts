import { getAiConfig } from "@/lib/ai/config";
import { buildPrompt } from "@/lib/ai/prompt";
import type { ListingIntake } from "@/lib/types";
import { Client as LangSmithClient } from "langsmith";

const DEFAULT_HEADERS =
  "business_name,category,property_type,tenant_fit_score_100,move_probability_1_10,priority_rank,fit_summary,rationale,owner_contact_name";

function getLangSmithClient() {
  const config = getAiConfig();
  if (!config.langsmithTracingEnabled || !config.langsmithApiKey) return null;

  return new LangSmithClient({
    apiKey: config.langsmithApiKey,
  });
}

async function withLangSmithTrace<T>(input: {
  name: string;
  runType: "chain" | "llm";
  inputs: Record<string, unknown>;
  run: () => Promise<T>;
  mapOutputs: (result: T) => Record<string, unknown>;
}): Promise<T> {
  const config = getAiConfig();
  const client = getLangSmithClient();
  if (!client) {
    return input.run();
  }

  const runId = crypto.randomUUID();

  try {
    await client.createRun({
      id: runId,
      name: input.name,
      run_type: input.runType,
      inputs: input.inputs,
      project_name: config.langsmithProject,
      start_time: new Date().toISOString(),
      extra: {
        metadata: {
          service: "tenantmatch",
          provider: config.provider,
        },
      },
    });
  } catch {
    // Trace write failures should not block application flow.
  }

  try {
    const result = await input.run();
    try {
      await client.updateRun(runId, {
        outputs: input.mapOutputs(result),
        end_time: new Date().toISOString(),
      });
    } catch {
      // Non-fatal.
    }
    return result;
  } catch (error) {
    try {
      await client.updateRun(runId, {
        error: error instanceof Error ? error.message : String(error),
        end_time: new Date().toISOString(),
      });
    } catch {
      // Non-fatal.
    }
    throw error;
  }
}

function sampleBusinesses(propertyType: string): Array<{ name: string; category: string }> {
  if (propertyType === "Industrial") {
    return [
      { name: "Northeast Precision Fabrication", category: "Manufacturing" },
      { name: "Atlas Cold Chain Logistics", category: "Distribution" },
      { name: "Central Valve & Pump Supply", category: "Industrial Supply" },
      { name: "Worcester Packaging Works", category: "Packaging" },
      { name: "Bay State Components", category: "Light Assembly" },
    ];
  }

  if (propertyType === "Office") {
    return [
      { name: "Pine & Harbor Legal Group", category: "Legal" },
      { name: "TriCounty Financial Advisors", category: "Accounting" },
      { name: "ClearPath Insurance Partners", category: "Insurance" },
      { name: "Riverbend Primary Care", category: "Medical" },
      { name: "NorthStar Therapy Collective", category: "Medical" },
    ];
  }

  if (propertyType === "Restaurant / Hospitality") {
    return [
      { name: "Station Street Kitchen", category: "Restaurant" },
      { name: "Harvest Bowl Co.", category: "Fast Casual" },
      { name: "Copper Mill Coffee Roasters", category: "Coffee" },
      { name: "Local Table Hospitality Group", category: "Hospitality" },
      { name: "Elm & Main Bakery", category: "Bakery" },
    ];
  }

  return [
    { name: "Neighborhood Wellness Market", category: "Retail" },
    { name: "Summit Home & Design", category: "Home Goods" },
    { name: "Metro Phone Repair", category: "Service Retail" },
    { name: "Brighton Pet Supply", category: "Pet Retail" },
    { name: "Civic Print & Ship", category: "Business Service" },
  ];
}

function generateMockCsv(intake: ListingIntake): string {
  const pool = sampleBusinesses(intake.propertyType);
  const rows: string[] = [DEFAULT_HEADERS];

  for (let i = 0; i < 20; i += 1) {
    const seed = pool[i % pool.length];
    const fit = Math.max(55, 90 - i * 2);
    const move = Math.max(3, 9 - Math.floor(i / 3));
    const name = i < pool.length ? seed.name : `${seed.name} ${i + 1}`;
    const summary = `${name} aligns with ${intake.propertyType} constraints in a ${intake.radiusMiles}-mile search, with owner incentives (${intake.ownerIncentives || "standard TI package"}) supporting conversion.`;
    const rationale =
      intake.propertyType === "Industrial"
        ? "Clear height and loading fit industrial users; highway access supports logistics economics."
        : intake.propertyType === "Office"
          ? "Amenity access and commute convenience support recruiting; move fits flight-to-quality logic."
          : intake.propertyType === "Restaurant / Hospitality"
            ? "Open daypart and visible frontage support restaurant demand; no direct co-tenant overlap is assumed."
            : "Parking, visibility, and surrounding demand support the concept; no direct co-tenant overlap is assumed.";

    rows.push(
      [
        name,
        seed.category,
        intake.propertyType,
        fit,
        move,
        i + 1,
        `"${summary.replace(/"/g, '""').slice(0, 400)}"`,
        `"${rationale.replace(/"/g, '""').slice(0, 300)}"`,
        "N/A",
      ].join(","),
    );
  }

  return rows.join("\n");
}

async function runOpenAi(prompt: string, signal?: AbortSignal): Promise<string> {
  const config = getAiConfig();
  if (!config.openAiApiKey) {
    throw new Error("OPENAI_API_KEY is not set.");
  }

  return withLangSmithTrace({
    name: "openai.responses",
    runType: "llm",
    inputs: {
      model: config.openAiModel,
      prompt,
      max_output_tokens: 3000,
    },
    mapOutputs: (result) => ({
      output_text: result,
      provider: "openai",
    }),
    run: async () => {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.openAiApiKey}`,
        },
        body: JSON.stringify({
          model: config.openAiModel,
          input: prompt,
          max_output_tokens: 3000,
        }),
        signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI request failed: ${response.status} ${errorText}`);
      }

      const payload = (await response.json()) as {
        output_text?: string;
      };

      if (!payload.output_text) {
        throw new Error("OpenAI did not return output_text.");
      }

      return payload.output_text.trim();
    },
  });
}

async function runVertex(): Promise<string> {
  throw new Error("Vertex adapter not wired yet in prototype. Set AI_PROVIDER=openai or mock.");
}

export async function runBasePrompt(input: {
  intake: ListingIntake;
  currentPrompt?: string;
}): Promise<{ csv: string; usedMock: boolean; finalPrompt: string }> {
  const config = getAiConfig();
  const finalPrompt = buildPrompt(input.intake, input.currentPrompt);

  if (process.env.AI_USE_MOCK === "1" || (!config.openAiApiKey && config.provider === "openai")) {
    return {
      csv: generateMockCsv(input.intake),
      usedMock: true,
      finalPrompt,
    };
  }

  return withLangSmithTrace({
    name: "runBasePrompt",
    runType: "chain",
    inputs: {
      intake: input.intake,
      provider: config.provider,
      model: config.provider === "vertex" ? config.vertexModel : config.openAiModel,
      prompt: finalPrompt,
    },
    mapOutputs: (result) => ({
      usedMock: result.usedMock,
      csv_preview: result.csv.slice(0, 800),
      csv_length: result.csv.length,
    }),
    run: async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

      try {
        const csv =
          config.provider === "vertex"
            ? await runVertex()
            : await runOpenAi(finalPrompt, controller.signal);

        return { csv, usedMock: false, finalPrompt };
      } finally {
        clearTimeout(timeout);
      }
    },
  });
}
