/**
 * Pago con tarjeta de punta a punta contra Postgres en memoria (PGlite) y la API de Mercado Pago simulada:
 * pedido → cobro con token del Brick → conciliación → reintento tras rechazo → aprobación → factura en cola.
 */
import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "./db/schema";
import { checkoutFingerprint, signQuote } from "./checkout-security";
import type { CheckoutConfig, CheckoutInput } from "./checkout-types";

const mocks = vi.hoisted(() => ({ transaction: vi.fn(), config: vi.fn(), db: {} }));
vi.mock("server-only", () => ({}));
vi.mock("./db", () => ({ db: mocks.db }));
vi.mock("./db/transaction", () => ({ withOrderTransaction: mocks.transaction }));
vi.mock("./cart", () => ({ readCartId: vi.fn() }));
vi.mock("./auth", () => ({ currentUser: vi.fn() }));
vi.mock("./checkout-config", () => ({ getCheckoutConfig: mocks.config, bankDetails: () => null, orderAccessSecret: () => null, orderPageUrl: () => null,
  siteUrl: () => "https://quilgym.test", paymentNotificationUrl: () => "https://quilgym.test/api/payments/mercadopago/webhook", cardThreeDsMode: () => "optional" }));
import { createOrder } from "./order-service";
import { cardPaymentSetup, CardPaymentError, submitProviderPayment } from "./mercadopago";

const pg = new PGlite();
const database = drizzle(pg, { schema });
const config: CheckoutConfig = { demo: false, pickup: { address: "Local de test", hours: "A coordinar" }, shippingRates: [], payments: { cash: false, transfer: false, mercadopago: true } };

type Provider = { id: number; status: string; status_detail: string; amount?: number; three_ds_info?: object };
const provider = new Map<number, Provider>();
const posts: { body: Record<string, unknown>; key: string | null }[] = [];
let nextResult: Omit<Provider, "id"> = { status: "approved", status_detail: "accredited" };
let orderRef = "";

beforeAll(async () => {
  for (const file of readdirSync("drizzle").filter((f) => f.endsWith(".sql")).sort()) await pg.exec(readFileSync(`drizzle/${file}`, "utf8"));
  mocks.transaction.mockImplementation((fn) => database.transaction(fn));
  Object.assign(mocks.db, { select: database.select.bind(database), execute: database.execute.bind(database) });
  process.env.MP_ACCESS_TOKEN = "TEST-token";
  process.env.NEXT_PUBLIC_MP_PUBLIC_KEY = "TEST-public";
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
    const asPayment = (p: Provider) => ({ id: p.id, external_reference: orderRef, transaction_amount: p.amount ?? 2000, currency_id: "ARS", status: p.status,
      status_detail: p.status_detail, date_last_updated: new Date(Date.now() + p.id).toISOString(), three_ds_info: p.three_ds_info });
    if (init.method === "POST" && url.endsWith("/v1/payments")) {
      const key = new Headers(init.headers).get("X-Idempotency-Key");
      posts.push({ body: JSON.parse(String(init.body)), key });
      const existing = [...provider.values()].find((p) => (p as Provider & { key?: string }).key === key);
      if (existing) return { ok: true, json: async () => asPayment(existing) };
      const created = { id: 1000 + provider.size, ...nextResult, key } as Provider & { key: string | null };
      provider.set(created.id, created);
      return { ok: true, json: async () => asPayment(created) };
    }
    const id = Number(url.split("/").pop());
    const found = provider.get(id);
    return found ? { ok: true, json: async () => asPayment(found) } : { ok: false, status: 404, json: async () => ({}) };
  }));
}, 30000);
afterAll(async () => { await pg.close(); vi.unstubAllGlobals(); });
beforeEach(async () => {
  mocks.config.mockReturnValue({ ...config });
  provider.clear(); posts.length = 0; nextResult = { status: "approved", status_detail: "accredited" };
  await database.execute(sql`truncate brands, categories, products, product_variants, carts, coupons, orders restart identity cascade`);
});

async function cardOrder(choice: "debit_card" | "credit_card" = "credit_card") {
  const key = randomUUID().slice(0, 8);
  const [category] = await database.insert(schema.categories).values({ slug: key, name: "Test" }).returning();
  const [product] = await database.insert(schema.products).values({ slug: key, name: "Creatina test", status: "active", categoryId: category.id }).returning();
  const [variant] = await database.insert(schema.productVariants).values({ productId: product.id, sku: `SKU-${key}`, priceArs: 1000, stock: 5 }).returning();
  const [cart] = await database.insert(schema.carts).values({}).returning();
  await database.insert(schema.cartItems).values({ cartId: cart.id, variantId: variant.id, quantity: 2, seenPriceArs: 1000 });
  const input: CheckoutInput = { name: "Ana Pérez", email: "ana@example.com", phone: "11 4444-4444", delivery: "pickup", payment: "mercadopago", paymentChoice: choice,
    street: "", streetNumber: "", apartment: "", postalCode: "", city: "", province: "", notes: "", accepted: true, checkoutKey: randomUUID(),
    quoteToken: signQuote(cart.id, { expires: Date.now() + 60000, delivery: "pickup", postalCode: "", demo: false,
      fingerprint: checkoutFingerprint([{ variantId: variant.id, quantity: 2, unitPriceArs: 1000 }], 0, null), shippingArs: 0, totalArs: 2000 }) };
  const id = await createOrder(input, cart.id);
  orderRef = id;
  const [order] = await database.select().from(schema.orders).where(eq(schema.orders.id, id));
  return { order, variantId: variant.id };
}
const readOrder = async (id: string) => (await database.select().from(schema.orders).where(eq(schema.orders.id, id)))[0];
const readPayment = async (id: string) => (await database.select().from(schema.payments).where(eq(schema.payments.orderId, id)))[0];
const brick = (token: string, overrides: Record<string, unknown> = {}) => ({ token, payment_method_id: "master", installments: 3, issuer_id: 24,
  payer: { email: "otro@example.com", identification: { type: "DNI", number: "12345678" } }, transaction_amount: 1, ...overrides });

describe("pago con tarjeta de punta a punta (Mercado Pago simulado)", () => {
  it("prepara el Brick con el monto del servidor, el tipo excluido y el tope de cuotas", async () => {
    const { order } = await cardOrder("debit_card");
    expect(await cardPaymentSetup(order)).toEqual({ publicKey: "TEST-public", amount: 2000, email: "ana@example.com", paymentType: "debit_card", excludedTypes: ["credit_card"], maxInstallments: 1 });
  });

  it("APRO: cobra el monto del pedido (no el del navegador), concilia y deja la factura en cola", async () => {
    const { order } = await cardOrder();
    const result = await submitProviderPayment(order, brick("token-apro-0001"), { paymentTypeId: "credit_card" });
    expect(result).toMatchObject({ outcome: "approved", challenge: null });
    const sent = posts[0].body;
    expect(sent).toMatchObject({ transaction_amount: 2000, external_reference: order.id, installments: 3, issuer_id: "24", payment_method_id: "master",
      notification_url: "https://quilgym.test/api/payments/mercadopago/webhook", three_d_secure_mode: "optional",
      payer: { email: "ana@example.com", first_name: "Ana", last_name: "Pérez", identification: { type: "DNI", number: "12345678" } } });
    expect((sent.additional_info as { items: unknown[] }).items).toHaveLength(1);
    expect(posts[0].key).toMatch(/^card-/);
    expect((await readOrder(order.id)).status).toBe("approved");
    expect(await readPayment(order.id)).toMatchObject({ status: "approved", providerId: String(result.paymentId) });
    expect((await database.select().from(schema.invoices).where(eq(schema.invoices.orderId, order.id)))[0]).toMatchObject({ status: "manual", amountArs: 2000, receiverDocType: "CF" });
  });

  it("OTHE y reintento: el rechazo deja el pedido reservado; otra tarjeta crea un intento nuevo y se aprueba", async () => {
    const { order, variantId } = await cardOrder();
    nextResult = { status: "rejected", status_detail: "cc_rejected_other_reason" };
    const rejected = await submitProviderPayment(order, brick("token-othe-0001"));
    expect(rejected.outcome).toBe("rejected");
    expect((await readOrder(order.id)).status).toBe("pending");
    expect((await database.select().from(schema.productVariants).where(eq(schema.productVariants.id, variantId)))[0].stock).toBe(3);
    expect(await readPayment(order.id)).toMatchObject({ status: "rejected" });
    expect(await cardPaymentSetup(await readOrder(order.id))).toMatchObject({ amount: 2000 });

    nextResult = { status: "approved", status_detail: "accredited" };
    const approved = await submitProviderPayment(await readOrder(order.id), brick("token-apro-0002"));
    expect(approved.outcome).toBe("approved");
    expect(posts[0].key).not.toBe(posts[1].key);
    expect((await readOrder(order.id)).status).toBe("approved");
    const events = (await database.select().from(schema.orderEmails).where(eq(schema.orderEmails.orderId, order.id))).map((row) => row.event).sort();
    expect(events).toEqual(["approved", "created", "payment_rejected"]);
  });

  it("CONT: un pago en proceso bloquea un segundo cobro y no reenvía el pago", async () => {
    const { order } = await cardOrder();
    nextResult = { status: "in_process", status_detail: "pending_contingency" };
    expect((await submitProviderPayment(order, brick("token-cont-0001"))).outcome).toBe("pending");
    expect((await readOrder(order.id)).status).toBe("pending");
    expect(await readPayment(order.id)).toMatchObject({ status: "pending" });
    await expect(cardPaymentSetup(await readOrder(order.id))).rejects.toThrow("no disponible");
    const again = await submitProviderPayment(await readOrder(order.id), brick("token-otra-0001"));
    expect(again.outcome).toBe("pending");
    expect(posts).toHaveLength(1);
  });

  it("el mismo token (doble click o reintento de red) usa la misma clave de idempotencia", async () => {
    const { order } = await cardOrder();
    nextResult = { status: "rejected", status_detail: "cc_rejected_bad_filled_security_code" };
    await submitProviderPayment(order, brick("token-dup-00001"));
    await submitProviderPayment(await readOrder(order.id), brick("token-dup-00001"));
    expect(posts).toHaveLength(2);
    expect(posts[0].key).toBe(posts[1].key);
    expect(provider.size).toBe(1);
  });

  it("3-D Secure: devuelve el desafío para el Status Screen Brick", async () => {
    const { order } = await cardOrder();
    nextResult = { status: "pending", status_detail: "pending_challenge", three_ds_info: { external_resource_url: "https://acs.example.com/challenge", creq: "eyJjcmVxIjoiMSJ9" } };
    const result = await submitProviderPayment(order, brick("token-3ds-00001"));
    expect(result).toMatchObject({ outcome: "pending", challenge: { externalResourceUrl: "https://acs.example.com/challenge", creq: "eyJjcmVxIjoiMSJ9" } });
  });

  it("valida antes de cobrar: débito con cuotas o tarjeta de otro tipo no llegan a Mercado Pago", async () => {
    const { order } = await cardOrder("debit_card");
    await expect(submitProviderPayment(order, brick("token-deb-00001"))).rejects.toBeInstanceOf(CardPaymentError);
    await expect(submitProviderPayment(order, brick("token-deb-00002", { installments: 1 }), { paymentTypeId: "credit_card" })).rejects.toThrow("no es de débito");
    expect(posts).toHaveLength(0);
  });

  it("un pago cuyo importe no coincide con el pedido no se concilia", async () => {
    const { order } = await cardOrder();
    nextResult = { status: "approved", status_detail: "accredited", amount: 1 };
    await expect(submitProviderPayment(order, brick("token-monto-001"))).rejects.toThrow("no coincide");
    expect((await readOrder(order.id)).status).toBe("pending");
  });
});
