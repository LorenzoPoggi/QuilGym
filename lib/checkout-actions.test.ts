import { beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";

const mocks = vi.hoisted(() => ({
  readCartId: vi.fn(), getCart: vi.fn(), config: vi.fn(), createOrder: vi.fn(),
  findOwnedOrder: vi.fn(), transitionOrder: vi.fn(), currentUser: vi.fn(),
  consumeRateLimit: vi.fn(), deliverOrderEmails: vi.fn(), revalidatePath: vi.fn(), after: vi.fn(),
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
  });

  it("limita la cotización por carrito antes de leer el carrito", async () => {
    mocks.consumeRateLimit.mockResolvedValue(false);
    const result = await getCheckoutQuote("shipping", "1878");
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining("muchas consultas") });
    expect(mocks.consumeRateLimit).toHaveBeenCalledWith(`checkout:quote:${cartId}`, 30, 60_000);
    expect(mocks.getCart).not.toHaveBeenCalled();
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
