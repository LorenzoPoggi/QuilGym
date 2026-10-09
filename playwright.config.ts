import { defineConfig } from "@playwright/test";
import { databaseWritesEnabled } from "./e2e/database-safety";

const isolatedDatabaseUrl = databaseWritesEnabled ? process.env.E2E_DATABASE_URL!.trim() : undefined;

export default defineConfig({
  testDir: "./e2e", timeout: 120000, workers: 1, fullyParallel: false,
  use: { baseURL: "http://localhost:3000", trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    { name: "desktop", use: { browserName: "chromium", viewport: { width: 1440, height: 1000 } } },
    { name: "mobile", use: { browserName: "chromium", viewport: { width: 390, height: 844 } } },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !databaseWritesEnabled,
    timeout: 120000,
    ...(isolatedDatabaseUrl ? { env: { DATABASE_URL: isolatedDatabaseUrl, CHECKOUT_DEMO_MODE: "true", NEXT_PUBLIC_SITE_URL: "http://localhost:3000" } } : {}),
  },
});
