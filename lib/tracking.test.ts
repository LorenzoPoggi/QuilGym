import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "./db/schema";
import { orderAccessToken } from "./order-access";

const SECRET = "secreto-de-pedidos-con-mas-de-32-caracteres";
const mocks = vi.hoisted(() => ({ transaction: vi.fn(), db: {}, admin: vi.fn(), cartId: vi.fn(), user: vi.fn(), rate: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("./db", () => ({ db: mocks.db }));
vi.mock("./db/transaction", () => ({ withOrderTransaction: mocks.transaction }));
vi.mock("./cart", () => ({ readCartId: mocks.cartId }));
vi.mock("./auth", () => ({ currentUser: mocks.user }));
vi.mock("./admin-auth", () => ({ getAdminUser: mocks.admin }));
vi.mock("./rate-limit", () => ({ consumeRateLimit: mocks.rate }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("./order-email", () => ({ deliverOrderEmails: vi.fn() }));
vi.mock("./checkout-config", () => ({ getCheckoutConfig: () => ({ demo: false, pickup: null, shippingRates: [], payments: { cash: true, transfer: false, mercadopago: true } }),
  bankDetails: () => null, orderAccessSecret: () => SECRET, orderPageUrl: () => null, siteUrl: () => "https://quilgym.test" }));
import { purgeStaleCourierPositions, readCourierPosition, syncCarrierTracking, syncOpenShipments } from "./tracking";
import { confirmOrderPayment, markLocalDelivered, reportCourierPosition, startLocalDelivery, updateOrderShipment } from "./admin-orders-actions";
import { GET as positionRoute } from "../app/api/orders/[id]/position/route";

const pg = new PGlite();
const database = drizzle(pg, { schema });
beforeAll(async () => {
  for (const file of readdirSync("drizzle").filter((f) => f.endsWith(".sql")).sort()) await pg.exec(readFileSync(`drizzle/${file}`, "utf8"));
  mocks.transaction.mockImplementation((fn) => database.transaction(fn));
  Object.assign(mocks.db, { select: database.select.bind(database), insert: database.insert.bind(database), update: database.update.bind(database),
    delete: database.delete.bind(database), execute: database.execute.bind(database) });
}, 30000);
afterAll(async () => { await pg.close(); delete process.env.SHIPPING_CARRIER; });
beforeEach(async () => {
  mocks.admin.mockResolvedValue({ id: "admin", email: "admin@example.com" });
  mocks.cartId.mockResolvedValue(null);
  mocks.user.mockResolvedValue(null);
  mocks.rate.mockResolvedValue(true);
  delete process.env.SHIPPING_CARRIER;
  await database.execute(sql`truncate carts, orders restart identity cascade`);
});

async function localOrder({ status = "approved" as "approved" | "pending", payment = "mercadopago" as "mercadopago" | "cash", delivery = "local" as "local" | "shipping", shipmentStatus = "preparing" } = {}) {
  const [cart] = await database.insert(schema.carts).values({}).returning();
  const [order] = await database.insert(schema.orders).values({ cartId: cart.id, checkoutKey: randomUUID(), status, paymentMethod: payment, paymentChoice: payment === "cash" ? "cash" : "mercadopago",
    name: "Cliente", email: "cliente@example.com", phone: "1144444444", delivery,
    address: { street: "Rivadavia", number: "500", apartment: "", postalCode: "1878", city: "Quilmes", province: "Buenos Aires" },
    subtotalArs: 2000, discountArs: 0, shippingArs: 0, totalArs: 2000, consentAt: new Date() }).returning();
  await database.insert(schema.payments).values({ orderId: order.id, status });
  const [shipment] = await database.insert(schema.shipments).values({ orderId: order.id, label: "Entrega en Quilmes", estimate: "A coordinar", status: shipmentStatus }).returning();
  await database.insert(schema.orderDelivery).values({ orderId: order.id, optionId: delivery === "local" ? "local" : "rate:x", lat: delivery === "local" ? -34.7192 : null, lng: delivery === "local" ? -58.2517 : null, distanceM: 900 });
  return { order, shipment, cart };
}
const eventsOf = async (shipmentId: string) => (await database.select().from(schema.shipmentEvents).where(eq(schema.shipmentEvents.shipmentId, shipmentId))).map((row) => row.status);
const shipmentOf = async (id: string) => (await database.select().from(schema.shipments).where(eq(schema.shipments.id, id)))[0];

describe("reparto en vivo (entrega propia)", () => {
  it("«Salir a entregar» guarda la ventana, pasa a «En camino» y registra el evento", async () => {
    const { order, shipment } = await localOrder();
    expect(await startLocalDelivery(order.id, { kind: "5h" })).toMatchObject({ ok: true });
    expect((await shipmentOf(shipment.id)).status).toBe("out_for_delivery");
    const [tracking] = await database.select().from(schema.shipmentTracking);
    expect(tracking).toMatchObject({ carrier: "own" });
    expect(tracking.etaTo!.getTime() - tracking.etaFrom!.getTime()).toBe(5 * 3_600_000);
    expect(await eventsOf(shipment.id)).toEqual(["out_for_delivery"]);
  });

  it("solo para entrega propia, con admin y con una ventana válida", async () => {
    const shipping = await localOrder({ delivery: "shipping" });
    expect(await startLocalDelivery(shipping.order.id, { kind: "5h" })).toMatchObject({ ok: false, error: expect.stringContaining("entrega propia") });
    const { order } = await localOrder();
    expect(await startLocalDelivery(order.id, { kind: "custom", from: "x", to: "y" })).toMatchObject({ ok: false });
    mocks.admin.mockResolvedValue(null);
    expect(await startLocalDelivery(order.id, { kind: "5h" })).toMatchObject({ ok: false });
  });

  it("guarda la última posición con validación y límite de frecuencia", async () => {
    const { order, shipment } = await localOrder({ shipmentStatus: "out_for_delivery" });
    expect(await reportCourierPosition(order.id, { lat: -34.72, lng: -58.26, accuracy: 12.4 })).toEqual({ ok: true });
    expect(await reportCourierPosition(order.id, { lat: -34.73, lng: -58.27 })).toEqual({ ok: true });
    const rows = await database.select().from(schema.courierPositions);
    expect(rows).toEqual([expect.objectContaining({ shipmentId: shipment.id, lat: -34.73, lng: -58.27, accuracyM: null })]);
    expect(await reportCourierPosition(order.id, { lat: 200, lng: 0 })).toMatchObject({ ok: false });
    mocks.rate.mockResolvedValue(false);
    expect(await reportCourierPosition(order.id, { lat: -34.74, lng: -58.28 })).toMatchObject({ ok: false, throttled: true });
    expect(mocks.rate).toHaveBeenLastCalledWith(`courier:position:${order.id}`, 1, 10_000);
    mocks.admin.mockResolvedValue(null);
    expect(await reportCourierPosition(order.id, { lat: -34.74, lng: -58.28 })).toMatchObject({ ok: false, stop: true });
  });

  it("no acepta posiciones si el pedido no está en camino", async () => {
    const { order } = await localOrder({ shipmentStatus: "preparing" });
    expect(await reportCourierPosition(order.id, { lat: -34.72, lng: -58.26 })).toMatchObject({ ok: false, stop: true });
    expect(await database.select().from(schema.courierPositions)).toHaveLength(0);
  });

  it("«Entregado» registra el evento y borra la posición", async () => {
    const { order, shipment } = await localOrder({ shipmentStatus: "out_for_delivery" });
    await reportCourierPosition(order.id, { lat: -34.72, lng: -58.26 });
    expect(await markLocalDelivered(order.id)).toMatchObject({ ok: true });
    expect((await shipmentOf(shipment.id)).status).toBe("delivered");
    expect(await eventsOf(shipment.id)).toEqual(["delivered"]);
    expect(await database.select().from(schema.courierPositions)).toHaveLength(0);
  });

  it("con efectivo pendiente exige registrar el cobro antes de entregar", async () => {
    const { order, shipment } = await localOrder({ status: "pending", payment: "cash", shipmentStatus: "out_for_delivery" });
    expect(await markLocalDelivered(order.id)).toMatchObject({ ok: false, error: expect.stringContaining("cobro") });
    expect(await confirmOrderPayment(order.id)).toMatchObject({ ok: true });
    expect(await markLocalDelivered(order.id)).toMatchObject({ ok: true });
    expect((await shipmentOf(shipment.id)).status).toBe("delivered");
  });

  it("cada cambio de estado desde el formulario del panel queda en la línea de tiempo", async () => {
    const { order, shipment } = await localOrder({ shipmentStatus: "pending" });
    await updateOrderShipment(order.id, { status: "preparing", trackingCode: "" });
    await updateOrderShipment(order.id, { status: "preparing", trackingCode: "" });
    await updateOrderShipment(order.id, { status: "out_for_delivery", trackingCode: "" });
    expect((await eventsOf(shipment.id)).sort()).toEqual(["out_for_delivery", "preparing"]);
  });
});

describe("posición del repartidor y purga", () => {
  it("solo se muestra fresca, en entrega propia y en camino; la purga borra las de más de 4 h", async () => {
    const { order, shipment } = await localOrder({ shipmentStatus: "out_for_delivery" });
    await database.insert(schema.courierPositions).values({ shipmentId: shipment.id, lat: -34.72, lng: -58.26, accuracyM: 20, updatedAt: new Date(Date.now() - 5 * 3_600_000) });
    expect(await readCourierPosition(order, shipment)).toBeNull();
    expect(await purgeStaleCourierPositions()).toBe(1);
    await database.insert(schema.courierPositions).values({ shipmentId: shipment.id, lat: -34.72, lng: -58.26, accuracyM: 20 });
    expect(await readCourierPosition(order, shipment)).toMatchObject({ lat: -34.72, lng: -58.26, accuracyM: 20 });
    expect(await readCourierPosition({ delivery: "shipping" }, shipment)).toBeNull();
    expect(await readCourierPosition(order, { ...shipment, status: "delivered" })).toBeNull();
    expect(await purgeStaleCourierPositions()).toBe(0);
  });
});

describe("endpoint de posición", () => {
  it("no revela nada sin autorización y responde con cookie del carrito o link firmado", async () => {
    const { order, shipment, cart } = await localOrder({ shipmentStatus: "out_for_delivery" });
    await database.insert(schema.courierPositions).values({ shipmentId: shipment.id, lat: -34.72, lng: -58.26 });
    const call = (query = "") => positionRoute(new Request(`https://quilgym.test/api/orders/${order.id}/position${query}`), { params: Promise.resolve({ id: order.id }) });
    const denied = await call();
    expect(denied.status).toBe(404);
    expect(await denied.json()).toEqual({ error: "not_found" });
    expect((await call("?t=firma-falsa")).status).toBe(404);
    const signed = await call(`?t=${orderAccessToken(order.id, SECRET)}`);
    expect(signed.status).toBe(200);
    expect(signed.headers.get("cache-control")).toBe("no-store");
    expect(await signed.json()).toMatchObject({ status: "out_for_delivery", position: { lat: -34.72, lng: -58.26 } });
    mocks.cartId.mockResolvedValue(cart.id);
    expect((await call()).status).toBe(200);
    // Otro pedido con el mismo token no se autoriza.
    const other = await localOrder();
    expect((await positionRoute(new Request(`https://quilgym.test/x?t=${orderAccessToken(order.id, SECRET)}`), { params: Promise.resolve({ id: other.order.id }) })).status).toBe(404);
  });
});

describe("sincronización con el transportista", () => {
  async function carrierShipment() {
    const { order, shipment } = await localOrder({ delivery: "shipping", shipmentStatus: "shipped" });
    await database.insert(schema.shipmentTracking).values({ shipmentId: shipment.id, carrier: "mock", carrierShipmentId: "SIM123" });
    return { order, shipment };
  }
  it("guarda los eventos nuevos una sola vez y no vuelve a consultar antes de 30 min", async () => {
    process.env.SHIPPING_CARRIER = "mock";
    const { shipment } = await carrierShipment();
    const [tracking] = await database.select().from(schema.shipmentTracking);
    expect(await syncCarrierTracking(tracking)).toBe(1);
    const [checked] = await database.select().from(schema.shipmentTracking);
    expect(checked.trackingCheckedAt).not.toBeNull();
    expect(await syncCarrierTracking(checked)).toBe(0);
    expect(await syncCarrierTracking({ ...checked, trackingCheckedAt: null })).toBe(0);
    const events = await database.select().from(schema.shipmentEvents).where(eq(schema.shipmentEvents.shipmentId, shipment.id));
    expect(events).toEqual([expect.objectContaining({ source: "carrier", description: "Envío admitido (simulación)" })]);
  });
  it("el cron sincroniza los envíos abiertos y sin transportista no hace nada", async () => {
    const { shipment } = await carrierShipment();
    expect(await syncOpenShipments()).toEqual({ synced: 1, events: 0 });
    process.env.SHIPPING_CARRIER = "mock";
    await database.update(schema.shipmentTracking).set({ trackingCheckedAt: null });
    expect(await syncOpenShipments()).toEqual({ synced: 1, events: 1 });
    expect(await eventsOf(shipment.id)).toEqual(["admitted"]);
  });
});

describe("avisos por email del envío (Fase 6)", () => {
  const queued = async (orderId: string) => (await database.select().from(schema.orderEmails).where(eq(schema.orderEmails.orderId, orderId))).map((row) => row.event).sort();

  it("«Salir a entregar» y «Entregado» encolan un aviso cada uno, una sola vez", async () => {
    const { order } = await localOrder();
    await startLocalDelivery(order.id, { kind: "12h" });
    await startLocalDelivery(order.id, { kind: "12h" });
    await markLocalDelivered(order.id);
    await markLocalDelivered(order.id);
    expect(await queued(order.id)).toEqual(["delivered", "out_for_delivery"]);
  });

  it("los cambios del formulario encolan listo, despachado, en distribución y entregado; no los demás estados", async () => {
    const { order } = await localOrder({ delivery: "shipping", shipmentStatus: "pending" });
    for (const status of ["preparing", "shipped", "out_for_delivery", "delivered"]) await updateOrderShipment(order.id, { status, trackingCode: "" });
    expect(await queued(order.id)).toEqual(["delivered", "out_for_delivery", "shipped"]);
  });

  it("los pedidos de prueba no encolan emails", async () => {
    const { order } = await localOrder();
    await database.update(schema.orders).set({ isDemo: true }).where(eq(schema.orders.id, order.id));
    await startLocalDelivery(order.id, { kind: "5h" });
    expect(await queued(order.id)).toEqual([]);
  });

  it("la sincronización con el transportista no cambia estados ni encola emails", async () => {
    process.env.SHIPPING_CARRIER = "mock";
    const { order, shipment } = await localOrder({ delivery: "shipping", shipmentStatus: "shipped" });
    await database.insert(schema.shipmentTracking).values({ shipmentId: shipment.id, carrier: "mock", carrierShipmentId: "SIM999" });
    await syncOpenShipments();
    expect((await shipmentOf(shipment.id)).status).toBe("shipped");
    expect(await queued(order.id)).toEqual([]);
  });
});
