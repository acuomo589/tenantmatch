export const RETAIL_LEASE_SEED_EXAMPLE = {
  listing: {
    title: "Neighborhood Retail Lease",
    source: "MANUAL",
    listingType: "FOR_LEASE",
    lifecycleStatus: "ACTIVE",
    addressLine1: "123 Main St",
    city: "Revere",
    state: "MA",
    postalCode: "02151",
  },
  spaces: [
    {
      sizeSf: 850,
      buildOut: "Shell",
      availableNow: true,
      termText: "Negotiable",
      spaceUsePrimary: "Retail",
    },
  ],
  disclosures: [
    {
      text: "No cannabis use permitted",
      sourceText: "No cannabis use permitted",
      source: "PARSED",
      isMaterial: true,
      confidence: 0.95,
    },
    {
      text: "Tenant to verify all measurements",
      sourceText: "Tenant to verify all measurements",
      source: "PARSED",
      isMaterial: true,
      confidence: 0.92,
    },
  ],
  features: [
    {
      featureKey: null,
      featureValueText: "Heavy daytime traffic",
      sourceText: "Heavy daytime traffic",
      confidence: 0.88,
    },
    {
      featureKey: null,
      featureValueText: "Floor to ceiling windows",
      sourceText: "Floor to ceiling windows",
      confidence: 0.9,
    },
  ],
} as const;
