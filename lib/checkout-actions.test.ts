import { beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";

const mocks = vi.hoisted(() => ({
  readCartId: vi.fn(), getCart: vi.fn(), config: vi.fn(), createOrder: vi.fn(),
  findOwnedOrder: vi.fn(), transitionOrder: vi.fn(), currentUser: vi.fn(),
  consumeRateLimit: vi.fn(), deliverOrderEmails: vi.fn(), revalidatePath: vi.fn(), after: vi.fn(), rememberOrder: vi.fn(),
  paymentSetup: vi.fn(), orderRows: [] as unknown[],
}));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/server", () => ({ after: mocks.after }));
vi.mock("./cart", () => ({ readCartId: mocks.readCartId, getCart: mocks.getCart }));
vi.mock("./checkout-config", () => ({ getCheckoutConfig: mocks.config }));
vi.mock("./db/transaction", () => ({ withOrderTransaction: vi.fn() }));
vi.mock("./order-service", () => ({
  CheckoutError: class CheckoutError extends Error {},
  createOrder: mocks.createOrder, findOwnedOrder: mocks.findOwnedOrder, transitionOrder: mocks.transitionOrder,
}));
vi.mock("./order-email", () => ({ deliverOrderEmails: mocks.deliverOrderEmails }));
vi.mock("./auth", () => ({ currentUser: mocks.currentUser }));
vi.mock("./rate-limit", () => ({ consumeRateLimit: mocks.consumeRateLimit }));
vi.mock("./db", () => ({ db: { select: () => ({ from: () => ({ where: () => ({ limit: async () => mocks.orderRows }) }) }) } }));
vi.mock("./mercadopago", () => ({ paymentSetup: mocks.paymentSetup }));
vi.mock("./analytics", () => ({ linkOrderToVisit: vi.fn() }));
vi.mock("./shipping-parcel", () => ({ parcelForLines: vi.fn() }));
vi.mock("./carriers", () => ({ getCarrier: () => null }));
vi.mock("./order-cookie-server", () => ({ rememberOrder: mocks.rememberOrder }));

import { getCheckoutQuote, submitCheckout } from "./checkout-actions";

const cartId = "00000000-0000-4000-8000-000000000002";
const validCheckout = {
  checkoutKey: randomUUID(), quoteToken: "signed-quote-token", name: "Cliente de prueba", email: "qa@example.com", phone: "1144444444",
  delivery: "pickup", payment: "cash", paymentChoice: "cash", street: "", streetNumber: "", apartment: "", postalCode: "",
  city: "", province: "", notes: "", accepted: true,
};

describe("límites del checkout", () => {
  beforeEach(() => {
    mocks.readCartId.mockReset().mockResolvedValue(cartId);
    mocks.getCart.mockReset();
    mocks.config.mockReset();
    mocks.createOrder.mockReset();
    mocks.findOwnedOrder.mockReset();
    mocks.transitionOrder.mockReset();
    mocks.currentUser.mockReset().mockResolvedValue(null);
    mocks.consumeRateLimit.mockReset().mockResolvedValue(true);
    mocks.deliverOrderEmails.mockReset();
    mocks.revalidatePath.mockReset();
    mocks.after.mockReset();
    mocks.rememberOrder.mockReset();
    mocks.paymentSetup.mockReset();
    mocks.orderRows = [];
  });

  it("recuerda en la cookie qg_orders solo los pedidos de invitado", async () => {
    mocks.createOrder.mockResolvedValue("00000000-0000-4000-8000-000000000009");
    expect(await submitCheckout(validCheckout)).toEqual({ ok: true, orderId: "00000000-0000-4000-8000-000000000009" });
    expect(mocks.rememberOrder).toHaveBeenCalledWith("00000000-0000-4000-8000-000000000009");
    mocks.rememberOrder.mockReset();
    mocks.currentUser.mockResolvedValue({ id: "cuenta" });
    await submitCheckout({ ...validCheckout, checkoutKey: randomUUID() });
    expect(mocks.rememberOrder).not.toHaveBeenCalled();
  });

  it("con Mercado Pago devuelve la URL de pago para no pasar por el checkout vacío", async () => {
    const orderId = "00000000-0000-4000-8000-000000000010";
    mocks.createOrder.mockResolvedValue(orderId);
    mocks.orderRows = [{ id: orderId, isDemo: false, status: "pending" }];
    mocks.paymentSetup.mockResolvedValue({ initPoint: "https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=1" });
    const mercadoPago = { ...validCheckout, checkoutKey: randomUUID(), payment: "mercadopago", paymentChoice: "mercadopago" };
    expect(await submitCheckout(mercadoPago)).toEqual({ ok: true, orderId, redirectUrl: "https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=1" });
    expect(mocks.consumeRateLimit).toHaveBeenCalledWith(`payment:prepare:${orderId}`, 12, 600_000);
    expect(mocks.revalidatePath).not.toHaveBeenCalledWith("/carrito");
  });

  it("si la preferencia falla, el pedido queda creado y sigue a la confirmación", async () => {
    const orderId = "00000000-0000-4000-8000-000000000011";
    mocks.createOrder.mockResolvedValue(orderId);
    mocks.orderRows = [{ id: orderId, isDemo: false, status: "pending" }];
    mocks.paymentSetup.mockRejectedValue(new Error("Pago no disponible."));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await submitCheckout({ ...validCheckout, checkoutKey: randomUUID(), payment: "mercadopago", paymentChoice: "mercado_credito" })).toEqual({ ok: true, orderId });
    expect(mocks.paymentSetup).toHaveBeenCalledTimes(1);
  });

  it("efectivo no crea preferencia de Mercado Pago", async () => {
    mocks.createOrder.mockResolvedValue("00000000-0000-4000-8000-000000000012");
    await submitCheckout({ ...validCheckout, checkoutKey: randomUUID() });
    expect(mocks.paymentSetup).not.toHaveBeenCalled();
  });

  it("limita la cotización por carrito antes de leer el carrito", async () => {
    mocks.consumeRateLimit.mockResolvedValue(false);
    const result = await getCheckoutQuote({ delivery: "address", address: { street: "San Martín", streetNumber: "492", postalCode: "1878", city: "Quilmes", province: "Buenos Aires" } });
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining("muchas consultas") });
    expect(mocks.consumeRateLimit).toHaveBeenCalledWith(`checkout:quote:${cartId}`, 30, 60_000);
    expect(mocks.getCart).not.toHaveBeenCalled();
  });

  it("rechaza pedidos de cotización mal formados sin consultar el carrito", async () => {
    expect(await getCheckoutQuote({ delivery: "address", address: { street: "", streetNumber: "1", postalCode: "1878", city: "Quilmes", province: "Bs As" } })).toMatchObject({ ok: false });
    expect(await getCheckoutQuote({ delivery: "local" })).toMatchObject({ ok: false });
    expect(mocks.readCartId).not.toHaveBeenCalled();
  });

  it("limita creación por carrito antes de crear una orden", async () => {
    mocks.consumeRateLimit.mockResolvedValue(false);
    const result = await submitCheckout(validCheckout);
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining("muchos intentos") });
    expect(mocks.consumeRateLimit).toHaveBeenCalledWith(`checkout:submit:${cartId}`, 10, 600_000);
    expect(mocks.currentUser).not.toHaveBeenCalled();
    expect(mocks.createOrder).not.toHaveBeenCalled();
  });
});
