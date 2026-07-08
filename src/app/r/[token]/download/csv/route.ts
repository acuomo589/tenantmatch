import { NextResponse } from "next/server";
import { buildLiteCsvFilename } from "@/lib/lite/download";
import { canDownloadLiteLink, getLiteLinkWithWorkbookByToken } from "@/lib/lite/service";

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
      "Content-Disposition": `attachment; filename="${buildLiteCsvFilename(link.workbook.displayAddress)}"`,
    },
  });
}
