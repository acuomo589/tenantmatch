export function normalizeLiteAddress(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ");
}

export function presentLiteAddress(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function normalizeBuyerEmail(value: string): string {
  return value.trim().toLowerCase();
}
