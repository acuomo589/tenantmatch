export interface WorkbookRow {
  business_name: string;
  category: string;
  property_type: string;
  type: "Signal" | "Fit";
  city: string;
  state: string;
  distance_miles: number;
  tenant_fit_score_100: number;
  move_probability_1_10: number;
  priority_rank: number;
  fit_summary: string;
  rationale: string;
  owner_contact_name: string;
}

const REQUIRED_HEADERS = [
  "business_name",
  "category",
  "property_type",
  "type",
  "city",
  "state",
  "distance_miles",
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

function buildLegacyPropertyType(category: string, fitSummary: string, rationale: string): string {
  const source = `${category} ${fitSummary} ${rationale}`.toLowerCase();

  if (/(industrial|warehouse|distribution|manufacturing|logistics|dock|yard|power)/.test(source)) {
    return "Industrial";
  }
  if (/(medical|dental|clinic|hospital|patient|wellness|specialty)/.test(source)) {
    return "Medical";
  }
  if (/(office|legal|advisory|insurance|recruit|commute|amenity|class b|class a)/.test(source)) {
    return "Office";
  }
  if (/(retail|restaurant|cafe|coffee|bakery|traffic|anchor|co-tenancy|daypart)/.test(source)) {
    return "Retail / Restaurant";
  }

  return "Mixed-use";
}

function inferLegacyProspectType(moveProbability: number, fitSummary: string): "Signal" | "Fit" {
  if (/^no current move signal\b/i.test(fitSummary.trim())) {
    return "Fit";
  }

  return moveProbability <= 3 ? "Fit" : "Signal";
}

function validateProspectType(value: string | undefined, rowNumber: number): "Signal" | "Fit" {
  const normalized = (value ?? "").trim().toLowerCase();

  if (normalized === "signal" || normalized === "signal-backed") {
    return "Signal";
  }

  if (normalized === "fit" || normalized === "fit-only") {
    return "Fit";
  }

  throw new Error(`Workbook row ${rowNumber} must set type to Signal or Fit.`);
}

function validateRationale(value: string, rowNumber: number): string {
  const rationale = value.trim();

  if (!rationale) {
    throw new Error(`Workbook row ${rowNumber} is missing required rationale.`);
  }

  if (rationale.length > 300) {
    throw new Error(`Workbook row ${rowNumber} rationale exceeds 300 characters.`);
  }

  return rationale;
}

function buildLegacyRationale(fitSummary: string): string {
  const firstClause = fitSummary
    .split(/[.;]/)
    .map((part) => part.trim())
    .find(Boolean);

  return (firstClause || "Legacy workbook row imported before rationale was added.").slice(0, 300);
}

export function parseWorkbookCsv(
  csv: string,
  options?: {
    allowLegacyRationale?: boolean;
    allowLegacyPropertyType?: boolean;
    allowLegacyType?: boolean;
  },
): WorkbookRow[] {
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    throw new Error("Workbook CSV response is empty.");
  }

  const headers = splitCsvLine(lines[0]);
  const missingHeaders = REQUIRED_HEADERS.filter((h) => !headers.includes(h));
  const allowedLegacyHeaders = new Set<string>();
  if (options?.allowLegacyRationale) {
    allowedLegacyHeaders.add("rationale");
  }
  if (options?.allowLegacyPropertyType) {
    allowedLegacyHeaders.add("property_type");
  }
  if (options?.allowLegacyType) {
    allowedLegacyHeaders.add("type");
  }

  const disallowedMissingHeaders = missingHeaders.filter((header) => !allowedLegacyHeaders.has(header));

  if (disallowedMissingHeaders.length) {
    throw new Error(`Missing required workbook CSV headers: ${missingHeaders.join(", ")}`);
  }

  const headerIndex = Object.fromEntries(headers.map((h, idx) => [h, idx])) as Record<string, number>;

  return lines
    .slice(1)
    .map((line, index) => {
      const cols = splitCsvLine(line);
      const rowNumber = index + 2;
      return {
        business_name: (cols[headerIndex.business_name] ?? "").trim(),
        category: (cols[headerIndex.category] ?? "N/A").trim() || "N/A",
        property_type:
          typeof headerIndex.property_type === "number"
            ? (cols[headerIndex.property_type] ?? "").trim() || "Mixed-use"
            : buildLegacyPropertyType(
                cols[headerIndex.category] ?? "",
                cols[headerIndex.fit_summary] ?? "",
                cols[headerIndex.rationale] ?? "",
              ),
        type:
          typeof headerIndex.type === "number"
            ? validateProspectType(cols[headerIndex.type], rowNumber)
            : inferLegacyProspectType(
                clamp(parseLooseNumber(cols[headerIndex.move_probability_1_10], 1), 1, 10),
                cols[headerIndex.fit_summary] ?? "",
              ),
        city: (cols[headerIndex.city] ?? "").trim(),
        state: (cols[headerIndex.state] ?? "").trim(),
        distance_miles: parseLooseNumber(cols[headerIndex.distance_miles], 0),
        tenant_fit_score_100: clamp(parseLooseNumber(cols[headerIndex.tenant_fit_score_100], 0), 0, 100),
        move_probability_1_10: clamp(parseLooseNumber(cols[headerIndex.move_probability_1_10], 1), 1, 10),
        priority_rank: parseLooseNumber(cols[headerIndex.priority_rank], 0),
        fit_summary: (cols[headerIndex.fit_summary] ?? "").trim().slice(0, 400),
        rationale:
          typeof headerIndex.rationale === "number"
            ? validateRationale(cols[headerIndex.rationale] ?? "", rowNumber)
            : buildLegacyRationale(cols[headerIndex.fit_summary] ?? ""),
        owner_contact_name: (cols[headerIndex.owner_contact_name] ?? "N/A").trim() || "N/A",
      } satisfies WorkbookRow;
    })
    .filter((row) => row.business_name)
    .sort((a, b) => score(b) - score(a));
}
