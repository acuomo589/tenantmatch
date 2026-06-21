import assert from "node:assert/strict";
import test from "node:test";

const ORIGINAL_ENV = { ...process.env };

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) {
      delete process.env[key];
    }
  }

  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (typeof value === "undefined") {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function setNodeEnv(value: string) {
  Object.assign(process.env, { NODE_ENV: value });
}

test.afterEach(() => {
  restoreEnv();
});

test("getLiteAppUrl prefers APP_URL and normalizes trailing slash", async () => {
  const { getLiteAppUrl } = await import("../../src/lib/lite/config");

  setNodeEnv("development");
  process.env.APP_URL = "https://tenantmatch.example.com/";
  process.env.NEXT_PUBLIC_APP_URL = "https://public.example.com/";

  assert.equal(getLiteAppUrl(), "https://tenantmatch.example.com");
});

test("getLiteAppUrl rejects localhost production URLs", async () => {
  const { getLiteAppUrl } = await import("../../src/lib/lite/config");

  setNodeEnv("production");
  process.env.APP_URL = "http://localhost:3000";
  delete process.env.NEXT_PUBLIC_APP_URL;

  assert.throws(() => getLiteAppUrl(), /cannot point to localhost in production/i);
});

test("mock flow cannot be enabled in production", async () => {
  const { isMockAgenticFlowEnabled } = await import("../../src/lib/testing/mock-agentic-flow");

  setNodeEnv("production");
  process.env.TIMPANI_MOCK_AGENTIC_FLOW = "1";

  assert.throws(() => isMockAgenticFlowEnabled(), /cannot be enabled in production/i);
});

test("lite config defaults the archive tab name", async () => {
  const { getLiteConfig } = await import("../../src/lib/lite/config");

  setNodeEnv("development");
  delete process.env.LITE_GOOGLE_LINKS_TAB_NAME;

  assert.equal(getLiteConfig().googleLinksTabName, "TenantMatch Links");
});
