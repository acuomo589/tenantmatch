import { PlanCode, SubscriptionStatus, TenantRole } from "@prisma/client";
import { ensurePlanCatalogSeeded } from "@/lib/billing/entitlements";
import { prisma } from "@/lib/db";

function defaultWorkspaceName(email: string, preferred?: string | null) {
  const trimmedPreferred = preferred?.trim();
  if (trimmedPreferred) return trimmedPreferred;
  const localPart = email.split("@")[0] ?? "team";
  return `${localPart}'s Workspace`;
}

function nextMonth(date = new Date()): Date {
  const cloned = new Date(date);
  cloned.setUTCMonth(cloned.getUTCMonth() + 1);
  return cloned;
}

export async function ensureTenantProvisionedForUser(args: {
  userId: string;
  email: string;
  fullName?: string | null;
  workspaceName?: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    await ensurePlanCatalogSeeded(tx);

    await tx.appUser.upsert({
      where: { id: args.userId },
      update: {
        email: args.email,
        fullName: args.fullName ?? undefined,
      },
      create: {
        id: args.userId,
        email: args.email,
        fullName: args.fullName ?? undefined,
      },
    });

    const existingMembership = await tx.tenantMembership.findFirst({
      where: { userId: args.userId },
      orderBy: { createdAt: "asc" },
    });

    if (existingMembership) {
      return {
        tenantId: existingMembership.tenantId,
        role: existingMembership.role,
      };
    }

    const tenant = await tx.tenant.create({
      data: {
        name: defaultWorkspaceName(args.email, args.workspaceName),
      },
    });

    await tx.tenantMembership.create({
      data: {
        tenantId: tenant.id,
        userId: args.userId,
        role: TenantRole.OWNER,
      },
    });

    const freePlan = await tx.plan.findUnique({ where: { code: PlanCode.FREE } });
    if (!freePlan) {
      throw new Error("Free plan not found during tenant provisioning.");
    }

    const now = new Date();
    await tx.tenantSubscription.create({
      data: {
        tenantId: tenant.id,
        planId: freePlan.id,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: now,
        currentPeriodEnd: nextMonth(now),
      },
    });

    return {
      tenantId: tenant.id,
      role: TenantRole.OWNER,
    };
  });
}
