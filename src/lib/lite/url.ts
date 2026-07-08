import { createHmac, timingSafeEqual } from "node:crypto";
import { getLiteAdminLinkSecret, getLiteAppUrl } from "@/lib/lite/config";

function getLiteLinkOrigin(request?: Request): string {
  const hasConfiguredAppUrl = Boolean(process.env.APP_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim());
  return hasConfiguredAppUrl ? getLiteAppUrl() : request ? new URL(request.url).origin : getLiteAppUrl();
}

export function buildLiteLinkUrl(token: string, request?: Request): string {
  const origin = getLiteLinkOrigin(request);
  return `${origin.replace(/\/$/, "")}/r/${token}`;
}

export function createLiteAdminLinkSignature(token: string): string {
  return createHmac("sha256", getLiteAdminLinkSecret()).update(token).digest("base64url");
}

export function isValidLiteAdminLinkSignature(token: string, signature: string | null | undefined): boolean {
  const candidate = signature?.trim();
  if (!candidate) return false;

  const expected = createLiteAdminLinkSignature(token);
  const candidateBuffer = Buffer.from(candidate);
  const expectedBuffer = Buffer.from(expected);

  if (candidateBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(candidateBuffer, expectedBuffer);
}

export function buildLiteAdminLinkUrl(token: string, request?: Request): string {
  const origin = getLiteLinkOrigin(request);
  const signature = createLiteAdminLinkSignature(token);
  return `${origin.replace(/\/$/, "")}/a/${token}?sig=${encodeURIComponent(signature)}`;
}
