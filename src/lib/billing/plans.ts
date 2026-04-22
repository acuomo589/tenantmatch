export type PlanLimits = {
  listings: number;
  contacts: number;
  workbooks: number;
  workbookRows: number;
};

export type PlanCatalogItem = {
  code: "FREE" | "PLUS" | "PRO";
  name: string;
  monthlyPriceCents: number;
  stripePriceId?: string;
  limits: PlanLimits;
};

export const PLAN_CATALOG: PlanCatalogItem[] = [
  {
    code: "FREE",
    name: "Free",
    monthlyPriceCents: 0,
    limits: {
      listings: 3,
      contacts: 25,
      workbooks: 1,
      workbookRows: 100,
    },
  },
  {
    code: "PLUS",
    name: "Plus",
    monthlyPriceCents: 9900,
    stripePriceId: process.env.STRIPE_PRICE_PLUS,
    limits: {
      listings: 25,
      contacts: 500,
      workbooks: 20,
      workbookRows: 5000,
    },
  },
  {
    code: "PRO",
    name: "Pro",
    monthlyPriceCents: 29900,
    stripePriceId: process.env.STRIPE_PRICE_PRO,
    limits: {
      listings: 200,
      contacts: 5000,
      workbooks: 200,
      workbookRows: 50000,
    },
  },
];

export function findPlanByCode(code: string) {
  return PLAN_CATALOG.find((plan) => plan.code === code);
}

export function getPlanDisplayPrice(monthlyPriceCents: number): string {
  if (monthlyPriceCents <= 0) return "$0";
  return `$${Math.round(monthlyPriceCents / 100)}`;
}
