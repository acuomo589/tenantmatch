import { readFileSync } from "node:fs";
import path from "node:path";

function loadLocalEnv(): void {
  const envPath = path.join(process.cwd(), ".env.local");
  const envText = readFileSync(envPath, "utf8");

  for (const line of envText.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex < 0) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }

    process.env[key] = value.replace(/\\n/g, "\n");
  }
}

async function main(): Promise<void> {
  loadLocalEnv();

  const sourceUrl = process.env.SOURCE_URL?.trim();
  const rawAddress = process.env.RAW_ADDRESS?.trim() || "";
  const listingTitle = process.env.LISTING_TITLE?.trim() || rawAddress;
  const propertyTypeGuess = process.env.PROPERTY_TYPE_GUESS?.trim() || "Retail";
  const zip = process.env.ZIP_CODE?.trim() || "01752";

  if (!sourceUrl) {
    throw new Error("SOURCE_URL is required.");
  }

  const discovery = await import("../src/lib/lite/discovery");
  const validateLiteDiscoveredCandidate = (
    discovery as {
      validateLiteDiscoveredCandidate(args: {
        zip: string;
        candidate: {
          sourceUrl: string;
          sourceDomain: string;
          listingTitle: string;
          rawAddress: string;
          propertyTypeGuess: string;
          brokerName: string | null;
          brokerEmail: string | null;
          confidence: "high" | "medium" | "low";
        };
      }): Promise<unknown>;
    }
  ).validateLiteDiscoveredCandidate;

  const sourceDomain = new URL(sourceUrl).hostname.replace(/^www\./, "");
  const result = await validateLiteDiscoveredCandidate({
    zip,
    candidate: {
      sourceUrl,
      sourceDomain,
      listingTitle,
      rawAddress,
      propertyTypeGuess,
      brokerName: null,
      brokerEmail: null,
      confidence: "medium",
    },
  });

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
