export function presentText(value: string | null | undefined, fallback = "Not provided"): string {
  const normalized = value?.trim();
  return normalized ? normalized : fallback;
}

export function presentNumber(value: number | null | undefined, suffix = "", fallback = "Not provided"): string {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return `${value.toLocaleString()}${suffix}`;
}

export function presentArray(items: Array<string | null | undefined>, fallback = "Not provided"): string[] {
  const cleaned = items.map((item) => item?.trim() ?? "").filter(Boolean);
  return cleaned.length ? cleaned : [fallback];
}

export function presentValue(value: string | number | null | undefined, fallback = "Not provided"): string {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value.toLocaleString() : fallback;
  }
  return presentText(value, fallback);
}
