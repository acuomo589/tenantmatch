import { getLiteAppUrl } from "@/lib/lite/config";

export function buildLiteLinkUrl(token: string, request?: Request): string {
  const hasConfiguredAppUrl = Boolean(process.env.APP_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim());
  const origin = hasConfiguredAppUrl ? getLiteAppUrl() : request ? new URL(request.url).origin : getLiteAppUrl();
  return `${origin.replace(/\/$/, "")}/r/${token}`;
}
