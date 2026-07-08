import { NextResponse } from "next/server";
import { createLiteWorkbookPdf } from "@/lib/lite/pdf";
import { buildLitePdfFilename } from "@/lib/lite/download";
import { getLiteLinkWithWorkbookByToken } from "@/lib/lite/service";
import { isValidLiteAdminLinkSignature } from "@/lib/lite/url";

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const signature = new URL(request.url).searchParams.get("sig");

  if (!isValidLiteAdminLinkSignature(token, signature)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const link = await getLiteLinkWithWorkbookByToken(token);
  if (!link) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
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
