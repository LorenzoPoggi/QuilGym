import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from "vitest";
import { authRateLimits } from "./db/schema";

const mocks = vi.hoisted(() => ({ db: {} }));
vi.mock("server-only", () => ({}));
vi.mock("./db", () => ({ db: mocks.db }));
import { advisorVisitor, consumeAdvisorLimit, allowAdvisorRequest } from "./advisor-rate-limit";
const pg = new PGlite();
const database = drizzle(pg);
beforeAll(async () => {
  await pg.exec("create table auth_rate_limits (id text primary key, key text unique not null, count integer not null, last_request bigint not null)");
  Object.assign(mocks.db, { insert: database.insert.bind(database) });
}, 30000);
beforeEach(async () => { await database.execute(sql`truncate auth_rate_limits`); vi.stubEnv("AI_GATEWAY_API_KEY", "test-only-no-provider"); });
afterAll(async () => { vi.unstubAllEnvs(); await pg.close(); });
describe("límites compartidos del asesor", () => {
  it("acepta solo cookies firmadas y reemplaza identificadores alterados", () => {
    const original = advisorVisitor();
    expect(advisorVisitor(original.cookie).id).toBe(original.id);
    expect(advisorVisitor(`${original.id}.${"a".repeat(64)}`).id).not.toBe(original.id);
    expect(advisorVisitor("cookie-inválida").id).not.toBe(original.id);
  });
  it("el límite es atómico incluso con llamadas concurrentes", async () => {
    const accepted = await Promise.all(Array.from({ length: 12 }, () => consumeAdvisorLimit("qa", 8, 60000, 123000)));
    expect(accepted.filter(Boolean)).toHaveLength(8);
  });
  it("renueva la ventana sin crear filas ilimitadas por minuto", async () => {
    expect(await consumeAdvisorLimit("qa", 1, 60000, 123000)).toBe(true);
    expect(await consumeAdvisorLimit("qa", 1, 60000, 123001)).toBe(false);
    expect(await consumeAdvisorLimit("qa", 1, 60000, 183000)).toBe(true);
    expect(await database.select().from(authRateLimits)).toHaveLength(1);
  });
  it("un mismo visitante puede consultar ocho veces por minuto", async () => {
    for (let i = 0; i < 8; i++) expect(await allowAdvisorRequest("qa")).toBe(true);
    expect(await allowAdvisorRequest("qa")).toBe(false);
  });
});
