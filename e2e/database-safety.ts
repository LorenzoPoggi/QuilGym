import { existsSync } from "node:fs";
import { allowsDatabaseWrites } from "./database-safety-core";

// Next loads .env.local for its dev server, but Playwright itself does not.
// Read it here only so the guard can compare the configured default database
// without ever logging either URL.
if (existsSync(".env.local")) {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // A malformed local env must fail closed below, not enable write tests.
  }
}

export const databaseWritesEnabled = allowsDatabaseWrites({
  DATABASE_URL: process.env.DATABASE_URL,
  E2E_DATABASE_URL: process.env.E2E_DATABASE_URL,
  E2E_ALLOW_DATABASE_WRITES: process.env.E2E_ALLOW_DATABASE_WRITES,
});

export const databaseWriteSkipReason =
  "Este E2E escribe datos. Requiere E2E_ALLOW_DATABASE_WRITES=1 y E2E_DATABASE_URL distinta de DATABASE_URL; nunca usar Neon Production.";
