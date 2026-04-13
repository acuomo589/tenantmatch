export interface WorkbookRow {
  business_name: string;
  category: string;
  city: string;
  state: string;
  distance_miles: number;
  tenant_fit_score_100: number;
  move_probability_1_10: number;
  priority_rank: number;
  fit_summary: string;
  owner_contact_name: string;
}

const REQUIRED_HEADERS = [
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

function parseLooseNumber(value: string | undefined, fallback: number): number {
  if (value == null) return fallback;
  const normalized = value.replace(/,/g, "").trim();
  if (!normalized) return fallback;

  const direct = Number(normalized);
  if (Number.isFinite(direct)) return direct;

  const match = normalized.match(/-?\d+(?:\.\d+)?/);
  if (!match) return fallback;

  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function score(row: WorkbookRow): number {
  return row.tenant_fit_score_100 * 0.6 + row.move_probability_1_10 * 4;
}

export function parseWorkbookCsv(csv: string): WorkbookRow[] {
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    throw new Error("Workbook CSV response is empty.");
  }

  const headers = splitCsvLine(lines[0]);
  const missingHeaders = REQUIRED_HEADERS.filter((h) => !headers.includes(h));
  if (missingHeaders.length) {
    throw new Error(`Missing required workbook CSV headers: ${missingHeaders.join(", ")}`);
  }

  const headerIndex = Object.fromEntries(headers.map((h, idx) => [h, idx])) as Record<string, number>;

  return lines
    .slice(1)
    .map((line) => {
      const cols = splitCsvLine(line);
      return {
        business_name: (cols[headerIndex.business_name] ?? "").trim(),
        category: (cols[headerIndex.category] ?? "N/A").trim() || "N/A",
        city: (cols[headerIndex.city] ?? "").trim(),
        state: (cols[headerIndex.state] ?? "").trim(),
        distance_miles: parseLooseNumber(cols[headerIndex.distance_miles], 0),
        tenant_fit_score_100: clamp(parseLooseNumber(cols[headerIndex.tenant_fit_score_100], 0), 0, 100),
        move_probability_1_10: clamp(parseLooseNumber(cols[headerIndex.move_probability_1_10], 1), 1, 10),
        priority_rank: parseLooseNumber(cols[headerIndex.priority_rank], 0),
        fit_summary: (cols[headerIndex.fit_summary] ?? "").trim().slice(0, 400),
        owner_contact_name: (cols[headerIndex.owner_contact_name] ?? "N/A").trim() || "N/A",
      } satisfies WorkbookRow;
    })
    .filter((row) => row.business_name)
    .sort((a, b) => score(b) - score(a));
}
