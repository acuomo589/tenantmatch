import { NextResponse } from "next/server";
import { createLiteWorkbookPdf } from "@/lib/lite/pdf";
import { buildLitePdfFilename } from "@/lib/lite/download";
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

  const pdf = createLiteWorkbookPdf({
    address: link.workbook.displayAddress,
    rows: link.workbook.workbookRowsJson,
  });

  return new NextResponse(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${buildLitePdfFilename(link.workbook.displayAddress)}"`,
    },
  });
}
