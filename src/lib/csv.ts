import type { CandidateRow } from "@/lib/types";

const REQUIRED_HEADERS = [
  "business_name",
  "category",
  "property_type",
  "type",
  "tenant_fit_score_100",
  "move_probability_1_10",
  "priority_rank",
  "fit_summary",
  "rationale",
  "owner_contact_name",
] as const;

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      const next = line[i + 1];
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current.trim());
  return result;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function score(row: CandidateRow): number {
  return row.tenant_fit_score_100 * 0.6 + row.move_probability_1_10 * 4;
}

function inferLegacyProspectType(moveProbability: number, fitSummary: string): "Signal" | "Fit" {
  if (/^no current move signal\b/i.test(fitSummary.trim())) {
    return "Fit";
  }

  return moveProbability <= 3 ? "Fit" : "Signal";
}

function normalizeProspectType(value: string | undefined, moveProbability: number, fitSummary: string): "Signal" | "Fit" {
  const normalized = (value ?? "").trim().toLowerCase();

  if (normalized === "signal" || normalized === "signal-backed") {
    return "Signal";
  }

  if (normalized === "fit" || normalized === "fit-only") {
    return "Fit";
  }

  return inferLegacyProspectType(moveProbability, fitSummary);
}

function validateRationale(value: string, rowNumber: number): string {
  const rationale = value.trim();

  if (!rationale) {
    throw new Error(`CSV row ${rowNumber} is missing required rationale.`);
  }

  if (rationale.length > 300) {
    throw new Error(`CSV row ${rowNumber} rationale exceeds 300 characters.`);
  }

  return rationale;
}

export function parseAndNormalizeCsv(csv: string): CandidateRow[] {
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    throw new Error("CSV response is empty.");
  }

  const headers = splitCsvLine(lines[0]);
  const missingHeaders = REQUIRED_HEADERS.filter((h) => !headers.includes(h));
  if (missingHeaders.length) {
    throw new Error(`Missing required CSV headers: ${missingHeaders.join(", ")}`);
  }

  const headerIndex = Object.fromEntries(headers.map((h, idx) => [h, idx]));

  const rows: CandidateRow[] = lines.slice(1).map((line, index) => {
    const cols = splitCsvLine(line);
    const rowNumber = index + 2;

    const fit = Number.parseInt(cols[headerIndex.tenant_fit_score_100] ?? "0", 10);
    const move = Number.parseInt(cols[headerIndex.move_probability_1_10] ?? "1", 10);

    return {
      business_name: (cols[headerIndex.business_name] ?? "").trim(),
      category: (cols[headerIndex.category] ?? "N/A").trim() || "N/A",
      property_type: (cols[headerIndex.property_type] ?? "").trim() || "Mixed-use",
      type: normalizeProspectType(cols[headerIndex.type], clamp(Number.isFinite(move) ? move : 1, 1, 10), cols[headerIndex.fit_summary] ?? ""),
      tenant_fit_score_100: clamp(Number.isFinite(fit) ? fit : 0, 0, 100),
      move_probability_1_10: clamp(Number.isFinite(move) ? move : 1, 1, 10),
      priority_rank: 0,
      fit_summary: (cols[headerIndex.fit_summary] ?? "").trim().slice(0, 400),
      rationale: validateRationale(cols[headerIndex.rationale] ?? "", rowNumber),
      owner_contact_name:
        (cols[headerIndex.owner_contact_name] ?? "N/A").trim() || "N/A",
    };
  });

  const deduped = new Map<string, CandidateRow>();

  for (const row of rows) {
    if (!row.business_name) continue;
    const key = row.business_name.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!deduped.has(key)) deduped.set(key, row);
  }

  const normalized = [...deduped.values()]
    .sort((a, b) => {
      const scoreDiff = score(b) - score(a);
      if (scoreDiff !== 0) return scoreDiff;
      const fitDiff = b.tenant_fit_score_100 - a.tenant_fit_score_100;
      if (fitDiff !== 0) return fitDiff;
      return a.business_name.localeCompare(b.business_name);
    })
    .slice(0, 30)
    .map((row, index) => ({
      ...row,
      priority_rank: index + 1,
      priority_score: Number(score(row).toFixed(2)),
    }));

  return normalized;
}

export function toCsv(rows: CandidateRow[]): string {
  const escape = (value: string | number) => {
    const asString = String(value ?? "");
    if (!/[",\n]/.test(asString)) return asString;
    return `"${asString.replace(/"/g, '""')}"`;
  };

  const header = REQUIRED_HEADERS.join(",");
  const lines = rows.map((row) =>
    [
      row.business_name,
      row.category,
      row.property_type,
      row.type,
      row.tenant_fit_score_100,
      row.move_probability_1_10,
      row.priority_rank,
      row.fit_summary,
      row.rationale,
      row.owner_contact_name,
    ]
      .map(escape)
      .join(","),
  );

  return [header, ...lines].join("\n");
}
