export function buildLiteCsvFilename(address: string): string {
  return `${address.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "").toLowerCase() || "workbook"}_timpani_lite.csv`;
}

export function buildLitePdfFilename(address: string): string {
  return `${address.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "").toLowerCase() || "workbook"}_timpani_lite.pdf`;
}
