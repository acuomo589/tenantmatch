import { NextResponse } from "next/server";
import { createLiteWorkbookPdf } from "@/lib/lite/pdf";
import { canDownloadLiteLink, getLiteLinkWithWorkbookByToken } from "@/lib/lite/service";

function buildPdfFilename(address: string): string {
  return `${address.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "").toLowerCase() || "workbook"}_timpani_lite.pdf`;
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

  const pdf = createLiteWorkbookPdf({
    address: link.workbook.displayAddress,
    rows: link.workbook.workbookRowsJson,
  });

  return new NextResponse(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${buildPdfFilename(link.workbook.displayAddress)}"`,
    },
  });
}
