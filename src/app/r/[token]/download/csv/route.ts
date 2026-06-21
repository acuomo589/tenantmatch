import { NextResponse } from "next/server";
import { canDownloadLiteLink, getLiteLinkWithWorkbookByToken } from "@/lib/lite/service";

function buildCsvFilename(address: string): string {
  return `${address.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "").toLowerCase() || "workbook"}_timpani_lite.csv`;
}

export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const link = await getLiteLinkWithWorkbookByToken(token);

  if (!link) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!canDownloadLiteLink(link)) {
    return NextResponse.json({ error: "Payment required" }, { status: 403 });
  }

  return new NextResponse(link.workbook.workbookCsv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${buildCsvFilename(link.workbook.displayAddress)}"`,
    },
  });
}
