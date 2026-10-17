import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "./db/schema";

const mocks = vi.hoisted(() => ({ db: {} }));
vi.mock("server-only", () => ({}));
vi.mock("./db", () => ({ db: mocks.db }));
vi.mock("./invoicing", () => ({ processPendingInvoices: vi.fn(async () => {}), invoicesAvailable: vi.fn(async () => false) }));
vi.mock("./checkout-config", () => ({
  siteUrl: () => "https://quilgym.test",
  orderPageUrl: (id: string) => `https://quilgym.test/checkout/confirmacion/${id}?t=firmado`,
  orderTrackingUrl: (id: string) => `https://quilgym.test/pedido/${id}?t=firmado`,
}));
import { deliverOrderEmails } from "./order-email";

const pg = new PGlite();
const database = drizzle(pg, { schema });
const sent: { subject: string; text: string; to: string[] | string }[] = [];
beforeAll(async () => {
  for (const file of readdirSync("drizzle").filter((f) => f.endsWith(".sql")).sort()) await pg.exec(readFileSync(`drizzle/${file}`, "utf8"));
  Object.assign(mocks.db, { select: database.select.bind(database), update: database.update.bind(database), execute: database.execute.bind(database) });
  // Resend simulado: nunca sale nada a la red.
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init: { body: string }) => { sent.push(JSON.parse(init.body)); return { ok: true, status: 200, json: async () => ({ id: "email_1" }) }; }));
  process.env.RESEND_API_KEY = "re_test";
  process.env.EMAIL_FROM = "QuilGym <pedidos@quilgym.test>";
}, 30000);
afterAll(async () => { await pg.close(); vi.unstubAllGlobals(); delete process.env.RESEND_API_KEY; delete process.env.EMAIL_FROM; });
beforeEach(async () => { sent.length = 0; await database.execute(sql`truncate carts, orders restart identity cascade`); });

async function queuedOrder(event: string, { isDemo = false, eta = true } = {}) {
  const [cart] = await database.insert(schema.carts).values({}).returning();
  const [order] = await database.insert(schema.orders).values({ cartId: cart.id, checkoutKey: randomUUID(), isDemo, status: "approved", paymentMethod: "mercadopago",
    name: "Ana Pérez", email: "ana@example.com", phone: "1144444444", delivery: "local",
    address: { street: "Rivadavia", number: "500", apartment: "", postalCode: "1878", city: "Quilmes", province: "Buenos Aires" },
    subtotalArs: 2000, discountArs: 0, shippingArs: 0, totalArs: 2000, consentAt: new Date() }).returning();
  const [shipment] = await database.insert(schema.shipments).values({ orderId: order.id, label: "Entrega en Quilmes (costo a convenir)", estimate: "A coordinar", status: event }).returning();
  if (eta) await database.insert(schema.shipmentTracking).values({ shipmentId: shipment.id, carrier: "own", etaFrom: new Date("2026-10-17T15:00:00-03:00"), etaTo: new Date("2026-10-17T20:00:00-03:00") });
  await database.insert(schema.orderEmails).values({ orderId: order.id, event });
  return order;
}

describe("outbox de avisos de entrega", () => {
  it("envía «en camino» con la ventana guardada y el link firmado de seguimiento, y lo marca enviado", async () => {
    const order = await queuedOrder("out_for_delivery");
    await deliverOrderEmails(order.id);
    expect(sent).toHaveLength(1);
    expect(sent[0].subject).toContain(`pedido QG-${order.id.slice(0, 8).toUpperCase()}`);
    expect(sent[0].subject).toMatch(/^Tu pedido llega (en las próximas|.*entre las 15:00 y las 20:00)/);
    expect(sent[0].text).toContain(`Seguir mi pedido: https://quilgym.test/pedido/${order.id}?t=firmado`);
    const [row] = await database.select().from(schema.orderEmails).where(eq(schema.orderEmails.orderId, order.id));
    expect(row.sentAt).not.toBeNull();
    await deliverOrderEmails(order.id);
    expect(sent).toHaveLength(1);
  });

  it("envía «entregado» y nunca envía pedidos de prueba", async () => {
    const order = await queuedOrder("delivered", { eta: false });
    await deliverOrderEmails(order.id);
    expect(sent.map((email) => email.subject)).toEqual([`¡Tu pedido QG-${order.id.slice(0, 8).toUpperCase()} fue entregado!`]);
    const demo = await queuedOrder("delivered", { isDemo: true });
    await deliverOrderEmails(demo.id);
    expect(sent).toHaveLength(1);
  });
});
