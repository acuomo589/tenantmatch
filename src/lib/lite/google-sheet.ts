import { createSign } from "node:crypto";
import { getLiteConfig } from "@/lib/lite/config";
import { isMockAgenticFlowEnabled, MOCK_LISTING_ADDRESS } from "@/lib/testing/mock-agentic-flow";

export const DEFAULT_MOCK_INTAKE_TAB_NAME = "Sheet1";
export const DEFAULT_LITE_LINKS_TAB_NAME = "TenantMatch Links";

export type SheetCellUpdate = {
  tabName: string;
  rowNumber: number;
  columnIndex: number;
  value: string;
};

type GoogleSheetMetadata = {
  sheets: Array<{
    properties?: {
      sheetId?: number;
      title?: string;
    };
  }>;
};

type LiteSheetTabs = {
  intakeTabName: string;
  archiveTabName: string;
};

export type LiteSheetAdapter = {
  tabs: LiteSheetTabs;
  readValues(tabName: string): Promise<string[][]>;
  writeValues(updates: SheetCellUpdate[]): Promise<void>;
};

type MockSheetState = {
  tabs: Record<string, string[][]>;
};

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";

const DEFAULT_MOCK_VALUES = [
  ["broker_name", "email", "listing_address", "link"],
  ["Taylor Buyer", "buyer@example.com", MOCK_LISTING_ADDRESS, ""],
];

declare global {
  // eslint-disable-next-line no-var
  var __timpani_lite_mock_sheet_state__: MockSheetState | undefined;
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function quoteSheetTitle(title: string): string {
  return `'${title.replaceAll("'", "''")}'`;
}

function indexToColumnLetter(index: number): string {
  let current = index + 1;
  let result = "";

  while (current > 0) {
    const remainder = (current - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    current = Math.floor((current - 1) / 26);
  }

  return result;
}

function getMockState(): MockSheetState {
  if (globalThis.__timpani_lite_mock_sheet_state__) {
    return globalThis.__timpani_lite_mock_sheet_state__;
  }

  const created: MockSheetState = {
    tabs: {
      [DEFAULT_MOCK_INTAKE_TAB_NAME]: DEFAULT_MOCK_VALUES.map((row) => [...row]),
    },
  };
  globalThis.__timpani_lite_mock_sheet_state__ = created;
  return created;
}

export function resetMockLiteSheetValues(values?: string[][]): void {
  globalThis.__timpani_lite_mock_sheet_state__ = {
    tabs: {
      [DEFAULT_MOCK_INTAKE_TAB_NAME]: (values ?? DEFAULT_MOCK_VALUES).map((row) => [...row]),
    },
  };
}

export function getMockLiteSheetSnapshot(): Record<string, string[][]> {
  return Object.fromEntries(
    Object.entries(getMockState().tabs).map(([tabName, values]) => [tabName, values.map((row) => [...row])]),
  );
}

async function getGoogleAccessToken(): Promise<string> {
  const config = getLiteConfig();
  if (!config.googleServiceAccountEmail || !config.googleServiceAccountPrivateKey) {
    throw new Error("Google Sheets service account credentials are not configured.");
  }

  const issuedAt = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64UrlEncode(
    JSON.stringify({
      iss: config.googleServiceAccountEmail,
      scope: GOOGLE_SHEETS_SCOPE,
      aud: GOOGLE_TOKEN_URL,
      iat: issuedAt,
      exp: issuedAt + 3600,
    }),
  );

  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${payload}`);
  signer.end();
  const signature = signer
    .sign(config.googleServiceAccountPrivateKey)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

  const assertion = `${header}.${payload}.${signature}`;
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to authenticate Google Sheets service account: ${response.status}`);
  }

  const payloadJson = (await response.json()) as { access_token?: string };
  if (!payloadJson.access_token) {
    throw new Error("Google Sheets access token response was empty.");
  }

  return payloadJson.access_token;
}

async function loadSpreadsheetMetadata(spreadsheetId: string, accessToken: string): Promise<GoogleSheetMetadata> {
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.sheetId,sheets.properties.title`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to load sheet metadata: ${response.status}`);
  }

  return (await response.json()) as GoogleSheetMetadata;
}

async function createGoogleSheetTab(spreadsheetId: string, accessToken: string, title: string): Promise<void> {
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      requests: [
        {
          addSheet: {
            properties: {
              title,
            },
          },
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create Google Sheet tab "${title}": ${response.status}`);
  }
}

function resolveIntakeTabName(metadata: GoogleSheetMetadata, configuredTabName: string | null): string {
  if (configuredTabName) {
    return configuredTabName;
  }

  const title = metadata.sheets[0]?.properties?.title?.trim();
  if (!title) {
    throw new Error("Could not determine Google Sheet intake tab title.");
  }

  return title;
}

function hasSheetTab(metadata: GoogleSheetMetadata, title: string): boolean {
  return metadata.sheets.some((sheet) => sheet.properties?.title?.trim() === title);
}

async function createGoogleSheetAdapter(): Promise<LiteSheetAdapter> {
  const config = getLiteConfig();
  if (!config.googleSpreadsheetId) {
    throw new Error("LITE_GOOGLE_SHEET_URL is not configured or could not be parsed.");
  }

  const accessToken = await getGoogleAccessToken();
  let metadata = await loadSpreadsheetMetadata(config.googleSpreadsheetId, accessToken);
  const intakeTabName = resolveIntakeTabName(metadata, config.googleSheetTabName);
  const archiveTabName = config.googleLinksTabName;

  if (!hasSheetTab(metadata, archiveTabName)) {
    await createGoogleSheetTab(config.googleSpreadsheetId, accessToken, archiveTabName);
    metadata = await loadSpreadsheetMetadata(config.googleSpreadsheetId, accessToken);
  }

  if (!hasSheetTab(metadata, intakeTabName)) {
    throw new Error(`Configured intake tab "${intakeTabName}" does not exist in the spreadsheet.`);
  }

  return {
    tabs: {
      intakeTabName,
      archiveTabName,
    },
    async readValues(tabName) {
      const range = `${quoteSheetTitle(tabName)}!A:ZZ`;
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${config.googleSpreadsheetId}/values/${encodeURIComponent(range)}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error(`Failed to read sheet values from "${tabName}": ${response.status}`);
      }

      const payload = (await response.json()) as { values?: string[][] };
      return payload.values ?? [];
    },
    async writeValues(updates) {
      if (!updates.length) return;

      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${config.googleSpreadsheetId}/values:batchUpdate`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            valueInputOption: "RAW",
            data: updates.map((update) => ({
              range: `${quoteSheetTitle(update.tabName)}!${indexToColumnLetter(update.columnIndex)}${update.rowNumber}`,
              values: [[update.value]],
            })),
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`Failed to write sheet values: ${response.status}`);
      }
    },
  };
}

function ensureMockTab(state: MockSheetState, tabName: string): void {
  if (!state.tabs[tabName]) {
    state.tabs[tabName] = [];
  }
}

function createMockSheetAdapter(): LiteSheetAdapter {
  const config = getLiteConfig();
  const state = getMockState();
  const intakeTabName = config.googleSheetTabName || Object.keys(state.tabs)[0] || DEFAULT_MOCK_INTAKE_TAB_NAME;
  const archiveTabName = config.googleLinksTabName;
  ensureMockTab(state, intakeTabName);
  ensureMockTab(state, archiveTabName);

  return {
    tabs: {
      intakeTabName,
      archiveTabName,
    },
    async readValues(tabName) {
      ensureMockTab(state, tabName);
      return state.tabs[tabName].map((row) => [...row]);
    },
    async writeValues(updates) {
      for (const update of updates) {
        ensureMockTab(state, update.tabName);
        const rows = state.tabs[update.tabName];
        while (rows.length < update.rowNumber) {
          rows.push([]);
        }
        const row = rows[update.rowNumber - 1] ?? [];
        row[update.columnIndex] = update.value;
        rows[update.rowNumber - 1] = row;
      }
    },
  };
}

export async function createLiteSheetAdapter(): Promise<LiteSheetAdapter> {
  return isMockAgenticFlowEnabled() ? createMockSheetAdapter() : createGoogleSheetAdapter();
}
