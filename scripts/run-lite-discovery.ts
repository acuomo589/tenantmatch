import { readFileSync } from "node:fs";
import path from "node:path";

function loadLocalEnv(): void {
  const envPath = path.join(process.cwd(), ".env.local");
  const envText = readFileSync(envPath, "utf8");

  for (const line of envText.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex < 0) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }

    process.env[key] = value.replace(/\\n/g, "\n");
  }
}

async function loadModule<T>(relativePath: string): Promise<T> {
  const moduleUrl = new URL(relativePath, import.meta.url);
  const loaded = await import(moduleUrl.href);
  return ((loaded as { default?: T }).default ?? (loaded as T)) as T;
}

async function main(): Promise<void> {
  loadLocalEnv();

  const automation = await loadModule<{
    runLiteZipDiscovery(args: { tenantId: string; request?: Request }): Promise<unknown>;
  }>("../src/lib/lite/automation.ts");
  const store = await loadModule<{
    getLiteFallbackTenantId(): string;
  }>("../src/lib/lite/store.ts");
  const configModule = await loadModule<{
    getLiteConfig(): { automationTenantId: string | null };
  }>("../src/lib/lite/config.ts");

  const config = configModule.getLiteConfig();
  const tenantId = config.automationTenantId || store.getLiteFallbackTenantId();
  const summary = await automation.runLiteZipDiscovery({ tenantId });

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
