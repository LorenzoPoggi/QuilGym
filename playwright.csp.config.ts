import { existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";

const previewEnvPath = ".env.preview.local";
if (!existsSync(previewEnvPath)) {
  throw new Error("QA CSP cancelado: falta .env.preview.local. No se usará .env.local ni Production.");
}

process.loadEnvFile(previewEnvPath);
const databaseUrl = process.env.DATABASE_URL;
let isPreviewDatabase = false;
try {
  isPreviewDatabase = new URL(databaseUrl ?? "").pathname.replace(/^\//, "") === "quilgym_preview";
} catch {
  // The fail-closed error below intentionally does not reveal the URL.
}
if (!isPreviewDatabase) {
  throw new Error("QA CSP cancelado: DATABASE_URL de .env.preview.local no identifica quilgym_preview.");
}

export default defineConfig({
  testDir: "./e2e",
  testMatch: "csp.spec.ts",
  timeout: 120_000,
  workers: 1,
  fullyParallel: false,
  use: { baseURL: "http://localhost:3000", trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    { name: "desktop", use: { browserName: "chromium", viewport: { width: 1440, height: 1000 } } },
    { name: "mobile", use: { browserName: "chromium", viewport: { width: 390, height: 844 } } },
  ],
  webServer: {
    command: "npm run build && npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: false,
    timeout: 180_000,
    env: { ...process.env, CHECKOUT_DEMO_MODE: "true", NEXT_PUBLIC_SITE_URL: "http://localhost:3000" },
  },
});
