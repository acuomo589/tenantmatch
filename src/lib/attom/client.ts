const ATTOM_DEFAULT_BASE_URL = "https://api.gateway.attomdata.com";

function getAttomConfig() {
  const apiKey = process.env.ATTOM_API_KEY?.trim();
  const baseUrl = (process.env.ATTOM_BASE_URL?.trim() || ATTOM_DEFAULT_BASE_URL).replace(/\/$/, "");

  if (!apiKey) {
    throw new Error("ATTOM_API_KEY is not configured");
  }

  return { apiKey, baseUrl };
}

function withParams(path: string, params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

export async function attomGet(
  servicePath: string,
  params: Record<string, string | number | boolean | undefined> = {},
) {
  const { apiKey, baseUrl } = getAttomConfig();
  const url = `${baseUrl}${withParams(servicePath, params)}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      APIKey: apiKey,
    },
    cache: "no-store",
  });

  const text = await response.text();
  const payload = text ? safeJson(text) : {};

  if (!response.ok) {
    const message =
      typeof payload === "object" && payload && "status" in payload
        ? `ATTOM request failed (${response.status})`
        : `ATTOM request failed (${response.status})`;
    throw new Error(message);
  }

  return payload;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { raw: text };
  }
}

export const attomPaths = {
  propertyV1: {
    address: "/propertyapi/v1.0.0/property/address",
    basicprofile: "/propertyapi/v1.0.0/property/basicprofile",
    buildingpermits: "/propertyapi/v1.0.0/property/buildingpermits",
    detail: "/propertyapi/v1.0.0/property/detail",
    detailowner: "/propertyapi/v1.0.0/property/detailowner",
    expandedprofile: "/propertyapi/v1.0.0/property/expandedprofile",
    id: "/propertyapi/v1.0.0/property/id",
    snapshot: "/propertyapi/v1.0.0/property/snapshot",
  },
  transactionV4: {
    salestrend: "/v4/transaction/salestrend",
  },
  transactionV3: {
    preforeclosuredetails: "/property/v3/preforeclosuredetails",
  },
  transactionV1: {
    alleventsDetail: "/propertyapi/v1.0.0/allevents/detail",
    alleventsSnapshot: "/propertyapi/v1.0.0/allevents/snapshot",
    detailmortgage: "/propertyapi/v1.0.0/property/detailmortgage",
    detailmortgageowner: "/propertyapi/v1.0.0/property/detailmortgageowner",
    saleSnapshot: "/propertyapi/v1.0.0/sale/snapshot",
    saleDetail: "/propertyapi/v1.0.0/sale/detail",
    saleshistorySnapshot: "/propertyapi/v1.0.0/saleshistory/snapshot",
    saleshistoryBasichistory: "/propertyapi/v1.0.0/saleshistory/basichistory",
    saleshistoryExpandedhistory: "/propertyapi/v1.0.0/saleshistory/expandedhistory",
    saleshistoryDetail: "/propertyapi/v1.0.0/saleshistory/detail",
  },
  valuationV1: {
    assessmentSnapshot: "/propertyapi/v1.0.0/assessment/snapshot",
    assessmentDetail: "/propertyapi/v1.0.0/assessment/detail",
    assessmenthistoryDetail: "/propertyapi/v1.0.0/assessmenthistory/detail",
    attomavmDetail: "/propertyapi/v1.0.0/attomavm/detail",
    avmSnapshot: "/propertyapi/v1.0.0/avm/snapshot",
    avmhistoryDetail: "/propertyapi/v1.0.0/avmhistory/detail",
    valuationHomeequity: "/propertyapi/v1.0.0/valuation/homeequity",
    valuationRentalavm: "/propertyapi/v1.0.0/valuation/rentalavm",
  },
  salesComparablesV2: {
    byAddress: "/property/v2/salescomparables/address",
    byApn: "/property/v2/salescomparables/apn",
    byPropid: "/property/v2/salescomparables/propid",
  },
  schoolV4: {
    detailwithschools: "/propertyapi/v4/property/detailwithschools",
    schoolProfile: "/v4/school/profile",
    schoolDistrict: "/v4/school/district",
    schoolSearch: "/v4/school/search",
  },
  fieldEnumerations: {
    detail: "/propertyapi/v1.0.0/enumerations/detail",
  },
};

export type PropertyV1Endpoint = keyof typeof attomPaths.propertyV1;
