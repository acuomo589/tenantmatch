import type { WorkbookRow } from "@/lib/workbookCsv";

type MockListingSpaceRecord = {
  spaceLabel?: string;
  floorLabel?: string;
  suite?: string;
  sizeSf?: number;
  minSizeSf?: number;
  maxSizeSf?: number;
  termText?: string;
  rentalRatePerSfYr?: number;
  rentalRateDisplay?: string;
  spaceUsePrimary?: string;
  spaceUseTags?: string[];
  buildOut?: string;
  availableDate?: string;
  availableNow?: boolean;
};

type MockListingFeatureRecord = {
  featureKey?: string;
  featureValueNumber?: number;
  featureValueText?: string;
  unit?: string;
  sourceText?: string;
  confidence?: number;
};

type MockListingDisclosureRecord = {
  text: string;
  sourceText?: string;
  source?: "UPLOAD" | "SEARCH" | "PARSED";
  isMaterial?: boolean;
  confidence?: number;
};

type MockListingContactRecord = {
  name: string;
  role?: string;
  company?: string;
  phone?: string;
  email?: string;
};

type MockListingTenantRecord = {
  tenantName: string;
  industry?: string;
  floorLabel?: string;
};

export type MockListingRecord = {
  id: string;
  title: string;
  customTitle?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  squareFootage?: number;
  noi?: number;
  capRate?: number;
  pricePerSquareFoot?: number;
  daysOnMarket?: number;
  source?: string;
  propertyClass?: string;
  lotSizeAcres?: number;
  locationDescription?: string;
  listingSummary?: string;
  ownerProvisions?: string;
  leaseTermYears?: number;
  rawDetails?: string;
  rentalRatePerSfYr?: number;
  listingType?: "FOR_LEASE" | "FOR_SALE" | "BOTH";
  lifecycleStatus?: "ACTIVE" | "OFF_MARKET";
  dateOnMarket?: string;
  lastUpdatedAtSource?: string;
  spaces: MockListingSpaceRecord[];
  disclosures: MockListingDisclosureRecord[];
  features: MockListingFeatureRecord[];
  constraints: string[];
  contacts: MockListingContactRecord[];
  tenants: MockListingTenantRecord[];
};

export type MockListingResearchAnalysis = {
  listingSummary: string;
  marketScore: number;
  listingScore: number;
  marketRationale: string;
  listingRationale: string;
  demandSignals: string[];
  headwinds: string[];
  assumptions: string[];
  confidence: "Low" | "Medium" | "High";
};

export type MockExploreOptionsScenario = {
  id: string;
  name: string;
  whyItFits: string;
  whatMustBeTrue: string[];
  scopeLevel: "Light reposition" | "Heavy rehab" | "Gut renovation" | "Partial demo" | "Teardown";
  entitlementDifficulty: "Low" | "Medium" | "High";
  operatorSkillRequired: string;
  exitFlipability: string;
  timeline: string;
  financeability: "Low" | "Medium" | "High";
  hardCostPerSfUsd: string;
  softCostPct: string;
  contingencyPct: string;
  totalProjectCostLowUsd: string;
  totalProjectCostHighUsd: string;
  targetTenantOrBuyer: string;
  revenueModel: string;
  exitStrategy: string;
  marginView: "Strong" | "Thin" | "Negative/speculative";
  buildOutScope: string[];
  incentives: string[];
  killPoints: string[];
};

export type MockExploreOptionsAnalysis = {
  propertySnapshot: string;
  finalVerdict: "Strong candidate" | "Worth exploring" | "Only works with subsidy or basis reset" | "Pass";
  developerSummary: string;
  redFlags: string[];
  scenarios: MockExploreOptionsScenario[];
};

export const MOCK_AGENTIC_FLOW_ENV = "TIMPANI_MOCK_AGENTIC_FLOW";

export const MOCK_LISTING_ADDRESS = "875 Taylor Station Rd, Gahanna, OH 43230";
export const MOCK_LISTING_DETAILS_INPUT = `875 Taylor Station Rd, Gahanna, OH 43230

Industrial flex opportunity in east Columbus submarket.
Approximately 42,500 SF with 24' clear height, 6 dock doors, 2 drive-ins, and heavy power.
Built in 1998, renovated common areas in 2021.
Ideal for regional distribution, light assembly, service logistics, or specialty food production.
Parking for 118 vehicles with trailer storage in rear yard.
Current asking lease rate is $8.95 NNN with 7-10 year term preferred.
Landlord will provide tenant improvement allowance for credit tenants.
Access to I-270 and John Glenn International Airport within 15 minutes.
Broker says newer speculative product nearby is competing on finish level, but this asset wins on power and yard depth.
No cannabis use. Tenant must verify sprinkler capacity and trailer circulation.
Primary contacts: Dana Brooks at North Ridge Commercial, and owner rep Michael Lane.`;

export const MOCK_PARSED_LISTING: MockListingRecord = {
  id: "listing_mock_columbus_flex",
  title: "Taylor Station Industrial Flex",
  addressLine1: "875 Taylor Station Rd",
  city: "Gahanna",
  state: "OH",
  postalCode: "43230",
  squareFootage: 42500,
  pricePerSquareFoot: 9,
  daysOnMarket: 37,
  source: "MANUAL",
  propertyClass: "Industrial Flex",
  lotSizeAcres: 4.8,
  locationDescription:
    "East Columbus industrial node with fast I-270 access, short airport drive time, and practical distribution/service-user appeal.",
  listingSummary:
    "42.5K SF industrial flex asset with clear height, yard utility, and enough power to compete for practical mid-bay users.",
  ownerProvisions: "Tenant improvement allowance available for qualified credit tenants.",
  leaseTermYears: 10,
  rawDetails: MOCK_LISTING_DETAILS_INPUT,
  rentalRatePerSfYr: 8.95,
  listingType: "FOR_LEASE",
  lifecycleStatus: "ACTIVE",
  dateOnMarket: "2025-03-26T00:00:00.000Z",
  lastUpdatedAtSource: "2025-04-28T00:00:00.000Z",
  spaces: [
    {
      spaceLabel: "Full building",
      suite: "Building A",
      sizeSf: 42500,
      minSizeSf: 12000,
      maxSizeSf: 42500,
      termText: "7-10 year term preferred",
      rentalRatePerSfYr: 8.95,
      rentalRateDisplay: "$8.95/SF NNN",
      spaceUsePrimary: "Industrial",
      spaceUseTags: ["Distribution", "Light assembly", "Service logistics"],
      buildOut: "Warehouse + finished office",
      availableNow: true,
    },
  ],
  disclosures: [
    {
      text: "No cannabis use permitted.",
      sourceText: "No cannabis use permitted.",
      source: "PARSED",
      isMaterial: true,
      confidence: 0.98,
    },
    {
      text: "Tenant must verify sprinkler capacity and trailer circulation.",
      sourceText: "Tenant must verify sprinkler capacity and trailer circulation.",
      source: "PARSED",
      isMaterial: true,
      confidence: 0.93,
    },
  ],
  features: [
    { featureKey: "clear_height", featureValueText: "24 foot clear height", sourceText: "24' clear height", confidence: 0.95 },
    { featureKey: "loading", featureValueText: "6 dock doors and 2 drive-ins", sourceText: "6 dock doors, 2 drive-ins", confidence: 0.94 },
    { featureKey: "power", featureValueText: "Heavy power for production users", sourceText: "heavy power", confidence: 0.9 },
    { featureKey: "parking", featureValueText: "118 parking spaces with trailer storage", sourceText: "Parking for 118 vehicles with trailer storage", confidence: 0.91 },
  ],
  constraints: ["No cannabis use permitted", "Verify sprinkler capacity", "Verify trailer circulation"],
  contacts: [
    {
      name: "Dana Brooks",
      role: "Broker",
      company: "North Ridge Commercial",
      phone: "(614) 555-0191",
      email: "dbrooks@northridge.example",
    },
    {
      name: "Michael Lane",
      role: "Owner Rep",
      company: "Taylor Station Holdings",
      phone: "(614) 555-0188",
      email: "mlane@taylordev.example",
    },
  ],
  tenants: [
    {
      tenantName: "Current light industrial operator",
      industry: "Logistics",
      floorLabel: "Warehouse",
    },
  ],
};

export const MOCK_LISTING_RESEARCH_ANALYSIS: MockListingResearchAnalysis = {
  listingSummary:
    "Practical east Columbus flex listing that benefits from airport and beltway access, with enough power and yard utility to appeal to regional distribution and service users.",
  marketScore: 82,
  listingScore: 76,
  marketRationale:
    "The east Columbus industrial market still attracts logistics, supplier, and airport-adjacent demand, though tenant choice is better than at the market peak and newer product competes on finish level.",
  listingRationale:
    "This asset screens well because it combines workable clear height, loading, parking, and power, but it still needs sharper diligence on circulation, sprinkler capacity, and office finish competitiveness.",
  demandSignals: [
    "Airport-adjacent industrial users remain active in the greater Columbus market.",
    "Mid-size distribution and service users still absorb practical flex product faster than niche large-bay requirements.",
    "Power-ready buildings continue to attract light manufacturing and specialty production demand.",
  ],
  headwinds: [
    "Newer speculative buildings nearby compete on finish and perceived image.",
    "Unknown capital needs around sprinklers and circulation can compress leasing velocity if not addressed quickly.",
  ],
  assumptions: [
    "Trailer access is workable after on-site verification.",
    "Electrical capacity is sufficient for light production users without a major service upgrade.",
  ],
  confidence: "High",
};

export const MOCK_EXPLORE_OPTIONS_ANALYSIS: MockExploreOptionsAnalysis = {
  propertySnapshot:
    "42.5K SF airport-adjacent industrial flex asset with clear height, loading, heavy power, and usable trailer/parking depth in a still-active Columbus submarket.",
  finalVerdict: "Strong candidate",
  developerSummary:
    "The asset already fits real user demand, so the best plays focus on targeted capital, sharper positioning, and fast pre-leasing rather than speculative over-design.",
  redFlags: [
    "Competing newer product may win image-sensitive tenants.",
    "Sprinkler and circulation diligence could change TI scope and lease-up timing.",
  ],
  scenarios: [
    {
      id: "industrial-upgrade",
      name: "Targeted flex industrial upgrade",
      whyItFits: "The building already has core industrial utility, so light repositioning can improve rentability without carrying a deep redevelopment risk.",
      whatMustBeTrue: [
        "Power and sprinkler infrastructure pass tenant diligence without a major upgrade.",
        "Leasing demand remains strongest among service logistics and light production users.",
      ],
      scopeLevel: "Light reposition",
      entitlementDifficulty: "Low",
      operatorSkillRequired: "Industrial lease-up and practical capex execution",
      exitFlipability: "High once stabilized",
      timeline: "6-10 months",
      financeability: "High",
      hardCostPerSfUsd: "$18-$28/SF",
      softCostPct: "14%-18%",
      contingencyPct: "8%-10%",
      totalProjectCostLowUsd: "$1.1M",
      totalProjectCostHighUsd: "$1.8M",
      targetTenantOrBuyer: "Regional logistics, service, and specialty production users",
      revenueModel: "NNN leasing with staggered tenant improvement packages",
      exitStrategy: "Sell stabilized to industrial income buyer",
      marginView: "Strong",
      buildOutScope: ["Exterior refresh", "Spec office improvements", "Dock and lighting upgrades"],
      incentives: ["Port or jobs incentives if production users are targeted"],
      killPoints: ["Unexpected sprinkler upgrade requirement", "Comparable rents slip below underwriting range"],
    },
    {
      id: "food-production",
      name: "Food-grade light production conversion",
      whyItFits: "Power and logistics access create a lane for specialty food or beverage users if the infrastructure can support compliance upgrades.",
      whatMustBeTrue: [
        "Floor drains, ventilation, and wash-down requirements are feasible in the current shell.",
        "Tenant demand justifies a more tailored improvement package before delivery.",
      ],
      scopeLevel: "Heavy rehab",
      entitlementDifficulty: "Medium",
      operatorSkillRequired: "Food-grade industrial buildout execution",
      exitFlipability: "Medium",
      timeline: "12-18 months",
      financeability: "Medium",
      hardCostPerSfUsd: "$70-$110/SF",
      softCostPct: "18%-24%",
      contingencyPct: "10%-12%",
      totalProjectCostLowUsd: "$4.0M",
      totalProjectCostHighUsd: "$6.2M",
      targetTenantOrBuyer: "Specialty food production or cold-chain adjacent users",
      revenueModel: "Build-to-suit lease with tenant-specific improvements",
      exitStrategy: "Hold through tenant term or sell to niche industrial investor",
      marginView: "Thin",
      buildOutScope: ["Sanitary finishes", "Targeted MEP upgrades", "Process ventilation improvements"],
      incentives: ["State food manufacturing jobs credits", "Utility rebates for equipment upgrades"],
      killPoints: ["Compliance capex exceeds market rent support", "No tenant commitment before major spend"],
    },
    {
      id: "truck-terminal-lite",
      name: "Service logistics yard-forward play",
      whyItFits: "The parking and rear yard utility support a faster-turn operational user profile that values access over finish.",
      whatMustBeTrue: [
        "Trailer circulation works operationally for the target fleet profile.",
        "The office component is sufficient for dispatch and field management teams.",
      ],
      scopeLevel: "Light reposition",
      entitlementDifficulty: "Low",
      operatorSkillRequired: "Fleet/service industrial tenanting",
      exitFlipability: "Medium",
      timeline: "5-8 months",
      financeability: "High",
      hardCostPerSfUsd: "$12-$20/SF",
      softCostPct: "12%-16%",
      contingencyPct: "8%-10%",
      totalProjectCostLowUsd: "$850K",
      totalProjectCostHighUsd: "$1.35M",
      targetTenantOrBuyer: "Regional field service, utility, and fleet operators",
      revenueModel: "Operational lease with moderate yard premium",
      exitStrategy: "Hold for yield or sell once leased to a sticky operator",
      marginView: "Strong",
      buildOutScope: ["Yard striping", "Security improvements", "Dispatch office refresh"],
      incentives: ["Workforce grants for service operators"],
      killPoints: ["Yard geometry fails field test", "Municipal use restrictions reduce truck activity"],
    },
  ],
};

const MOCK_WORKBOOK_NAMES = [
  "Cardinal MedTech Services",
  "Buckeye Cold Chain Foods",
  "Riverbend Packaging Labs",
  "Apex Field Logistics",
  "Tri-County Specialty Foods",
  "Iron Route Industrial Supply",
  "North Loop Assembly Works",
  "Keystone Mobility Services",
  "Midstate Beverage Systems",
  "Anchor Safety Distribution",
  "Horizon Lab Fulfillment",
  "Summit Utility Fleet Ops",
  "BluePeak Process Equipment",
  "ForgePoint Service Logistics",
  "Centric Foods Manufacturing",
  "Atlas Warehouse Support",
  "Next Mile Technical Supply",
  "Crown Valley Packaging",
  "Sterling Cold Storage Support",
  "LiftLine Maintenance Group",
];

export const MOCK_WORKBOOK_ROWS: WorkbookRow[] = MOCK_WORKBOOK_NAMES.map((businessName, index) => ({
  business_name: businessName,
  category: index % 3 === 0 ? "Service logistics" : index % 3 === 1 ? "Food production" : "Industrial supply",
  city: index % 2 === 0 ? "Columbus" : "Gahanna",
  state: "OH",
  distance_miles: Number((3.2 + index * 0.8).toFixed(1)),
  tenant_fit_score_100: 92 - index,
  move_probability_1_10: Math.max(4, 10 - Math.floor(index / 3)),
  priority_rank: index + 1,
  fit_summary:
    "Operationally aligned with the building's access, power profile, and flexible bay depth, with enough scale to justify targeted tenant improvements.",
  owner_contact_name: `${["Dana", "Morgan", "Taylor", "Jordan"][index % 4]} ${["Reed", "Parker", "Shaw", "Mills", "Flynn"][index % 5]}`,
}));

export const MOCK_WORKBOOK_CSV = buildWorkbookCsv(MOCK_WORKBOOK_ROWS);

export function isMockAgenticFlowEnabled(): boolean {
  const enabled = process.env[MOCK_AGENTIC_FLOW_ENV] === "1";

  if (enabled && process.env.NODE_ENV === "production") {
    throw new Error(`${MOCK_AGENTIC_FLOW_ENV} cannot be enabled in production.`);
  }

  return enabled;
}

function buildWorkbookCsv(rows: WorkbookRow[]): string {
  const headers = [
    "business_name",
    "category",
    "city",
    "state",
    "distance_miles",
    "tenant_fit_score_100",
    "move_probability_1_10",
    "priority_rank",
    "fit_summary",
    "owner_contact_name",
  ];

  const body = rows.map((row) =>
    [
      row.business_name,
      row.category,
      row.city,
      row.state,
      row.distance_miles,
      row.tenant_fit_score_100,
      row.move_probability_1_10,
      row.priority_rank,
      row.fit_summary,
      row.owner_contact_name,
    ]
      .map(escapeCsvCell)
      .join(","),
  );

  return [headers.join(","), ...body].join("\n");
}

function escapeCsvCell(value: string | number): string {
  const stringValue = String(value);
  if (!/[",\n]/.test(stringValue)) return stringValue;
  return `"${stringValue.replaceAll('"', '""')}"`;
}
