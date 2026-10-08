import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq, sql } from "drizzle-orm";
import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from "vitest";
import * as schema from "./db/schema";
import { checkoutFingerprint, signQuote } from "./checkout-security";
import type { CheckoutInput, CheckoutConfig } from "./checkout-types";

const mocks = vi.hoisted(() => ({ transaction: vi.fn(), config: vi.fn(), db: {}, user: vi.fn(), cartId: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("./db", () => ({ db: mocks.db }));
vi.mock("./cart", () => ({ readCartId: mocks.cartId }));
vi.mock("./auth", () => ({ currentUser: mocks.user }));
vi.mock("./db/transaction", () => ({ withOrderTransaction: mocks.transaction }));
vi.mock("./checkout-config", () => ({ getCheckoutConfig: mocks.config, bankDetails: () => null, orderAccessSecret: () => null, pendingOrderTtlHours: () => 72 }));
import { createOrder, findOwnedOrder, transitionOrder } from "./order-service";
import { expirePendingOrders } from "./order-expiry";

const pg = new PGlite();
const database = drizzle(pg, { schema });
const config: CheckoutConfig = { demo: false, pickup: { address: "Local de test", hours: "A coordinar" }, shippingRates: [], payments: { cash: true, transfer: true, mercadopago: true } };
beforeAll(async () => {
  for (const file of readdirSync("drizzle").filter((f) => f.endsWith(".sql")).sort()) await pg.exec(readFileSync(`drizzle/${file}`, "utf8"));
  mocks.transaction.mockImplementation((fn) => database.transaction(fn));
  Object.assign(mocks.db, { select: database.select.bind(database) });
}, 30000);
afterAll(async () => { await pg.close(); });
beforeEach(async () => {
  mocks.config.mockReturnValue({ ...config });
  mocks.user.mockResolvedValue(null);
  mocks.cartId.mockResolvedValue(null);
  await database.execute(sql`truncate brands, categories, products, product_variants, carts, coupons, orders restart identity cascade`);
});

describe("privacidad de pedidos ligados a una cuenta", () => {
  async function accountOrder() {
    const { cart, input } = await fixture({ demo: true });
    await database.insert(schema.users).values({ id: "account-qa", name: "QA", email: "account-qa@example.com" }).onConflictDoNothing();
    const id = await createOrder(input, cart.id, "account-qa");
    return { id, cart };
  }
  it("la cookie del carrito no permite leer un pedido de cuenta después de logout", async () => {
    const { id, cart } = await accountOrder();
    mocks.cartId.mockResolvedValue(cart.id);
    expect(await findOwnedOrder(id)).toBeNull();
  });
  it("otra cuenta no accede aunque tenga la cookie del carrito", async () => {
    const { id, cart } = await accountOrder();
    mocks.cartId.mockResolvedValue(cart.id);
    mocks.user.mockResolvedValue({ id: "another-account" });
    expect(await findOwnedOrder(id)).toBeNull();
  });
  it("su propietario accede sin cookie del carrito", async () => {
    const { id } = await accountOrder();
    mocks.user.mockResolvedValue({ id: "account-qa" });
    expect((await findOwnedOrder(id))?.userId).toBe("account-qa");
  });
  it("conserva la autorización por cookie para pedidos de invitados", async () => {
    const { cart, input } = await fixture({ demo: true });
    const id = await createOrder(input, cart.id);
    mocks.cartId.mockResolvedValue(cart.id);
    expect((await findOwnedOrder(id))?.id).toBe(id);
  });
});

async function fixture({ demo = false, stock = 3, coupon = false, key = "test" } = {}) {
  mocks.config.mockReturnValue({ ...config, demo });
  const [category] = await database.insert(schema.categories).values({ slug: key, name: "Test" }).returning();
  const [product] = await database.insert(schema.products).values({ slug: key, name: "Producto test", status: "active", categoryId: category.id }).returning();
  const [variant] = await database.insert(schema.productVariants).values({ productId: product.id, sku: key.toUpperCase(), priceArs: 1000, stock }).returning();
  const [cart] = await database.insert(schema.carts).values({ couponCode: coupon ? "TEST" : null }).returning();
  await database.insert(schema.cartItems).values({ cartId: cart.id, variantId: variant.id, quantity: 2, seenPriceArs: 1000 });
  if (coupon) await database.insert(schema.coupons).values({ code: "TEST", kind: "percent", value: 10, maxRedemptions: 1 });
  const discount = coupon ? 200 : 0;
  const input: CheckoutInput = { name: "Prueba", email: "test@example.com", phone: "1144444444", delivery: "pickup", payment: "cash", paymentChoice: "cash",
    street: "", streetNumber: "", apartment: "", postalCode: "", city: "", province: "", notes: "", accepted: true, checkoutKey: randomUUID(),
    quoteToken: signQuote(cart.id, { expires: Date.now() + 60000, delivery: "pickup", postalCode: "", demo,
      fingerprint: checkoutFingerprint([{ variantId: variant.id, quantity: 2, unitPriceArs: 1000 }], discount, coupon ? "TEST" : null), shippingArs: 0, totalArs: 2000 - discount }) };
  return { cart, variant, input };
}

describe("transacciones de órdenes en PostgreSQL aislado", () => {
  it("guarda snapshots, reserva stock y consume cupón exactamente una vez", async () => {
    const { cart, input } = await fixture({ coupon: true });
    const first = await createOrder(input, cart.id);
    const second = await createOrder(input, cart.id);
    expect(second).toBe(first);
    expect(await database.select().from(schema.orders)).toHaveLength(1);
    expect((await database.select().from(schema.productVariants))[0].stock).toBe(1);
    expect((await database.select().from(schema.coupons))[0].redemptions).toBe(1);
    expect((await database.select().from(schema.orders))[0].totalArs).toBe(1800);
    expect(await database.select().from(schema.cartItems)).toHaveLength(0);
    expect(await database.select().from(schema.payments)).toHaveLength(1);
    expect(await database.select().from(schema.shipments)).toHaveLength(1);
  });
  it("reintentos concurrentes devuelven la misma orden", async () => {
    const { cart, input } = await fixture();
    const results = await Promise.all([createOrder(input, cart.id), createOrder(input, cart.id)]);
    expect(new Set(results).size).toBe(1);
    expect(await database.select().from(schema.orders)).toHaveLength(1);
  });
  it("revierte todo ante stock insuficiente", async () => {
    const { cart, input } = await fixture({ stock: 1, coupon: true });
    await expect(createOrder(input, cart.id)).rejects.toThrow("stock");
    expect(await database.select().from(schema.orders)).toHaveLength(0);
    expect(await database.select().from(schema.cartItems)).toHaveLength(1);
    expect((await database.select().from(schema.coupons))[0].redemptions).toBe(0);
  });
  it("rechaza cotizaciones alteradas y hace rollback del cupón", async () => {
    const { cart, input } = await fixture({ coupon: true });
    input.quoteToken = signQuote(cart.id, { expires: Date.now() + 60000, delivery: "pickup", postalCode: "", demo: false, fingerprint: "alterado", shippingArs: 0, totalArs: 1 });
    await expect(createOrder(input, cart.id)).rejects.toThrow("importe cambió");
    expect((await database.select().from(schema.coupons))[0].redemptions).toBe(0);
    expect(await database.select().from(schema.orders)).toHaveLength(0);
  });
  it("los pedidos demo no consumen stock ni cupones ni generan emails", async () => {
    const { cart, input } = await fixture({ demo: true, coupon: true });
    await createOrder(input, cart.id);
    expect((await database.select().from(schema.orders))[0].isDemo).toBe(true);
    expect((await database.select().from(schema.productVariants))[0].stock).toBe(3);
    expect((await database.select().from(schema.coupons))[0].redemptions).toBe(0);
    expect(await database.select().from(schema.orderEmails)).toHaveLength(0);
  });
  it("un rechazo libera reservas una sola vez", async () => {
    const { cart, input } = await fixture({ coupon: true });
    const id = await createOrder(input, cart.id);
    for (let i = 0; i < 2; i++) await database.transaction(async (tx) => {
      const [order] = await tx.select().from(schema.orders).where(eq(schema.orders.id, id)).for("update");
      // Ambos drivers usan las mismas operaciones PgTransaction.
      await transitionOrder(tx as unknown as Parameters<typeof transitionOrder>[0], order, "rejected");
    });
    expect((await database.select().from(schema.productVariants))[0].stock).toBe(3);
    expect((await database.select().from(schema.coupons))[0].redemptions).toBe(0);
    expect(await database.select().from(schema.orderEmails)).toHaveLength(2);
  });
  it("detecta precio cambiado incluso después de cotizar", async () => {
    const { cart, input, variant } = await fixture();
    await database.update(schema.productVariants).set({ priceArs: 2000 }).where(eq(schema.productVariants.id, variant.id));
    await expect(createOrder(input, cart.id)).rejects.toThrow("precio");
    expect(await database.select().from(schema.orders)).toHaveLength(0);
  });
});

describe("vencimiento de pedidos pendientes", () => {
  const hours = (n: number) => n * 60 * 60_000;
  it("cancela un pendiente vencido, repone stock y cupón una sola vez", async () => {
    const { cart, input } = await fixture({ coupon: true });
    const id = await createOrder(input, cart.id);
    const later = new Date(Date.now() + hours(73));
    expect((await expirePendingOrders(later, 72)).cancelled).toBe(1);
    expect((await expirePendingOrders(later, 72)).cancelled).toBe(0);
    const [order] = await database.select().from(schema.orders).where(eq(schema.orders.id, id));
    expect(order.status).toBe("cancelled");
    expect(order.resourcesReleasedAt).not.toBeNull();
    expect((await database.select().from(schema.productVariants))[0].stock).toBe(3);
    expect((await database.select().from(schema.coupons))[0].redemptions).toBe(0);
    expect((await database.select().from(schema.orderEmails)).map((row) => row.event).sort()).toEqual(["cancelled", "created"]);
  });
  it("respeta los pedidos recientes", async () => {
    const { cart, input } = await fixture();
    await createOrder(input, cart.id);
    expect((await expirePendingOrders(new Date(Date.now() + hours(71)), 72)).cancelled).toBe(0);
    expect((await database.select().from(schema.orders))[0].status).toBe("pending");
  });
  it("no toca pedidos con un pago iniciado en Mercado Pago ni pedidos demo", async () => {
    const { cart, input } = await fixture();
    const id = await createOrder(input, cart.id);
    await database.update(schema.payments).set({ providerId: "123456" }).where(eq(schema.payments.orderId, id));
    const demo = await fixture({ demo: true, key: "demo" });
    await createOrder(demo.input, demo.cart.id);
    expect((await expirePendingOrders(new Date(Date.now() + hours(200)), 72)).cancelled).toBe(0);
    expect((await database.select().from(schema.orders)).every((order) => order.status === "pending")).toBe(true);
  });
});
