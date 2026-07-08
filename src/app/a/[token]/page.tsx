import { notFound } from "next/navigation";
import { LiteLinkPage } from "@/components/lite/lite-link-page";
import { getLiteLinkWithWorkbookByToken } from "@/lib/lite/service";
import { isValidLiteAdminLinkSignature } from "@/lib/lite/url";

export default async function LiteAdminLinkPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ sig?: string }>;
}) {
  const { token } = await params;
  const resolvedSearchParams = await searchParams;
  const signature = resolvedSearchParams.sig?.trim() || null;

  if (!isValidLiteAdminLinkSignature(token, signature)) {
    notFound();
  }

  const link = await getLiteLinkWithWorkbookByToken(token);
  if (!link) {
    notFound();
  }

  return <LiteLinkPage token={token} link={link} fullAccess mode="admin" adminSignature={signature} />;
}
