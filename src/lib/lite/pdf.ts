import type { WorkbookRow } from "@/lib/workbookCsv";

function escapePdfText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function buildPageContent(lines: string[]): string {
  const parts: string[] = ["BT", "/F1 9 Tf", "40 800 Td"];

  lines.forEach((line, index) => {
    if (index > 0) {
      parts.push("0 -14 Td");
    }
    parts.push(`(${escapePdfText(line)}) Tj`);
  });

  parts.push("ET");
  return parts.join("\n");
}

export function createLiteWorkbookPdf(args: { address: string; rows: WorkbookRow[] }): Buffer {
  const contentLines = [
    `TenantMatch Workbook`,
    args.address,
    "",
    "Rank | Business | Category | Property Type | Location | Fit | Move | Summary | Rationale",
    ...args.rows.flatMap((row) => [
      `${row.priority_rank}. ${row.business_name} | ${row.category} | ${row.property_type} | ${row.city}, ${row.state} | ${row.tenant_fit_score_100}/100 | ${row.move_probability_1_10}/10`,
      `    ${row.fit_summary.slice(0, 140)}`,
      `    ${row.rationale.slice(0, 120)}`,
    ]),
  ];

  const pageSize = 46;
  const pages = [];
  for (let index = 0; index < contentLines.length; index += pageSize) {
    pages.push(contentLines.slice(index, index + pageSize));
  }

  const objects: string[] = [];
  const pushObject = (value: string) => {
    objects.push(value);
    return objects.length;
  };

  const fontObject = pushObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const contentObjectNumbers = pages.map((pageLines) => {
    const content = buildPageContent(pageLines);
    return pushObject(`<< /Length ${Buffer.byteLength(content, "utf8")} >>\nstream\n${content}\nendstream`);
  });

  const pageObjectNumbers = contentObjectNumbers.map((contentObjectNumber) =>
    pushObject(
      `<< /Type /Page /Parent 0 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 ${fontObject} 0 R >> >> /Contents ${contentObjectNumber} 0 R >>`,
    ),
  );

  const pagesObject = pushObject(
    `<< /Type /Pages /Kids [${pageObjectNumbers.map((number) => `${number} 0 R`).join(" ")}] /Count ${pageObjectNumbers.length} >>`,
  );

  pageObjectNumbers.forEach((pageObjectNumber, index) => {
    objects[pageObjectNumber - 1] = `<< /Type /Page /Parent ${pagesObject} 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 ${fontObject} 0 R >> >> /Contents ${contentObjectNumbers[index]} 0 R >>`;
  });

  const catalogObject = pushObject(`<< /Type /Catalog /Pages ${pagesObject} 0 R >>`);

  let output = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(output, "utf8"));
    output += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(output, "utf8");
  output += `xref\n0 ${objects.length + 1}\n`;
  output += "0000000000 65535 f \n";
  for (let index = 1; index < offsets.length; index += 1) {
    output += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  output += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogObject} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(output, "utf8");
}
