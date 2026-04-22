import { createSupabaseServerClient } from "@/lib/auth/supabaseServer";
import { ensureTenantProvisionedForUser } from "@/lib/auth/provisioning";
import { prisma } from "@/lib/db";

export async function requireTenantContext() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id || !user.email) {
    throw new Error("UNAUTHORIZED");
  }

  let membership = await prisma.tenantMembership.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });

  if (!membership) {
    const provisioned = await ensureTenantProvisionedForUser({
      userId: user.id,
      email: user.email,
      fullName: user.user_metadata?.full_name as string | undefined,
      workspaceName: user.user_metadata?.workspace_name as string | undefined,
    });

    membership = await prisma.tenantMembership.findFirst({
      where: {
        tenantId: provisioned.tenantId,
        userId: user.id,
      },
    });
  }

  if (!membership) {
    throw new Error("TENANT_NOT_FOUND");
  }

  return {
    user,
    tenantId: membership.tenantId,
    role: membership.role,
  };
}
