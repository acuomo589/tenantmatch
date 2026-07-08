import { NextResponse } from "next/server";
import { buildLiteCsvFilename } from "@/lib/lite/download";
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

  return new NextResponse(link.workbook.workbookCsv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${buildLiteCsvFilename(link.workbook.displayAddress)}"`,
    },
  });
}
