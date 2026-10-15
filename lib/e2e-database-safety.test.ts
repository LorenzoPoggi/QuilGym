import { describe, expect, it } from "vitest";
import { allowsDatabaseWrites } from "../e2e/database-safety-core";

describe("E2E database write guard", () => {
  const production = "postgresql://app:secret@ep-prod.neon.tech/quilgym?sslmode=require";

  it("requires explicit opt-in and a separate database endpoint", () => {
    expect(allowsDatabaseWrites({ DATABASE_URL: production, E2E_DATABASE_URL: "postgresql://app:test@ep-test.neon.tech/quilgym", E2E_ALLOW_DATABASE_WRITES: "1" })).toBe(true);
    expect(allowsDatabaseWrites({ DATABASE_URL: production, E2E_DATABASE_URL: "postgresql://app:test@ep-prod.neon.tech/quilgym?sslmode=verify-full", E2E_ALLOW_DATABASE_WRITES: "1" })).toBe(false);
    expect(allowsDatabaseWrites({ DATABASE_URL: production, E2E_DATABASE_URL: "postgresql://app:test@ep-test.neon.tech/quilgym" })).toBe(false);
  });

  it("fails closed for malformed or non-Postgres URLs", () => {
    expect(allowsDatabaseWrites({ DATABASE_URL: "not a url", E2E_DATABASE_URL: "postgresql://app:test@ep-test.neon.tech/quilgym", E2E_ALLOW_DATABASE_WRITES: "1" })).toBe(false);
    expect(allowsDatabaseWrites({ DATABASE_URL: production, E2E_DATABASE_URL: "https://example.com/db", E2E_ALLOW_DATABASE_WRITES: "1" })).toBe(false);
  });
});
