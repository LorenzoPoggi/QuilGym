import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "./db/schema";
import { checkoutFingerprint, signQuote } from "./checkout-security";
import type { CheckoutConfig, CheckoutInput } from "./checkout-types";

const mocks = vi.hoisted(() => ({ transaction: vi.fn(), config: vi.fn(), db: {}, admin: vi.fn(), revalidatePath: vi.fn(), after: vi.fn(), deliver: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("./db", () => ({ db: mocks.db }));
vi.mock("./db/transaction", () => ({ withOrderTransaction: mocks.transaction }));
vi.mock("./cart", () => ({ readCartId: vi.fn() }));
vi.mock("./auth", () => ({ currentUser: vi.fn() }));
vi.mock("./admin-auth", () => ({ getAdminUser: mocks.admin }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/server", () => ({ after: mocks.after }));
vi.mock("./order-email", () => ({ deliverOrderEmails: mocks.deliver }));
vi.mock("./checkout-config", () => ({ getCheckoutConfig: mocks.config, bankDetails: () => null, orderAccessSecret: () => null, orderPageUrl: () => null, siteUrl: () => "https://quilgym.test" }));
import { createOrder } from "./order-service";
import { cancelAdminOrder, confirmOrderPayment, markOrderRefunded, reactivatePaidOrder, updateOrderShipment } from "./admin-orders-actions";
import { getAdminOrder, listAdminOrders } from "./admin-orders";
import { reconcileProviderPayment } from "./mercadopago";
import { allowedShipmentStatuses, parseAdminOrderFilters } from "./admin-orders-types";

const pg = new PGlite();
const database = drizzle(pg, { schema });
const config: CheckoutConfig = { demo: false, pickup: { address: "Local de test", hours: "A coordinar" }, shippingRates: [], payments: { cash: true, transfer: true, mercadopago: true } };
beforeAll(async () => {
  for (const file of readdirSync("drizzle").filter((f) => f.endsWith(".sql")).sort()) await pg.exec(readFileSync(`drizzle/${file}`, "utf8"));
  mocks.transaction.mockImplementation((fn) => database.transaction(fn));
  Object.assign(mocks.db, { select: database.select.bind(database) });
  process.env.MP_ACCESS_TOKEN = "TEST-token";
}, 30000);
afterAll(async () => { await pg.close(); vi.unstubAllGlobals(); });
beforeEach(async () => {
  mocks.config.mockReturnValue({ ...config });
  mocks.admin.mockResolvedValue({ id: "admin", email: "admin@example.com" });
  mocks.revalidatePath.mockReset(); mocks.after.mockReset();
  await database.execute(sql`truncate brands, categories, products, product_variants, carts, coupons, orders restart identity cascade`);
});

let seq = 0;
async function order({ demo = false, stock = 3, coupon = false, payment = "cash" as CheckoutInput["payment"], choice = "cash" as CheckoutInput["paymentChoice"], email = "test@example.com" } = {}) {
  const key = `k${++seq}`;
  mocks.config.mockReturnValue({ ...config, demo });
  const [category] = await database.insert(schema.categories).values({ slug: key, name: "Test" }).returning();
  const [product] = await database.insert(schema.products).values({ slug: key, name: "Producto test", status: "active", categoryId: category.id }).returning();
  const [variant] = await database.insert(schema.productVariants).values({ productId: product.id, sku: key.toUpperCase(), priceArs: 1000, stock }).returning();
  const [cart] = await database.insert(schema.carts).values({ couponCode: coupon ? key.toUpperCase() : null }).returning();
  await database.insert(schema.cartItems).values({ cartId: cart.id, variantId: variant.id, quantity: 2, seenPriceArs: 1000 });
  if (coupon) await database.insert(schema.coupons).values({ code: key.toUpperCase(), kind: "percent", value: 10, maxRedemptions: 5 });
  const discount = coupon ? 200 : 0;
  const input: CheckoutInput = { name: "Cliente Prueba", email, phone: "1144444444", delivery: "pickup", payment, paymentChoice: choice,
    street: "", streetNumber: "", apartment: "", postalCode: "", city: "", province: "", notes: "", accepted: true, checkoutKey: randomUUID(),
    quoteToken: signQuote(cart.id, { expires: Date.now() + 60000, delivery: "pickup", postalCode: "", demo,
      fingerprint: checkoutFingerprint([{ variantId: variant.id, quantity: 2, unitPriceArs: 1000 }], discount, coupon ? key.toUpperCase() : null), shippingArs: 0, totalArs: 2000 - discount }) };
  const id = await createOrder(input, cart.id);
  mocks.config.mockReturnValue({ ...config });
  return { id, variantId: variant.id, couponCode: coupon ? key.toUpperCase() : null };
}
const read = async (id: string) => (await database.select().from(schema.orders).where(eq(schema.orders.id, id)))[0];
const stockOf = async (variantId: number) => (await database.select().from(schema.productVariants).where(eq(schema.productVariants.id, variantId)))[0].stock;
const events = async (id: string) => (await database.select().from(schema.orderEmails).where(eq(schema.orderEmails.orderId, id))).map((row) => row.event).sort();
function providerPayment(payload: { id: number; orderId: string; status: string; amount?: number; updated?: string }) {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ id: payload.id, external_reference: payload.orderId, transaction_amount: payload.amount ?? 2000,
    currency_id: "ARS", status: payload.status, date_last_updated: payload.updated ?? new Date().toISOString() }) })));
}

describe("autorización del panel de pedidos", () => {
  it("rechaza todas las acciones sin sesión de administrador y no modifica nada", async () => {
    const { id, variantId } = await order();
    mocks.admin.mockResolvedValue(null);
    for (const result of [await confirmOrderPayment(id), await cancelAdminOrder(id), await markOrderRefunded(id), await reactivatePaidOrder(id), await updateOrderShipment(id, { status: "preparing", trackingCode: "" })]) {
      expect(result).toMatchObject({ ok: false, error: expect.stringContaining("permisos") });
    }
    expect((await read(id)).status).toBe("pending");
    expect(await stockOf(variantId)).toBe(1);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
  it("valida el ID antes de abrir una transacción", async () => {
    mocks.transaction.mockClear();
    expect(await cancelAdminOrder("../otro")).toMatchObject({ ok: false, error: "Pedido inválido." });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});

describe("acciones sobre pedidos", () => {
  it("confirma un pago en efectivo una sola vez y encola el aviso", async () => {
    const { id } = await order();
    expect(await confirmOrderPayment(id)).toMatchObject({ ok: true, message: "Pago confirmado." });
    expect(await confirmOrderPayment(id)).toMatchObject({ ok: true, message: expect.stringContaining("ya estaba") });
    expect((await read(id)).status).toBe("approved");
    expect((await database.select().from(schema.payments).where(eq(schema.payments.orderId, id)))[0].status).toBe("approved");
    expect(await events(id)).toEqual(["approved", "created"]);
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/admin/pedidos/${id}`);
  });
  it("no confirma manualmente pagos de Mercado Pago", async () => {
    const { id } = await order({ payment: "mercadopago", choice: "mercadopago" });
    expect(await confirmOrderPayment(id)).toMatchObject({ ok: false, error: expect.stringContaining("Mercado Pago") });
    expect((await read(id)).status).toBe("pending");
  });
  it("cancelar libera stock y cupón exactamente una vez", async () => {
    const { id, variantId, couponCode } = await order({ coupon: true });
    expect(await stockOf(variantId)).toBe(1);
    expect((await cancelAdminOrder(id)).ok).toBe(true);
    expect(await cancelAdminOrder(id)).toMatchObject({ ok: true, message: expect.stringContaining("ya estaba") });
    expect(await stockOf(variantId)).toBe(3);
    expect((await database.select().from(schema.coupons).where(eq(schema.coupons.code, couponCode!)))[0].redemptions).toBe(0);
    expect((await read(id)).resourcesReleasedAt).not.toBeNull();
  });
  it("no cancela un pedido pagado ni reembolsa uno pendiente", async () => {
    const { id } = await order();
    expect((await markOrderRefunded(id)).ok).toBe(false);
    await confirmOrderPayment(id);
    expect(await cancelAdminOrder(id)).toMatchObject({ ok: false, error: expect.stringContaining("reembolso") });
    expect(await confirmOrderPayment(randomUUID())).toMatchObject({ ok: false, error: "No encontramos el pedido." });
  });
  it("registrar un reembolso no repone stock ni llama al proveedor", async () => {
    const fetchSpy = vi.fn(); vi.stubGlobal("fetch", fetchSpy);
    const { id, variantId } = await order();
    await confirmOrderPayment(id);
    expect(await markOrderRefunded(id)).toMatchObject({ ok: true });
    expect((await markOrderRefunded(id)).ok).toBe(true);
    expect((await read(id)).status).toBe("refunded");
    expect(await stockOf(variantId)).toBe(1);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("envíos", () => {
  it("efectivo al retirar: se puede avisar «listo para retirar» antes del cobro, una sola vez", async () => {
    const { id } = await order();
    expect(await updateOrderShipment(id, { status: "ready_for_pickup", trackingCode: "" })).toMatchObject({ ok: true });
    expect(await updateOrderShipment(id, { status: "preparing", trackingCode: "" })).toMatchObject({ ok: true });
    expect(await updateOrderShipment(id, { status: "ready_for_pickup", trackingCode: "" })).toMatchObject({ ok: true });
    expect(await events(id)).toEqual(["created", "ready_for_pickup"]);
    expect(await updateOrderShipment(id, { status: "delivered", trackingCode: "" })).toMatchObject({ ok: false });
  });
  it("rechaza estados que no corresponden a la entrega o al pago y códigos inválidos", async () => {
    const { id } = await order();
    expect((await updateOrderShipment(id, { status: "shipped", trackingCode: "" })).ok).toBe(false);
    expect((await updateOrderShipment(id, { status: "perdido", trackingCode: "" })).ok).toBe(false);
    expect((await updateOrderShipment(id, { status: "preparing", trackingCode: "<script>" })).ok).toBe(false);
    const mp = await order({ payment: "mercadopago", choice: "mercadopago" });
    expect(await updateOrderShipment(mp.id, { status: "preparing", trackingCode: "" })).toMatchObject({ ok: false, error: expect.stringContaining("no admite") });
    expect(allowedShipmentStatuses({ status: "approved", delivery: "shipping", paymentMethod: "mercadopago" })).toContain("shipped");
    expect(allowedShipmentStatuses({ status: "cancelled", delivery: "pickup", paymentMethod: "cash" })).toEqual([]);
  });
  it("los pedidos demo no encolan emails de envío", async () => {
    const { id } = await order({ demo: true });
    expect((await updateOrderShipment(id, { status: "ready_for_pickup", trackingCode: "" })).ok).toBe(true);
    expect(await events(id)).toEqual([]);
  });
});

describe("pago aprobado sobre pedido cancelado (§8.4)", () => {
  it("registra el pago del proveedor, lo muestra como alerta y permite reactivar con stock", async () => {
    const { id, variantId } = await order({ payment: "mercadopago", choice: "mercadopago" });
    await cancelAdminOrder(id);
    providerPayment({ id: 555, orderId: id, status: "approved" });
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await reconcileProviderPayment("555")).toBe(id);
    expect((await read(id)).status).toBe("cancelled");
    const [payment] = await database.select().from(schema.payments).where(eq(schema.payments.orderId, id));
    expect(payment).toMatchObject({ status: "approved", providerId: "555" });
    const list = await listAdminOrders(parseAdminOrderFilters({ alertas: "1" }));
    expect(list.rows.map((row) => row.id)).toEqual([id]);
    expect(list.summary.alerts).toBe(1);
    expect(await reactivatePaidOrder(id)).toMatchObject({ ok: true });
    expect((await read(id)).status).toBe("approved");
    expect(await stockOf(variantId)).toBe(1);
    expect((await listAdminOrders(parseAdminOrderFilters({}))).summary.alerts).toBe(0);
    expect(await reactivatePaidOrder(id)).toMatchObject({ ok: true, message: expect.stringContaining("ya estaba") });
  });
  it("no reactiva si ya no hay stock y no toca pedidos sin pago aprobado", async () => {
    const { id, variantId } = await order({ payment: "mercadopago", choice: "mercadopago" });
    await cancelAdminOrder(id);
    await database.update(schema.productVariants).set({ stock: 1 }).where(eq(schema.productVariants.id, variantId));
    providerPayment({ id: 556, orderId: id, status: "approved" });
    vi.spyOn(console, "error").mockImplementation(() => {});
    await reconcileProviderPayment("556");
    expect(await reactivatePaidOrder(id)).toMatchObject({ ok: false, error: expect.stringContaining("stock") });
    expect((await read(id)).status).toBe("cancelled");
    expect(await stockOf(variantId)).toBe(1);
    const other = await order();
    await cancelAdminOrder(other.id);
    expect((await reactivatePaidOrder(other.id)).ok).toBe(false);
  });
  it("no reactiva una reserva de stock que dejó de estar controlada", async () => {
    const { id, variantId } = await order({ payment: "mercadopago", choice: "mercadopago" });
    await cancelAdminOrder(id);
    await database.update(schema.productVariants).set({ stock: null }).where(eq(schema.productVariants.id, variantId));
    providerPayment({ id: 557, orderId: id, status: "approved" });
    vi.spyOn(console, "error").mockImplementation(() => {});
    await reconcileProviderPayment("557");
    expect(await reactivatePaidOrder(id)).toMatchObject({ ok: false, error: expect.stringContaining("stock") });
    expect((await read(id)).status).toBe("cancelled");
  });
  it("no excede el cupo de un cupón al reactivar un pago tardío", async () => {
    const { id, variantId, couponCode } = await order({ coupon: true, payment: "mercadopago", choice: "mercadopago" });
    await cancelAdminOrder(id);
    await database.update(schema.coupons).set({ maxRedemptions: 1, redemptions: 1 }).where(eq(schema.coupons.code, couponCode!));
    providerPayment({ id: 558, orderId: id, status: "approved", amount: 1800 });
    vi.spyOn(console, "error").mockImplementation(() => {});
    await reconcileProviderPayment("558");
    expect(await reactivatePaidOrder(id)).toMatchObject({ ok: false, error: expect.stringContaining("cupón") });
    expect((await read(id)).status).toBe("cancelled");
    expect(await stockOf(variantId)).toBe(3);
    expect((await database.select().from(schema.coupons).where(eq(schema.coupons.code, couponCode!)))[0].redemptions).toBe(1);
  });
  it("un reintento aprobado tras un pago rechazado queda registrado como alerta", async () => {
    const { id } = await order({ payment: "mercadopago", choice: "mercadopago" });
    providerPayment({ id: 700, orderId: id, status: "rejected", updated: "2026-10-09T10:00:00.000Z" });
    await reconcileProviderPayment("700");
    expect((await read(id)).status).toBe("rejected");
    providerPayment({ id: 701, orderId: id, status: "approved", updated: "2026-10-09T10:05:00.000Z" });
    vi.spyOn(console, "error").mockImplementation(() => {});
    await reconcileProviderPayment("701");
    expect((await database.select().from(schema.payments).where(eq(schema.payments.orderId, id)))[0]).toMatchObject({ status: "approved", providerId: "701" });
    providerPayment({ id: 700, orderId: id, status: "rejected", updated: "2026-10-09T10:01:00.000Z" });
    await reconcileProviderPayment("700");
    expect((await database.select().from(schema.payments).where(eq(schema.payments.orderId, id)))[0].providerId).toBe("701");
    expect((await getAdminOrder(id))?.payment?.status).toBe("approved");
  });
  it("un segundo pago aprobado sobre un pedido cobrado se rechaza para revisión", async () => {
    const { id } = await order({ payment: "mercadopago", choice: "mercadopago" });
    providerPayment({ id: 800, orderId: id, status: "approved" });
    await reconcileProviderPayment("800");
    providerPayment({ id: 801, orderId: id, status: "approved" });
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(reconcileProviderPayment("801")).rejects.toThrow("otro pago");
  });
});

describe("listado y detalle", () => {
  it("filtra por estado, tipo, medio y búsqueda, ordena por fecha y pagina", async () => {
    const cash = await order({ email: "ana@example.com" });
    const demo = await order({ demo: true, email: "demo@example.com" });
    const mp = await order({ payment: "mercadopago", choice: "credit_card", email: "luis@example.com" });
    await database.update(schema.orders).set({ createdAt: new Date("2026-10-01T15:00:00Z") }).where(eq(schema.orders.id, cash.id));
    const all = await listAdminOrders(parseAdminOrderFilters({}));
    expect(all.total).toBe(3);
    expect(all.rows.at(-1)?.id).toBe(cash.id);
    expect(all.rows[0].units).toBe(2);
    expect((await listAdminOrders(parseAdminOrderFilters({ tipo: "demo" }))).rows.map((r) => r.id)).toEqual([demo.id]);
    expect((await listAdminOrders(parseAdminOrderFilters({ medio: "credit_card" }))).rows.map((r) => r.id)).toEqual([mp.id]);
    expect((await listAdminOrders(parseAdminOrderFilters({ q: "LUIS@" }))).rows.map((r) => r.id)).toEqual([mp.id]);
    expect((await listAdminOrders(parseAdminOrderFilters({ q: `QG-${cash.id.slice(0, 8).toUpperCase()}` }))).rows.map((r) => r.id)).toEqual([cash.id]);
    expect((await listAdminOrders(parseAdminOrderFilters({ q: "100%" }))).total).toBe(0);
    expect((await listAdminOrders(parseAdminOrderFilters({ hasta: "2026-10-01" }))).rows.map((r) => r.id)).toEqual([cash.id]);
    expect((await listAdminOrders(parseAdminOrderFilters({ estado: "approved" }))).total).toBe(0);
    expect((await listAdminOrders(parseAdminOrderFilters({ pagina: "2" }))).rows).toHaveLength(0);
    expect((await listAdminOrders(parseAdminOrderFilters({}))).summary).toMatchObject({ awaitingPayment: 1, toPrepare: 1, alerts: 0 });
    const detail = await getAdminOrder(cash.id);
    expect(detail?.items).toHaveLength(1);
    expect(detail?.emails.map((e) => e.event)).toEqual(["created"]);
    expect(await getAdminOrder("no-es-un-id")).toBeNull();
  });
  it("normaliza filtros inválidos de la URL", () => {
    expect(parseAdminOrderFilters({ estado: "x", medio: "bitcoin", tipo: "y", desde: "2026-13-45", pagina: "-3", q: ["  hola ", "x"] }))
      .toEqual({ q: "hola", status: "all", choice: "all", kind: "all", from: "", to: "", alerts: false, page: 1 });
  });
});
