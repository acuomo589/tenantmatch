import { notFound } from "next/navigation";
import { LiteLinkPage } from "@/components/lite/lite-link-page";
import { canDownloadLiteLink, confirmLiteLinkPayment, getLiteLinkWithWorkbookByToken } from "@/lib/lite/service";

export default async function LitePublicLinkPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ checkout?: string; session_id?: string }>;
}) {
  const { token } = await params;
  const resolvedSearchParams = await searchParams;
  let link = await getLiteLinkWithWorkbookByToken(token);

  if (!link) {
    notFound();
  }

  if (resolvedSearchParams.checkout === "success") {
    link = (await confirmLiteLinkPayment(token, resolvedSearchParams.session_id)) ?? link;
  }

  return (
    <LiteLinkPage
      token={token}
      link={link}
      fullAccess={canDownloadLiteLink(link)}
      mode="public"
      checkoutState={resolvedSearchParams.checkout}
    />
  );
}
