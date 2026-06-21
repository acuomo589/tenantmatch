import { requireTenantContext } from "@/lib/auth/requestContext";
import { hasSupabaseConfig } from "@/lib/auth/supabaseConfig";
import { getLiteFallbackTenantId } from "@/lib/lite/store";

export async function resolveLiteTenantId(): Promise<string> {
  if (!hasSupabaseConfig()) {
    return getLiteFallbackTenantId();
  }

  const context = await requireTenantContext();
  return context.tenantId;
}
