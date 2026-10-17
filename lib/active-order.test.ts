import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "./db/schema";

const mocks = vi.hoisted(() => ({ db: {}, user: vi.fn(), remembered: vi.fn(), demo: { value: false } }));
vi.mock("server-only", () => ({}));
vi.mock("./db", () => ({ db: mocks.db }));
vi.mock("./auth", () => ({ currentUser: mocks.user }));
vi.mock("./order-cookie-server", () => ({ readRememberedOrders: mocks.remembered }));
vi.mock("./checkout-config", () => ({ orderAccessSecret: () => "secreto-de-pedidos-con-mas-de-32-caracteres", getCheckoutConfig: () => ({ demo: mocks.demo.value }) }));
import { getActiveOrder } from "./active-order";
import { GET as activeRoute } from "../app/api/orders/active/route";

const pg = new PGlite();
const database = drizzle(pg, { schema });
beforeAll(async () => {
  for (const file of readdirSync("drizzle").filter((f) => f.endsWith(".sql")).sort()) await pg.exec(readFileSync(`drizzle/${file}`, "utf8"));
  Object.assign(mocks.db, { select: database.select.bind(database), execute: database.execute.bind(database) });
  await database.insert(schema.users).values({ id: "cuenta-1", name: "Cuenta", email: "cuenta@example.com" });
}, 30000);
afterAll(async () => { await pg.close(); });
beforeEach(async () => {
  mocks.user.mockResolvedValue(null);
  mocks.remembered.mockResolvedValue([]);
  mocks.demo.value = false;
  await database.execute(sql`truncate carts, orders restart identity cascade`);
});

type Options = { status?: "approved" | "pending" | "cancelled"; payment?: "mercadopago" | "cash"; shipment?: string; userId?: string | null; isDemo?: boolean; daysAgo?: number; eta?: boolean };
async function order({ status = "approved", payment = "mercadopago", shipment = "preparing", userId = null, isDemo = false, daysAgo = 1, eta = false }: Options = {}) {
  const [cart] = await database.insert(schema.carts).values({}).returning();
  const createdAt = new Date(Date.now() - daysAgo * 24 * 3_600_000);
  const [row] = await database.insert(schema.orders).values({ cartId: cart.id, checkoutKey: randomUUID(), userId, isDemo, status, paymentMethod: payment, paymentChoice: payment === "cash" ? "cash" : "mercadopago",
    name: "Cliente", email: "c@example.com", phone: "1144444444", delivery: payment === "cash" ? "pickup" : "local",
    subtotalArs: 1000, discountArs: 0, shippingArs: 0, totalArs: 1000, consentAt: createdAt, createdAt }).returning();
  const [created] = await database.insert(schema.shipments).values({ orderId: row.id, label: "Entrega", estimate: "A coordinar", status: shipment }).returning();
  if (eta) await database.insert(schema.shipmentTracking).values({ shipmentId: created.id, carrier: "own", etaFrom: new Date(), etaTo: new Date(Date.now() + 5 * 3_600_000) });
  return row.id;
}

describe("pedido en curso", () => {
  it("sin sesión ni cookie no consulta nada", async () => {
    expect(await getActiveOrder()).toBeNull();
  });

  it("invitado: encuentra por la cookie el pedido más reciente no entregado, con link firmado", async () => {
    const older = await order({ daysAgo: 3 });
    const newer = await order({ daysAgo: 1, shipment: "out_for_delivery", eta: true });
    mocks.remembered.mockResolvedValue([older, newer]);
    const active = await getActiveOrder();
    expect(active).toMatchObject({ id: newer, status: "out_for_delivery", title: expect.stringContaining("está en camino") });
    expect(active?.href).toMatch(new RegExp(`^/pedido/${newer}\\?t=[A-Za-z0-9_-]{43}$`));
    expect(active?.detail).toMatch(/^llega/);
  });

  it("excluye entregados, cancelados, pagos pendientes, demos y pedidos de más de 30 días", async () => {
    const ids = await Promise.all([
      order({ shipment: "delivered" }), order({ status: "cancelled" }), order({ status: "pending" }),
      order({ isDemo: true }), order({ daysAgo: 31 }),
    ]);
    mocks.remembered.mockResolvedValue(ids.slice(0, 3));
    expect(await getActiveOrder()).toBeNull();
    mocks.remembered.mockResolvedValue(ids.slice(3));
    expect(await getActiveOrder()).toBeNull();
  });

  it("incluye efectivo pendiente y, en modo demo, los pedidos simulados", async () => {
    const cash = await order({ status: "pending", payment: "cash", shipment: "ready_for_pickup" });
    mocks.remembered.mockResolvedValue([cash]);
    expect(await getActiveOrder()).toMatchObject({ id: cash, title: expect.stringContaining("listo para retirar") });
    const demo = await order({ isDemo: true, daysAgo: 0 });
    mocks.remembered.mockResolvedValue([demo]);
    mocks.demo.value = true;
    expect((await getActiveOrder())?.id).toBe(demo);
  });

  it("los pedidos de una cuenta aparecen con su sesión y nunca solo por la cookie", async () => {
    const own = await order({ userId: "cuenta-1" });
    mocks.remembered.mockResolvedValue([own]);
    expect(await getActiveOrder()).toBeNull();
    mocks.user.mockResolvedValue({ id: "cuenta-1" });
    mocks.remembered.mockResolvedValue([]);
    expect((await getActiveOrder())?.id).toBe(own);
    mocks.user.mockResolvedValue({ id: "otra-cuenta" });
    expect(await getActiveOrder()).toBeNull();
  });

  it("el endpoint responde sin caché y solo con los datos del aviso", async () => {
    const id = await order();
    mocks.remembered.mockResolvedValue([id]);
    const response = await activeRoute();
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.json() as { order: Record<string, unknown> };
    expect(Object.keys(body.order).sort()).toEqual(["code", "detail", "href", "id", "status", "title"]);
    expect(JSON.stringify(body)).not.toContain("c@example.com");
    mocks.remembered.mockRejectedValue(new Error("falla"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await (await activeRoute()).json()).toEqual({ order: null });
    warn.mockRestore();
  });
});
