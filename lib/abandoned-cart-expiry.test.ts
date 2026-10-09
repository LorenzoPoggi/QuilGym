import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { authRateLimits, carts } from "./db/schema";

const mocks = vi.hoisted(() => ({ withOrderTransaction: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("./db/transaction", () => ({ withOrderTransaction: mocks.withOrderTransaction }));

import { expireAbandonedCarts } from "./abandoned-cart-expiry";

const pg = new PGlite();
const database = drizzle(pg);
const now = new Date("2026-10-09T12:00:00.000Z");
const oldCart = "00000000-0000-4000-8000-000000000001";
const orderedCart = "00000000-0000-4000-8000-000000000002";
const recentCart = "00000000-0000-4000-8000-000000000003";

beforeAll(async () => {
  await pg.exec(`
    create table carts (id uuid primary key, coupon_code text, created_at timestamptz not null default now(), updated_at timestamptz not null);
    create table orders (id uuid primary key, cart_id uuid not null);
    create table auth_rate_limits (id text primary key, key text unique not null, count integer not null, last_request bigint not null);
  `);
  mocks.withOrderTransaction.mockImplementation((run) => database.transaction((tx) => run(tx)));
}, 30_000);

beforeEach(async () => {
  await database.execute(sql`truncate carts, orders, auth_rate_limits`);
  await database.insert(carts).values([
    { id: oldCart, updatedAt: new Date(now.getTime() - 61 * 24 * 60 * 60_000) },
    { id: orderedCart, updatedAt: new Date(now.getTime() - 61 * 24 * 60 * 60_000) },
    { id: recentCart, updatedAt: new Date(now.getTime() - 2 * 24 * 60 * 60_000) },
  ]);
  await database.execute(sql`insert into orders (id, cart_id) values ('00000000-0000-4000-8000-000000000011', ${orderedCart})`);
  await database.insert(authRateLimits).values([
    { id: `checkout:quote:${oldCart}`, key: `checkout:quote:${oldCart}`, count: 1, lastRequest: now.getTime() - 60_000 },
    { id: `advisor:visitor:expired`, key: `advisor:visitor:expired`, count: 8, lastRequest: now.getTime() - 49 * 60 * 60_000 },
    { id: `payment:submit:expired`, key: `payment:submit:expired`, count: 10, lastRequest: now.getTime() - 50 * 60 * 60_000 },
    { id: `reviews:global:day`, key: `reviews:global:day`, count: 4, lastRequest: now.getTime() - 25 * 60 * 60_000 },
    { id: `advisor:visitor:active`, key: `advisor:visitor:active`, count: 2, lastRequest: now.getTime() - 5 * 60_000 },
  ]);
});

afterAll(async () => { await pg.close(); });

describe("expireAbandonedCarts", () => {
  it("elimina solo carritos huérfanos vencidos y contadores de rate limit ya caducados", async () => {
    const result = await expireAbandonedCarts(now);
    expect(result).toEqual({ deleted: 1, rateLimitsDeleted: 3, cutoff: new Date("2026-08-10T12:00:00.000Z") });
    const remainingCarts = await database.select({ id: carts.id }).from(carts);
    expect(remainingCarts.map(({ id }) => id)).toEqual([orderedCart, recentCart]);
    const remainingLimits = await database.select({ key: authRateLimits.key }).from(authRateLimits);
    expect(remainingLimits.map(({ key }) => key).sort()).toEqual(["advisor:visitor:active", "reviews:global:day"]);
  });

  it("rechaza una retención menor a la vida máxima de la cookie", async () => {
    await expect(expireAbandonedCarts(now, 59)).rejects.toThrow("Retención de carrito fuera de rango.");
  });

  it("continúa en un segundo lote cuando hay más de 500 contadores caducados", async () => {
    const old = now.getTime() - 60 * 60 * 60_000;
    const rows = Array.from({ length: 501 }, (_, index) => {
      const key = `visitor:expired:${index}`;
      return { id: key, key, count: 1, lastRequest: old };
    });
    await database.insert(authRateLimits).values(rows);

    const result = await expireAbandonedCarts(now);
    expect(result.rateLimitsDeleted).toBe(504);
    expect(await database.select({ key: authRateLimits.key }).from(authRateLimits)).toHaveLength(2);
  });
});
