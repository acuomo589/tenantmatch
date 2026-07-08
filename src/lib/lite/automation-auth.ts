import { timingSafeEqual } from "node:crypto";
import { hasSupabaseConfig } from "@/lib/auth/supabaseConfig";
import { getLiteConfig } from "@/lib/lite/config";
import { resolveLiteTenantId } from "@/lib/lite/runtime";
import { getLiteFallbackTenantId } from "@/lib/lite/store";
import { isMockAgenticFlowEnabled } from "@/lib/testing/mock-agentic-flow";

function matchesSecret(provided: string | null, expected: string | null): boolean {
  if (!provided || !expected) return false;
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }
  return timingSafeEqual(providedBuffer, expectedBuffer);
}

export async function requireLiteAutomationTenantId(request: Request): Promise<string> {
  if (isMockAgenticFlowEnabled()) {
    return getLiteFallbackTenantId();
  }

  const config = getLiteConfig();
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : null;

  if (matchesSecret(bearerToken, config.automationSecret)) {
    return config.automationTenantId || getLiteFallbackTenantId();
  }

  if (!hasSupabaseConfig()) {
    throw new Error("UNAUTHORIZED");
  }

  return resolveLiteTenantId();
}
