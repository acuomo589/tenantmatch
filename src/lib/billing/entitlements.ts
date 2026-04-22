import { UsageMetric, type PlanCode, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { PLAN_CATALOG } from "@/lib/billing/plans";

export class EntitlementError extends Error {
  constructor(
    message: string,
    public readonly details: {
      metric: UsageMetric;
      limit: number;
      used: number;
      requested: number;
    },
  ) {
    super(message);
  }
}

function getPeriodStart(date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function normalizeLimits(input: unknown): Record<UsageMetric, number> {
  const fallback = PLAN_CATALOG.find((plan) => plan.code === "FREE")?.limits;
  const source = (input ?? {}) as Record<string, unknown>;

  return {
    [UsageMetric.LISTINGS]: Number(source.listings ?? fallback?.listings ?? 3),
    [UsageMetric.CONTACTS]: Number(source.contacts ?? fallback?.contacts ?? 25),
    [UsageMetric.WORKBOOKS]: Number(source.workbooks ?? fallback?.workbooks ?? 1),
    [UsageMetric.WORKBOOK_ROWS]: Number(source.workbookRows ?? fallback?.workbookRows ?? 100),
  };
}

export async function ensurePlanCatalogSeeded(tx?: Prisma.TransactionClient) {
  const db = tx ?? prisma;
  for (const plan of PLAN_CATALOG) {
    await db.plan.upsert({
      where: { code: plan.code as PlanCode },
      update: {
        name: plan.name,
        monthlyPriceCents: plan.monthlyPriceCents,
        limitsJson: plan.limits,
      },
      create: {
        code: plan.code as PlanCode,
        name: plan.name,
        monthlyPriceCents: plan.monthlyPriceCents,
        limitsJson: plan.limits,
      },
    });
  }
}

export async function getTenantPlan(tenantId: string) {
  const activeSubscription = await prisma.tenantSubscription.findFirst({
    where: { tenantId, status: "ACTIVE" },
    include: { plan: true },
    orderBy: { updatedAt: "desc" },
  });

  if (!activeSubscription) {
    throw new Error("No active subscription found for tenant.");
  }

  return {
    planCode: activeSubscription.plan.code,
    planName: activeSubscription.plan.name,
    limits: normalizeLimits(activeSubscription.plan.limitsJson),
    subscription: activeSubscription,
  };
}

export async function getUsageSnapshot(tenantId: string) {
  const periodStart = getPeriodStart();
  const [plan, counters] = await Promise.all([
    getTenantPlan(tenantId),
    prisma.usageCounter.findMany({
      where: { tenantId, periodStart },
    }),
  ]);

  const counterMap = new Map(counters.map((counter) => [counter.metric, counter.value]));

  return {
    periodStart,
    planCode: plan.planCode,
    planName: plan.planName,
    limits: plan.limits,
    usage: {
      [UsageMetric.LISTINGS]: counterMap.get(UsageMetric.LISTINGS) ?? 0,
      [UsageMetric.CONTACTS]: counterMap.get(UsageMetric.CONTACTS) ?? 0,
      [UsageMetric.WORKBOOKS]: counterMap.get(UsageMetric.WORKBOOKS) ?? 0,
      [UsageMetric.WORKBOOK_ROWS]: counterMap.get(UsageMetric.WORKBOOK_ROWS) ?? 0,
    },
  };
}

export async function assertEntitlement(args: {
  tenantId: string;
  metric: UsageMetric;
  increment?: number;
}) {
  const increment = Math.max(1, Math.floor(args.increment ?? 1));
  const snapshot = await getUsageSnapshot(args.tenantId);
  const limit = snapshot.limits[args.metric];
  const used = snapshot.usage[args.metric];

  if (used + increment > limit) {
    throw new EntitlementError(
      `Plan limit reached for ${args.metric.toLowerCase().replaceAll("_", " ")}.`,
      {
        metric: args.metric,
        limit,
        used,
        requested: increment,
      },
    );
  }

  return {
    limit,
    used,
    remaining: Math.max(0, limit - used),
  };
}

export async function consumeEntitlement(args: {
  tenantId: string;
  metric: UsageMetric;
  increment?: number;
}) {
  const increment = Math.max(1, Math.floor(args.increment ?? 1));
  await assertEntitlement(args);

  const periodStart = getPeriodStart();
  await prisma.usageCounter.upsert({
    where: {
      tenantId_metric_periodStart: {
        tenantId: args.tenantId,
        metric: args.metric,
        periodStart,
      },
    },
    update: {
      value: { increment },
    },
    create: {
      tenantId: args.tenantId,
      metric: args.metric,
      periodStart,
      value: increment,
    },
  });
}

export async function setEntitlementUsageAbsolute(args: {
  tenantId: string;
  metric: UsageMetric;
  value: number;
}) {
  const safeValue = Math.max(0, Math.floor(args.value));
  const periodStart = getPeriodStart();
  await prisma.usageCounter.upsert({
    where: {
      tenantId_metric_periodStart: {
        tenantId: args.tenantId,
        metric: args.metric,
        periodStart,
      },
    },
    update: {
      value: safeValue,
    },
    create: {
      tenantId: args.tenantId,
      metric: args.metric,
      periodStart,
      value: safeValue,
    },
  });
}
